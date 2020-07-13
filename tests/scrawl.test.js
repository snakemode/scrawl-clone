import { NullMessageChannel } from "../js/jackbox";
import {
    StartHandler, 
    DealHandler, 
    GetUserDrawingHandler, 
    GetUserCaptionHandler, 
    PassStacksAroundHandler,
    GetUserScoresHandler,
    EndHandler
} from "../js/scrawl.handlers";
import { Stack, StackItem } from "../js/scrawl.types";
import { ScrawlGame } from "../js/scrawl";
import { Identity } from "../js/p2p";

describe("ScrawlGame", () => {
    let sut;
    beforeEach(() => {
        sut = ScrawlGame;        
        sut.state.players = [];
        sut.state.players.push(new Identity("Player1"));
        sut.state.players.push(new Identity("Player2"));
    });

    it("run, sets up the game and prompts users for their first drawing", async () => {
        await sut.run();

        expect(sut.currentStepKey).toBe("GetUserDrawingHandler");
    });
});

describe("StartHandler", () => {
    let step, state;
    beforeEach(() => {
        state = {};
        step = new StartHandler();
    });

    it("execute, clears down stacks", async () => {
        step.execute(state);
        expect(state.stacks.length).toBe(0);
    });

    it("execute, populates hints in state", async () => {
        const result = await step.execute(state);
        expect(state.hints.length).not.toBe(0);
    });

    it("execute, triggers 'deal' step", async () => {
        const result = await step.execute(state);
        expect(result.transitionTo).toBe("DealHandler");
    });
});

describe("DealHandler", () => {    
    let step, state;
    beforeEach(() => {
        state = {
            players: [ new Identity("Some player") ],
            stacks: [],
            hints: [ "hint1", "hint2" ]
        };
        step = new DealHandler();
    });

    it("execute, generates a stack for each player", async () => {
        await step.execute(state);
        expect(state.stacks.length).toBe(1);
    });
    
    it("execute, triggers 'getUserDrawing' step to start game", async () => {
        const result = await step.execute(state);
        expect(result.transitionTo).toBe("GetUserDrawingHandler");
    });
});

describe("GetUserDrawingHandler", () => {
    let step, state, identity, channel;
    beforeEach(() => {
        identity = new Identity("Some player");
        channel = new NullMessageChannel();
        state = {
            players: [ identity ],
            stacks: [ new Stack(identity.clientId, "hint1") ],
            hints: [ "hint1", "hint2" ],
            channel: channel
        };
        step = new GetUserDrawingHandler(5_000);
    });

    it("execute, sends instruction for each user to draw an image from the hint at the top of their stack", async () => {
        step.execute(state);

        expect(channel.sentMessages.length).toBe(1);
        expect(channel.sentMessages[0].message.kind).toBe("instruction");
        expect(channel.sentMessages[0].message.type).toBe("drawing-request");
        expect(channel.sentMessages[0].message.value).toBe("hint1");
    });
    
    it("execute, transitions to PassStacksAroundHandler after all users have provided input", async () => {
        setTimeout(async () => {
            step.handleInput(state, { kind: "drawing-response", imageUrl: "http://my/drawing.jpg", metadata: { clientId: identity.clientId } });
        }, 100);

        const result = await step.execute(state);

        expect(result.transitionTo).toBe("PassStacksAroundHandler");
        expect(result.error).not.toBeDefined();
    });

    it("execute, transitions to PassStacksAroundHandler with error flag if users timeout.", async () => {
        step = new GetUserDrawingHandler(100);
        const result = await step.execute(state);

        expect(result.transitionTo).toBe("PassStacksAroundHandler");
        expect(result.error).toBeDefined();
    });
});

describe("GetUserCaptionHandler", () => {
    let step, state, identity, channel;
    beforeEach(() => {
        identity = new Identity("Some player");
        channel = new NullMessageChannel();
        state = {
            players: [ identity ],
            stacks: [ new Stack(identity.clientId, "hint1") ],
            hints: [ "hint1", "hint2" ],
            channel: channel
        };
        step = new GetUserCaptionHandler(5_000);

        state.stacks[0].add(new StackItem("image", "http://tempuri.org/img.png"));
    });

    it("execute, sends instruction for each user to enter caption for the image at the top of their stack", async () => {
        step.execute(state);

        expect(channel.sentMessages.length).toBe(1);
        expect(channel.sentMessages[0].message.kind).toBe("instruction");
        expect(channel.sentMessages[0].message.type).toBe("caption-request");
        expect(channel.sentMessages[0].message.value).toBe("http://tempuri.org/img.png");
    });
    
    it("execute, transitions to PassStacksAroundHandler after all users have provided input", async () => {
        setTimeout(async () => {
            step.handleInput(state, { kind: "caption-response", caption: "blah blah blah", metadata: { clientId: identity.clientId } });
        }, 100);

        const result = await step.execute(state);

        expect(result.transitionTo).toBe("PassStacksAroundHandler");
        expect(result.error).not.toBeDefined();
    });

    it("execute, transitions to passStacksAround with error flag if users timeout.", async () => {
        step = new GetUserCaptionHandler(100);
        const result = await step.execute(state);

        expect(result.transitionTo).toBe("PassStacksAroundHandler");
        expect(result.error).toBeDefined();
    });
});

