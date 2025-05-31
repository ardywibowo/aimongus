import {
  Agent,
  AgentPersonality,
  GameEvent,
  GameState,
  Vote,
} from "../types/game";
import { getAIMove } from "../../server/aiAgent";

export class GameManager {
  private gameState: GameState;
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
        suspicions: new Map(
          // Initialize suspicions for all other agents with a small random value
          agents.map((otherAgent) => [
            otherAgent.id,
            Math.random() * 0.1, // Start with a small random suspicion (0-0.1)
          ])
        ),
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

  private addEvent(event: GameEvent) {
    // Add timestamp if not provided
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }
    console.log("Adding event:", {
      type: event.type,
      details: event.details,
      agentId: event.agentId,
      location: event.location,
    });
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
      const aiMove = await getAIMove(agent, this.gameState);
      // Parse aiMove for vote action
      if (aiMove.toLowerCase().startsWith("vote")) {
        // Try to extract target and reason
        const match = aiMove.match(/vote for (.+?) because (.+)/i);
        let targetName = "";
        let reason = aiMove;
        if (match) {
          targetName = match[1].trim();
          reason = match[2].trim();
        }
        const target = this.gameState.agents.find(
          (a) => a.personality.name.toLowerCase() === targetName.toLowerCase()
        );
        if (target) {
          votes.push({
            voterId: agent.id,
            targetId: target.id,
            reason,
          });
          this.addEvent({
            type: "vote",
            timestamp: Date.now(),
            location: "Meeting Room",
            agentId: agent.id,
            targetId: target.id,
            details: reason,
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

    console.log("Starting round", this.gameState.currentRound);

    // Day phase
    this.gameState.phase = "day";
    this.addEvent({
      type: "meeting_called",
      timestamp: Date.now(),
      location: "Ship",
      agentId: "system",
      details: `Round ${this.gameState.currentRound} begins - Day phase starts`,
    });

    // Move agents and update their locations
    this.moveAgents();
    this.updateLastSeenWith();

    // Add movement events for each agent
    for (const agent of this.gameState.agents) {
      if (agent.isAlive) {
        console.log(
          `Agent ${agent.personality.name} moved to ${agent.location}`
        );
        this.addEvent({
          type: "task_complete",
          timestamp: Date.now(),
          location: agent.location,
          agentId: agent.id,
          details: `${agent.personality.name} is moving around in ${agent.location}`,
        });
      }
    }

    // Let agents make decisions
    for (const agent of this.gameState.agents) {
      if (agent.isAlive) {
        console.log(
          `Getting AI move for ${agent.personality.name} (${agent.role})`
        );
        const aiMove = await getAIMove(agent, this.gameState);
        console.log(`AI move for ${agent.personality.name}:`, aiMove);

        // Add the AI's chat message as an event
        this.addEvent({
          type: "chat",
          timestamp: Date.now(),
          location: agent.location,
          agentId: agent.id,
          details: aiMove,
        });

        if (
          aiMove.toLowerCase().startsWith("kill") &&
          agent.role === "imposter"
        ) {
          // Try to extract target
          const match = aiMove.match(/kill (.+)/i);
          let targetName = "";
          if (match) {
            targetName = match[1].trim();
          }
          const target = this.gameState.agents.find(
            (a) =>
              a.isAlive &&
              a.role === "crewmate" &&
              a.personality.name.toLowerCase() === targetName.toLowerCase()
          );
          if (target) {
            console.log(
              `${agent.personality.name} is killing ${target.personality.name}`
            );
            target.isAlive = false;
            this.addEvent({
              type: "kill",
              timestamp: Date.now(),
              location: target.location,
              agentId: agent.id,
              targetId: target.id,
              details: `${agent.personality.name} eliminated ${target.personality.name} in ${target.location}!`,
            });
          }
        } else if (aiMove.toLowerCase().startsWith("task")) {
          console.log(`${agent.personality.name} completed a task`);
          this.addEvent({
            type: "task_complete",
            timestamp: Date.now(),
            location: agent.location,
            agentId: agent.id,
            details: `${agent.personality.name} completed a task in ${agent.location}`,
          });
        }
      }
    }

    // Check if game is over after kills
    if (this.checkGameOver()) {
      this.addEvent({
        type: "meeting_called",
        timestamp: Date.now(),
        location: "Ship",
        agentId: "system",
        details: `Game Over! ${
          this.gameState.winner === "crewmate" ? "Crewmates" : "Imposter"
        } win!`,
      });
      return this.gameState;
    }

    // Voting phase
    this.gameState.phase = "voting";
    this.addEvent({
      type: "meeting_called",
      timestamp: Date.now(),
      location: "Meeting Room",
      agentId: "system",
      details: "Emergency meeting called - Time to vote!",
    });

    // Discussion phase: Each agent makes a statement about who they suspect
    this.gameState.phase = "discussion";
    for (const agent of this.gameState.agents) {
      if (agent.isAlive) {
        // Use the agent's suspicion and observations to generate a statement
        let mostSuspicious: Agent | null = null;
        let highestSuspicion = -1; // Start at -1 to ensure we pick someone even with 0 suspicion

        for (const [agentId, suspicion] of agent.suspicions) {
          const target = this.gameState.agents.find((a) => a.id === agentId);
          if (target && target.isAlive && target.id !== agent.id) {
            if (suspicion > highestSuspicion) {
              mostSuspicious = target;
              highestSuspicion = suspicion;
            }
          }
        }

        // Always make a statement about the most suspicious person
        let statement: string;
        if (mostSuspicious) {
          statement = `I'm voting for ${
            mostSuspicious.personality.name
          } because they have the highest suspicion level (${(
            highestSuspicion * 100
          ).toFixed(0)}%)`;
        } else {
          // If somehow no agents are found (shouldn't happen), pick a random alive agent
          const aliveAgents = this.gameState.agents.filter(
            (a) => a.isAlive && a.id !== agent.id
          );
          const randomTarget =
            aliveAgents[Math.floor(Math.random() * aliveAgents.length)];
          statement = `I'm voting for ${randomTarget.personality.name} because I need to make a decision`;
        }

        this.addEvent({
          type: "chat",
          timestamp: Date.now(),
          location: "Meeting Room",
          agentId: agent.id,
          details: statement,
        });
      }
    }

    // Voting phase resumes
    this.gameState.phase = "voting";
    const votes = await this.runVotingPhase();
    const ejectedAgentId = this.processVotes(votes);

    // Announce who was voted out
    if (ejectedAgentId) {
      const agent = this.gameState.agents.find((a) => a.id === ejectedAgentId);
      if (agent) {
        this.addEvent({
          type: "chat",
          timestamp: Date.now(),
          location: "Meeting Room",
          agentId: "system",
          details: `${agent.personality.name} was voted out and was a ${agent.role}!`,
        });
      }
    }

    // Check if game is over after voting
    if (this.checkGameOver()) {
      this.addEvent({
        type: "meeting_called",
        timestamp: Date.now(),
        location: "Ship",
        agentId: "system",
        details: `Game Over! ${
          this.gameState.winner === "crewmate" ? "Crewmates" : "Imposter"
        } win!`,
      });
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

      const timestamp = new Date(event.timestamp).toLocaleTimeString();

      switch (event.type) {
        case "kill":
          return `[${timestamp}] 🔪 ${agent?.personality.name} eliminated ${target?.personality.name} in ${event.location}!`;
        case "vote":
          if (event.agentId === "system") {
            return `[${timestamp}] 🗳️ ${event.details}`;
          }
          return `[${timestamp}] 🗳️ ${agent?.personality.name} voted for ${target?.personality.name}. Reason: ${event.details}`;
        case "task_complete":
          return `[${timestamp}] ✅ ${event.details}`;
        case "vent_use":
          return `[${timestamp}] 🕳️ ${agent?.personality.name} was seen using vents in ${event.location}!`;
        case "meeting_called":
          return `[${timestamp}] 📢 ${event.details}`;
        case "chat":
          return `[${timestamp}] 💭 ${agent?.personality.name}: ${event.details}`;
        default:
          return `[${timestamp}] ℹ️ ${event.details || ""}`;
      }
    });
  }
}
