define(['lodash', 'ID', 'Response', 'Entry', 'Utils'], function(_, ID, Response, Entry, Utils) {
  var RequestHandler = function(localNode, nodeFactory) {
    this._localNode = localNode;
    this._nodeFactory = nodeFactory;
  }

  RequestHandler.prototype = {
    handle: function(fromPeerId, request, callback) {
      var self = this;

      switch (request.method) {
      case 'FIND_SUCCESSOR':
        if (!Utils.isNonemptyString(request.params.key)) {
          this._sendFailureResponse("Invalid params.", request, callback);
          return;
        }

        var key = ID.fromHexString(request.params.key);
        this._localNode.findSuccessorIterative(key, function(status, node, error) {
          if (error) {
            console.log(error);
            self._sendFailureResponse(e.message, request, callback);
            return;
          }

          if (status === 'SUCCESS') {
            self._sendSuccessResponse({
              successorNodeInfo: node.toNodeInfo()
            }, request, callback);
          } else if (status === 'REDIRECT') {
            self._sendRedirectResponse({
              redirectNodeInfo: node.toNodeInfo()
            }, request, callback);
          }
        });
        break;

      case 'NOTIFY_AND_COPY':
        var potentialPredecessorNodeInfo = request.params.potentialPredecessorNodeInfo;
        this._nodeFactory.create(potentialPredecessorNodeInfo, function(node, error) {
          if (error) {
            console.log(error);
            this._sendFailureResponse(e.message, request, callback);
            return;
          }

          self._localNode.notifyAndCopyEntries(node, function(references, entries) {
            if (_.isNull(references) || _.isNull(entries)) {
              self._sendFailureResponse("Unknown error.", request, callback);
              return;
            }

            self._sendSuccessResponse({
              referencesNodeInfo: _.invoke(references, 'toNodeInfo'),
              entries: _.invoke(entries, 'toJson')
            }, request, callback);
          });
        });
        break;

      case 'NOTIFY':
        var potentialPredecessorNodeInfo = request.params.potentialPredecessorNodeInfo;
        this._nodeFactory.create(potentialPredecessorNodeInfo, function(node, error) {
          if (error) {
            console.log(error);
            self._sendFailureResponse(e.message, request, callback);
            return;
          }

          self._localNode.notify(node, function(references) {
            if (_.isNull(references)) {
              self._sendFailureResponse("Unknown error.", request, callback);
              return;
            }

            self._sendSuccessResponse({
              referencesNodeInfo: _.invoke(references, 'toNodeInfo')
            }, request, callback);
          });
        });
        break;

      case 'PING':
        self._sendSuccessResponse({}, request, callback);
        break;

      case 'INSERT_REPLICAS':
        if (!_.isArray(request.params.replicas)) {
          return;
        }
        var replicas = _.chain(request.params.replicas)
          .map(function(replica) {
            try {
              return Entry.fromJson(replica);
            } catch (e) {
              return null;
            }
          })
          .reject(function(replica) { return _.isNull(replica); })
          .value();
        self._localNode.insertReplicas(replicas);
        break;

      case 'REMOVE_REPLICAS':
        var sendingNodeId;
        try {
            sendingNodeId = ID.fromHexString(request.params.sendingNodeId);
        } catch (e) {
          return;
        }
        if (!_.isArray(request.params.replicas)) {
          return;
        }
        var replicas = _.chain(request.params.replicas)
          .map(function(replica) {
            try {
              return Entry.fromJson(replica);
            } catch (e) {
              return null;
            }
          })
          .reject(function(replica) { return _.isNull(replica); })
          .value();
        self._localNode.removeReplicas(sendingNodeId, replicas);
        break;

      case 'INSERT_ENTRY':
        var entry;
        try {
          entry = Entry.fromJson(request.params.entry);
        } catch (e) {
          self._sendFailureResponse(e.message, request, callback);;
          return;
        }
        self._localNode.insertEntryIterative(entry, function(status, node, error) {
          if (error) {
            console.log("Failed to insert entry:", error);
            self._sendFailureResponse("Unknown error.", request, callback);
            return;
          }

          if (status === 'SUCCESS') {
            self._sendSuccessResponse({}, request, callback);
          } else if (status === 'REDIRECT') {
            self._sendRedirectResponse({
              redirectNodeInfo: node.toNodeInfo()
            }, request, callback);
          }
        });
        break;

      case 'RETRIEVE_ENTRIES':
        var id;
        try {
          id = ID.fromHexString(request.params.id);
        } catch (e) {
          self._sendFailureResponse(e.message, request, callback);
          return;
        }
        self._localNode.retrieveEntriesIterative(id, function(status, entries, node, error) {
          if (error) {
            console.log("Failed to retrieve entries:", error);
            self._sendFailureResponse("Unknown error.", request, callback);
            return;
          }

          if (status === 'SUCCESS') {
            self._sendSuccessResponse({
              entries: _.invoke(entries, 'toJson')
            }, request, callback);
          } else if (status === 'REDIRECT') {
            self._sendRedirectResponse({
              redirectNodeInfo: node.toNodeInfo()
            }, request, callback);
          }
        });
        break;

      case 'REMOVE_ENTRY':
        var entry;
        try {
          entry = Entry.fromJson(request.params.entry);
        } catch (e) {
          self._sendFailureResponse(e.message, request, callback);
          return;
        }
        self._localNode.removeEntryIterative(entry, function(status, node, error) {
          if (error) {
            console.log("Failed to remove entry:", error);
            self._sendFailureResponse("Unknown error.", request, callback);
            return;
          }

          if (status === 'SUCCESS') {
            self._sendSuccessResponse({}, request, callback);
          } else if (status === 'REDIRECT') {
            self._sendRedirectResponse({
              redirectNodeInfo: node.toNodeInfo()
            }, request, callback);
          }
        });
        break;

      case 'UPPER_LAYER_MESSAGE':
        if (!_.has(request.params, 'message')) {
          return;
        }
        self._localNode.onMessageReceived(fromPeerId, request.params.message);
        break;

      case 'SHUTDOWN':
        break;

      case 'LEAVES_NETWORK':
        var predecessorNodeInfo = request.params.predecessorNodeInfo;
        this._nodeFactory.create(predecessorNodeInfo, function(predecessor, error) {
          if (error) {
            console.log(error);
            return;
          }

          self._localNode.leavesNetwork(predecessor);
        });
        break;

      default:
        this._sendFailureResponse("Unknown request method type.", request, callback);
        break;
      }
    },

    _sendSuccessResponse: function(result, request, callback) {
      this._sendResponse('SUCCESS', result, request, callback);
    },

    _sendRedirectResponse: function(result, request, callback) {
      this._sendResponse('REDIRECT', result, request, callback);
    },

    _sendResponse: function(status, result, request, callback) {
      var self = this;

      var response;
      try {
        response = Response.create(status, result, request);
      } catch (e) {
        this._sendFailureResponse(e.message, request, callback);
        return;
      }

      callback(response);
    },

    _sendFailureResponse: function(message, request, callback) {
      var response;
      try {
        response = Response.create('FAILED', {message: message}, request);
      } catch (e) {
        return;
      }

      callback(response);
    }
  };

  return RequestHandler;
});
