export class P2PClient {
    constructor(identity, uniqueId, ably) {
      this.identity = identity;
      this.uniqueId = uniqueId;
      this.ably = ably;

      this.serverState = null;
      this.state = { 
        status: "disconnected",
        lastInstruction: null,
        pendingVotes: []
       };
    }

    async connect() {
      await this.ably.connect(this.identity, this.uniqueId);
      this.ably.sendMessage({ kind: "connected" });
      this.state.status = "awaiting-acknowledgement";
    }

    onReceiveMessage(message) {
      if (message.serverState) {
        this.serverState = message.serverState; 
      }

      switch(message.kind) {
        case "connection-acknowledged": 
          this.state.status = "acknowledged"; 
          break;
        case "instruction":
          this.state.lastInstruction = message;
          break;
        default: { };
      }
    }
    
    async sendImage(drawableCanvas) {
      const asText = drawableCanvas.toString();
      
      const result = await fetch("/api/storeImage", {
        method: "POST",
        body: JSON.stringify({ gameId: this.uniqueId, imageData: asText })
      });

      const savedUrl = await result.json();
      this.ably.sendMessage({ kind: "drawing-response", imageUrl: savedUrl.url });
    }

    async sendCaption(caption) {
      this.ably.sendMessage({ kind: "client-caption", caption: caption });
    }

    async logVote(id) {
      this.state.pendingVotes.push(id);
    }

    async sendVotes() {
      this.ably.sendMessage({ kind: "client-votes", votes: this.state.pendingVotes });
      this.state.pendingVotes = [];
    }

  }