describe("PassStacksAroundHandler", () => {
    let step, state, p1, p2, channel;
    beforeEach(() => {
        p1 = new Identity("Some player");
        p2 = new Identity("Some player");
        channel = new NullMessageChannel();
        state = {
            players: [ p1, p2 ],
            stacks: [ 
                new Stack(p1.clientId, "hint1"),
                new Stack(p2.clientId, "hint2"),
            ],
            hints: [ "hint1", "hint2" ],
            channel: channel
        };

        step = new PassStacksAroundHandler();
        state.stacks[0].add(new StackItem("image", "http://tempuri.org/img.png"));
        state.stacks[1].add(new StackItem("image", "http://tempuri.org/img.png"));
    });

    it("execute, assigns players each others stacks", async () => {
        step.execute(state);

        expect(state.stacks[0].heldBy).toBe(p2.clientId);
        expect(state.stacks[1].heldBy).toBe(p1.clientId);
    });

    it("execute, when original owners have their stacks again, redirects to getUserScores", async () => {
        await step.execute(state);
        const result = await step.execute(state);

        expect(result.transitionTo).toBe("GetUserScoresHandler");
    });

    it("execute, routes to getUserCaption when last card was an image", async () => {
        const result = await step.execute(state);

        expect(result.transitionTo).toBe("GetUserCaptionHandler");
    });

    it("execute, routes to getUserDrawing when last card was a caption", async () => {
        state.stacks[0].add(new StackItem("string", "blah blah"));
        state.stacks[1].add(new StackItem("string", "bleh bleh"));

        const result = await step.execute(state);

        expect(result.transitionTo).toBe("GetUserDrawingHandler");
    });
});

describe("GetUserScoresHandler", () => {
    let step, state, p1, p2, channel;
    beforeEach(() => {
        p1 = new Identity("Some player");
        channel = new NullMessageChannel();
        state = {
            players: [ p1 ],
            stacks: [ 
                new Stack(p1.clientId, "hint1"),
            ],
            hints: [ "hint1", "hint2" ],
            channel: channel
        };

        step = new GetUserScoresHandler(5_000);
        const item = new StackItem("image", "http://tempuri.org/img.png");
        item.author = p1.clientId;
        item.id = "1234";
        state.stacks[0].items.push(item);
    });

    it("execute, requests players to vote for one card per stack", async () => {
        setTimeout(async () => {
            step.handleInput(state, { kind: "pick-one-response", id: "1234", metadata: { clientId: p1.clientId } });

            expect(channel.sentMessages[1].message.kind).toBe("instruction");
            expect(channel.sentMessages[1].message.type).toBe("wait");
        }, 100);

        const result = await step.execute(state);

        expect(channel.sentMessages[0].message.kind).toBe("instruction");
        expect(channel.sentMessages[0].message.type).toBe("pick-one-request");

        expect(result.transitionTo).toBe("EndHandler");
        expect(result.error).not.toBeDefined();
    });
});

describe("EndHandler", () => {
    let step, state, p1, p2, channel;
    beforeEach(() => {
        p1 = new Identity("Some player");
        channel = new NullMessageChannel();
        state = {
            players: [ p1 ],
            stacks: [ new Stack(p1.clientId, "hint1") ],
            hints: [ "hint1" ],
            channel: channel
        };

        step = new EndHandler();
    });

    it("execute, completes the state machine", async () => {
        const result = await step.execute(state);

        expect(result.complete).toBe(true);
    });

    it("execute, sends a message to the clients to show the scoreboard", async () => {
        const result = await step.execute(state);

        expect(channel.sentMessages.length).toBe(1);
        expect(channel.sentMessages[0].message.kind).toBe("instruction");
        expect(channel.sentMessages[0].message.type).toBe("show-scores");
        expect(channel.sentMessages[0].message.playerScores).toBeDefined();
    });
});


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}