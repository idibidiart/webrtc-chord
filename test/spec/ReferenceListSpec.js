define(['ReferenceList', 'Node', 'ID'], function(ReferenceList, Node, ID) {
  describe("ReferenceList", function() {
    var references;
    var successors;
    var fingerTable;
    var nodes;

    beforeEach(function() {
      var localId = ID.fromHexString("0000000000000000000000000000000000000000000000000000000000000000");
      var entries = jasmine.createSpyObj('entries', ['getEntriesInInterval']);
      successors = jasmine.createSpyObj('successors', [
        'addSuccessor', 'removeReference', 'getClosestPrecedingNode'
      ]);
      fingerTable = jasmine.createSpyObj('fingerTable', [
        'addReference', 'removeReference', 'getClosestPrecedingNode'
      ]);
      references = new ReferenceList(localId, entries, {});
      references._successors = successors;
      references._fingerTable = fingerTable;

      nodes = _(4).times(function() {
        return new Node({peerId: "dummy", nodeId: "dummy"}, null, null, null, {});
      }).value();
      nodes[0].nodeId = ID.fromHexString("00000000000000000000000000000000ffffffffffffffffffffffffffffffff");
      nodes[1].nodeId = ID.fromHexString("0000000000000000ffffffffffffffffffffffffffffffff0000000000000000");
      nodes[2].nodeId = ID.fromHexString("ffffffffffffffffffffffffffffffff00000000000000000000000000000000");
      nodes[3].nodeId = ID.fromHexString("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    });

    describe("#addReference", function() {
      it("should add the passed reference to successors and finger table", function() {
        references.addReference(nodes[0]);
        expect(successors.addSuccessor).toHaveBeenCalledWith(nodes[0]);
        expect(fingerTable.addReference).toHaveBeenCalledWith(nodes[0]);

        references.addReference(nodes[1]);
        expect(successors.addSuccessor).toHaveBeenCalledWith(nodes[1]);
        expect(fingerTable.addReference).toHaveBeenCalledWith(nodes[1]);
      });

      it("should throw error if passed null", function() {
        expect(function() { references.addReference(null); }).toThrow();
      });

      it("should not add local node", function() {
        references.addReference({nodeId: references._localId});
        expect(successors.addSuccessor.calls.count()).toBe(0);
        expect(fingerTable.addReference.calls.count()).toBe(0);
      });
    });

    describe("#removeReference", function() {
      it("should remove the passed reference from successors and finger table", function() {
        spyOn(references, 'disconnectIfUnreferenced');
        references.removeReference(nodes[0]);
        expect(successors.removeReference).toHaveBeenCalledWith(nodes[0]);
        expect(fingerTable.removeReference).toHaveBeenCalledWith(nodes[0]);
        expect(references.disconnectIfUnreferenced).toHaveBeenCalledWith(nodes[0]);
      });

      it("should throw error if passed null", function() {
        expect(function() { references.removeReference(null); }).toThrow();
      });

      it("should set predecessor to null if removed", function() {
        spyOn(references, 'disconnectIfUnreferenced');
        references._predecessor = nodes[0];
        references.removeReference(nodes[0]);
        expect(references._predecessor).toBeNull();
      });
    });

    describe("#getClosestPrecedingNode", function() {
      it("should return closest preceding node", function() {
        references._successors.getClosestPrecedingNode.and.returnValue(nodes[0]);
        references._fingerTable.getClosestPrecedingNode.and.returnValue(nodes[1]);
        references._predecessor = nodes[2];
        expect(references.getClosestPrecedingNode(
          ID.fromHexString("0000000000000000000000000000000000000000000000000000000000000000")))
          .toBeNull();
        expect(references.getClosestPrecedingNode(
          ID.fromHexString("00000000000000000000000000000000fffffffffffffffffffffffffffffffe")))
          .toEqualNode(nodes[1]);
        expect(references.getClosestPrecedingNode(
          ID.fromHexString("00000000000000000000000000000000ffffffffffffffffffffffffffffffff")))
          .toEqualNode(nodes[0]);
        expect(references.getClosestPrecedingNode(
          ID.fromHexString("0000000000000000000000000000000100000000000000000000000000000000")))
          .toEqualNode(nodes[0]);
        expect(references.getClosestPrecedingNode(
          ID.fromHexString("0000000000000000fffffffffffffffffffffffffffffffe0000000000000000")))
          .toEqualNode(nodes[0]);
        expect(references.getClosestPrecedingNode(
          ID.fromHexString("0000000000000000ffffffffffffffffffffffffffffffff0000000000000000")))
          .toEqualNode(nodes[1]);
        expect(references.getClosestPrecedingNode(
          ID.fromHexString("0000000000000001000000000000000000000000000000000000000000000000")))
          .toEqualNode(nodes[1]);
        expect(references.getClosestPrecedingNode(
          ID.fromHexString("fffffffffffffffffffffffffffffffe00000000000000000000000000000000")))
          .toEqualNode(nodes[1]);
        expect(references.getClosestPrecedingNode(
          ID.fromHexString("ffffffffffffffffffffffffffffffff00000000000000000000000000000000")))
          .toEqualNode(nodes[1]);
        expect(references.getClosestPrecedingNode(
          ID.fromHexString("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")))
          .toEqualNode(nodes[2]);
      });

      it("should throw error if passed null", function() {
        expect(function() { references.getClosestPrecedingNode(null); }).toThrow();
      });
    });

    describe("#addReferenceAsPredecessor", function() {
      beforeEach(function() {
        spyOn(references, '_setPredecessor');
      });

      it("should add predecessor if current predecessor is null", function() {
        references.addReferenceAsPredecessor(nodes[0]);
        expect(references._setPredecessor).toHaveBeenCalledWith(nodes[0]);
      });

      it("should replace current predecessor", function() {
        references._predecessor = nodes[1];

        references.addReferenceAsPredecessor(nodes[0]);
        expect(references._setPredecessor.calls.count()).toBe(0);

        references.addReferenceAsPredecessor(nodes[2]);
        expect(references._setPredecessor).toHaveBeenCalledWith(nodes[2]);
      });

      it("should not add local node as predecessor", function() {
        expect(references._setPredecessor.calls.count()).toBe(0);
      });

      it("should throw error if passed null", function() {
        expect(function() { references.addReferenceAsPredecessor(null); }).toThrow();
      });
    });
  });
});
