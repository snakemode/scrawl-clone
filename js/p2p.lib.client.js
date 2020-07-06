class P2PClient {
    constructor(identity, uniqueId, ably) {
      this.identity = identity;
      this.uniqueId = uniqueId;
      this.ably = ably;

      this.serverState = null;
      this.state = { 
        status: "disconnected",
        lastImage: null
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
        case "drawing":
          this.state.lastImage = "Nope";
          break;
        default: () => { };
      }
    }
    
    async sendImage(drawableCanvas) {
      const asText = drawableCanvas.toString();
      
      const result = await fetch("/api/storeImage", {
        method: "POST",
        body: JSON.stringify({ gameId: this.uniqueId, imageData: asText })
      });

      const bodyText = await result.json();

      console.log(result, bodyText);

      // push to bucket
      const bucketUrl = "something";
      this.ably.sendMessage({ kind: "drawing", imageUrl: bucketUrl });
    }

  }