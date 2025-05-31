import {
  Agent,
  AgentPersonality,
  GameEvent,
  GameState,
  Vote,
} from "../types/game";
import { AgentAI } from "./agentLogic";

export class GameManager {
  private gameState: GameState;
  private agentAIs: Map<string, AgentAI>;
  private readonly locations = [
    "Cafeteria",
    "Reactor",
    "Navigation",
    "Admin",
    "Storage",
    "MedBay",
  ];

  constructor(numPlayers: number = 8) {
    this.gameState = this.initializeGame(numPlayers);
    this.agentAIs = new Map();
    this.initializeAgentAIs();
  }

  private initializeGame(numPlayers: number): GameState {
    const agents: Agent[] = [];
    const names = [
      "Red",
      "Blue",
      "Green",
      "Yellow",
      "Purple",
      "Orange",
      "Pink",
      "Black",
      "White",
      "Brown",
      "Cyan",
      "Lime",
    ];

    // Create agents with random personalities
    for (let i = 0; i < numPlayers; i++) {
      const personality: AgentPersonality = {
        name: names[i],
        trustLevel: Math.random(),
        skepticismLevel: Math.random(),
        observationSkills: Math.random(),
        communicationStyle: ["direct", "indirect", "analytical", "emotional"][
          Math.floor(Math.random() * 4)
        ] as AgentPersonality["communicationStyle"],
      };

      agents.push({
        id: `agent-${i}`,
        personality,
        role: "crewmate",
        isAlive: true,
        location:
          this.locations[Math.floor(Math.random() * this.locations.length)],
        suspicions: new Map(),
        alibi: null,
        lastSeenWith: [],
      });
    }

    // Randomly select one imposter
    const imposterIndex = Math.floor(Math.random() * numPlayers);
    agents[imposterIndex].role = "imposter";

    return {
      agents,
      events: [],
      currentRound: 1,
      phase: "day",
      gameOver: false,
      winner: null,
    };
  }

  private initializeAgentAIs() {
    for (const agent of this.gameState.agents) {
      this.agentAIs.set(agent.id, new AgentAI(agent, this.gameState));
    }
  }

  private addEvent(event: GameEvent) {
    this.gameState.events.push(event);
  }

  private moveAgents() {
    for (const agent of this.gameState.agents) {
      if (agent.isAlive) {
        agent.location =
          this.locations[Math.floor(Math.random() * this.locations.length)];
      }
    }
  }

  private updateLastSeenWith() {
    const locationGroups = new Map<string, string[]>();

    for (const agent of this.gameState.agents) {
      if (agent.isAlive) {
        const agentsAtLocation = locationGroups.get(agent.location) || [];
        agentsAtLocation.push(agent.id);
        locationGroups.set(agent.location, agentsAtLocation);
      }
    }

    for (const [_, agentIds] of locationGroups) {
      for (const agentId of agentIds) {
        const agent = this.gameState.agents.find((a) => a.id === agentId);
        if (agent) {
          agent.lastSeenWith = agentIds.filter((id) => id !== agentId);
        }
      }
    }
  }

  private async runVotingPhase(): Promise<Vote[]> {
    const votes: Vote[] = [];
    const aliveAgents = this.gameState.agents.filter((a) => a.isAlive);

    for (const agent of aliveAgents) {
      const ai = this.agentAIs.get(agent.id);
      if (ai) {
        const decision = ai.makeDecision();
        if (decision.vote) {
          votes.push(decision.vote);
          this.addEvent({
            type: "vote",
            timestamp: Date.now(),
            location: "Meeting Room",
            agentId: agent.id,
            targetId: decision.vote.targetId,
            details: decision.vote.reason,
          });
        }
      }
    }

    return votes;
  }

  private processVotes(votes: Vote[]): string | null {
    const voteCount = new Map<string, number>();

    for (const vote of votes) {
      const currentCount = voteCount.get(vote.targetId) || 0;
      voteCount.set(vote.targetId, currentCount + 1);
    }

    let maxVotes = 0;
    let ejectedAgentId: string | null = null;

    for (const [agentId, count] of voteCount) {
      if (count > maxVotes) {
        maxVotes = count;
        ejectedAgentId = agentId;
      }
    }

    if (ejectedAgentId) {
      const agent = this.gameState.agents.find((a) => a.id === ejectedAgentId);
      if (agent) {
        agent.isAlive = false;
        this.addEvent({
          type: "vote",
          timestamp: Date.now(),
          location: "Meeting Room",
          agentId: "system",
          targetId: ejectedAgentId,
          details: `${agent.personality.name} was ejected! They were a ${agent.role}!`,
        });
      }
    }

    return ejectedAgentId;
  }

  private checkGameOver(): boolean {
    const aliveCrewmates = this.gameState.agents.filter(
      (a) => a.isAlive && a.role === "crewmate"
    ).length;
    const aliveImposters = this.gameState.agents.filter(
      (a) => a.isAlive && a.role === "imposter"
    ).length;

    if (aliveImposters === 0) {
      this.gameState.gameOver = true;
      this.gameState.winner = "crewmate";
      return true;
    }

    if (aliveImposters >= aliveCrewmates) {
      this.gameState.gameOver = true;
      this.gameState.winner = "imposter";
      return true;
    }

    return false;
  }

  public async runRound(): Promise<GameState> {
    if (this.gameState.gameOver) {
      return this.gameState;
    }

    // Day phase
    this.gameState.phase = "day";
    this.moveAgents();
    this.updateLastSeenWith();

    // Let agents make decisions
    for (const agent of this.gameState.agents) {
      if (agent.isAlive) {
        const ai = this.agentAIs.get(agent.id);
        if (ai) {
          const decision = ai.makeDecision();

          if (decision.action === "kill" && agent.role === "imposter") {
            const target = this.gameState.agents.find(
              (a) => a.isAlive && a.role === "crewmate"
            );
            if (target) {
              target.isAlive = false;
              this.addEvent({
                type: "kill",
                timestamp: Date.now(),
                location: target.location,
                agentId: agent.id,
                targetId: target.id,
                details: `${target.personality.name} was killed!`,
              });
            }
          }
        }
      }
    }

    // Check if game is over after kills
    if (this.checkGameOver()) {
      return this.gameState;
    }

    // Voting phase
    this.gameState.phase = "voting";
    const votes = await this.runVotingPhase();
    this.processVotes(votes);

    // Check if game is over after voting
    if (this.checkGameOver()) {
      return this.gameState;
    }

    this.gameState.currentRound++;
    return this.gameState;
  }

  public getGameState(): GameState {
    return this.gameState;
  }

  public getGameLog(): string[] {
    return this.gameState.events.map((event) => {
      const agent = this.gameState.agents.find((a) => a.id === event.agentId);
      const target = event.targetId
        ? this.gameState.agents.find((a) => a.id === event.targetId)
        : null;

      switch (event.type) {
        case "kill":
          return `${agent?.personality.name} killed ${target?.personality.name} in ${event.location}!`;
        case "vote":
          return `${agent?.personality.name} voted for ${target?.personality.name}. Reason: ${event.details}`;
        case "task_complete":
          return `${agent?.personality.name} completed a task in ${event.location}.`;
        case "vent_use":
          return `${agent?.personality.name} was seen using vents in ${event.location}!`;
        default:
          return event.details || "";
      }
    });
  }
}
