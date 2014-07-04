define(['lodash', 'cryptojs', 'Utils'], function(_, CryptoJS, Utils) {
  var Packet = function(id, flags, payload) {
    if (!Utils.isNonemptyString(id) ||
        !_.isObject(flags) || !_.isObject(payload)) {
      throw new Error("Invalid argument.");
    }

    this.id = id;
    this.flags = flags;
    this.payload = payload;
  };

  Packet.create = function(flags, payload) {
    return new Packet(Packet._createId(), flags, payload);
  };

  Packet._createId = function() {
    return CryptoJS.SHA256(Math.random().toString()).toString();
  };

  Packet.fromJson = function(json) {
    if (!_.isObject(json)) {
      throw new Error("Invalid argument.");
    }
    return new Packet(json.id, json.flags, json.payload);
  };

  Packet.prototype = {
    toJson: function() {
      return {
        id: this.id,
        flags: this.flags,
        payload: this.payload,
      };
    }
  };

  return Packet;
});