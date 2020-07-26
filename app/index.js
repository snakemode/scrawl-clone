import { Identity } from "./js/Identity.js";
import { PubSubClient } from "./js/PubSubClient.js";
import { P2PClient } from "./js/P2PClient.js";
import { P2PServer } from "./js/P2PServer.js";

import "./vue.config.js";

export var app = new Vue({
  el: '#app',
  data: {   
    p2pClient: null,
    p2pServer: null,
    
    gameId: null,
    friendlyName: null,
  },
  computed: {
    state: function() { return this.p2pClient?.state; },
    transmittedServerState: function() { return this.p2pClient?.serverState; },
    joinedOrHosting: function () { return this.p2pClient != null || this.p2pServer != null; },
    isHost: function() { return this.p2pServer != null; },
    hasMessage: function () { return this.message != null; },
    gameCanBeStarted: function() { return this.transmittedServerState && !this.transmittedServerState.started },
    scrawlClient: function() { return this.p2pClient?.scrawl; }
  },
  methods: {
    host: async function(context) {
      this.gameId = context.gameId;
      this.friendlyName = context.friendlyName;

      const pubSubClient = new PubSubClient((message, metadata) => { 
        handleMessagefromAbly(message, metadata, this.p2pClient, this.p2pServer); 
      });

      const identity = new Identity(this.friendlyName);
      this.p2pServer = new P2PServer(identity, this.gameId, pubSubClient);
      this.p2pClient = new P2PClient(identity, this.gameId, pubSubClient);
      
      await this.p2pServer.connect();
      await this.p2pClient.connect();
    },
    join: async function(context) { 
      this.gameId = context.gameId;
      this.friendlyName = context.friendlyName;

      const pubSubClient = new PubSubClient((message, metadata) => { 
        handleMessagefromAbly(message, metadata, this.p2pClient, this.p2pServer); 
      });
      
      const identity = new Identity(this.friendlyName);
      this.p2pClient = new P2PClient(identity, this.gameId, pubSubClient);

      await this.p2pClient.connect();
    },
    startGame: async function(evt) {
      this.p2pServer?.startGame();
    },
    nextRound: async function(evt) {
      this.p2pServer?.nextRound();
    }
  }
});

function shouldHandleMessage(message, metadata) {  
  return message.forClientId == null || !message.forClientId || (message.forClientId && message.forClientId === metadata.clientId); 
}

function handleMessagefromAbly(message, metadata, p2pClient, p2pServer) {
  if (shouldHandleMessage(message, metadata)) {
    p2pServer?.onReceiveMessage(message);  
    p2pClient?.onReceiveMessage(message);
  } 
}

