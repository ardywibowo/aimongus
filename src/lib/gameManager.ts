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
      let voted = false;
      let attempts = 0;
      const maxAttempts = 3; // Maximum number of attempts to get a valid vote
      
      while (!voted && attempts < maxAttempts) {
        attempts++;
        const aiMove = await getAIMove(agent, this.gameState);
        console.log(`Agent ${agent.personality.name} (${agent.role}) move:`, aiMove);

        // Try to parse different vote formats
        let targetName = "";
        let reason = "";

        // Check for skip vote first
        if (aiMove.toLowerCase().includes("skip") || aiMove.toLowerCase().includes("no vote")) {
          console.log(`Agent ${agent.personality.name} chose to skip voting`);
          votes.push({
            voterId: agent.id,
            reason: "Not enough evidence to vote for anyone",
            skipped: true,
          });
          voted = true;
          continue;
        }

        // Format 1: "vote for X because Y"
        let match = aiMove.match(/vote (?:for|to eject|to vote for) ([^\s,.]+)(?: because |: | - |\n)([\s\S]*)/i);

        // Format 2: "I vote for X because Y"
        if (!match) {
          match = aiMove.match(/(?:I )?(?:will )?vote (?:for|to eject|to vote for) ([^\s,.]+)(?: because |: | - |\n)?([\s\S]*)/i);
        }

        // Format 3: Just the target name
        if (!match) {
          // Try to find any agent name in the response
          for (const a of this.gameState.agents) {
            if (a.id !== agent.id && aiMove.toLowerCase().includes(a.personality.name.toLowerCase())) {
              targetName = a.personality.name;
              reason = `Suspicious behavior`;
              break;
            }
          }
        } else {
          targetName = match[1].trim();
          reason = (match[2] || 'Suspicious behavior').trim();
        }
        
        // If we have a target name, try to find the agent
        if (targetName) {
          // Find target, excluding self
          const target = this.gameState.agents.find(
            (a) => a.isAlive && 
                  a.id !== agent.id && 
                  a.personality.name.toLowerCase().includes(targetName.toLowerCase())
          );
          
          if (target) {
            // Include recent discussion points in the vote reason
            const recentDiscussions = this.gameState.events
              .filter(e => e.type === "chat" && e.timestamp > Date.now() - 10000)
              .map(e => e.details);

            let voteReason = reason;
            if (recentDiscussions.length > 0) {
              voteReason += ` (${recentDiscussions.slice(-3).join(" ")})`;
            }

            console.log(`Agent ${agent.personality.name} voting for ${target.personality.name} because: ${voteReason}`);
            
            votes.push({
              voterId: agent.id,
              targetId: target.id,
              reason: voteReason,
              skipped: false,
            });
            
            this.addEvent({
              type: "vote",
              timestamp: Date.now(),
              location: "Meeting Room",
              agentId: agent.id,
              targetId: target.id,
              details: voteReason,
            });
            
            voted = true; // Successfully voted
          } else {
            console.log(`Could not find target agent: ${targetName}`);
          }
        } else {
          console.log(`No valid vote from ${agent.personality.name} (attempt ${attempts}): ${aiMove}`);
        }
      }
      
      // If we couldn't get a valid vote after max attempts, assign a random vote
      if (!voted) {
        console.log(`Assigning random vote for ${agent.personality.name} after ${maxAttempts} failed attempts`);
        const possibleTargets = aliveAgents.filter(a => a.id !== agent.id);
        if (possibleTargets.length > 0) {
          const randomTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
          const defaultReason = `Couldn't decide, voting randomly for ${randomTarget.personality.name}`;
          
          votes.push({
            voterId: agent.id,
            targetId: randomTarget.id,
            reason: defaultReason,
            skipped: false,
          });
          
          this.addEvent({
            type: "vote",
            timestamp: Date.now(),
            location: "Meeting Room",
            agentId: agent.id,
            targetId: randomTarget.id,
            details: defaultReason,
          });
        } else {
          console.error(`No valid voting targets for ${agent.personality.name}`);
        }
      }
    } // End of for loop
    
    return votes;
  }

  private getAgentObservations(agent: Agent): string[] {
    const observations: string[] = [];
    const recentEvents = this.gameState.events
      .filter((e) => e.timestamp > Date.now() - 10000)
      .filter((e) => e.type !== "vote" && e.type !== "chat");

    for (const event of recentEvents) {
      if (event.agentId === agent.id || event.targetId === agent.id) {
        switch (event.type) {
          case "kill":
            if (event.agentId === agent.id) {
              observations.push(`I saw a body near ${event.location}`);
            } else {
              observations.push(`I heard a kill sound near ${event.location}`);
            }
            break;
          case "vent_use":
            observations.push(`I saw someone using vents near ${event.location}`);
            break;
          case "task_complete":
            observations.push(`I completed a task in ${event.location}`);
            break;
        }
      }
    }

    // Add observations about other agents
    for (const otherAgent of this.gameState.agents) {
      if (otherAgent.id !== agent.id && otherAgent.isAlive) {
        const lastSeen = otherAgent.lastSeenWith.includes(agent.id);
        if (lastSeen) {
          observations.push(`I was last seen with ${otherAgent.personality.name}`);
        }
      }
    }

    return observations;
  }

  private processVotes(votes: Vote[]): string | null {
    const voteCount = new Map<string, number>();
    let skipVotes = 0;

    for (const vote of votes) {
      if (vote.skipped) {
        skipVotes++;
        continue;
      }
      if (vote.targetId) {
        const currentCount = voteCount.get(vote.targetId) || 0;
        voteCount.set(vote.targetId, currentCount + 1);
      }
    }

    // If more than half of the players skipped, no one is ejected
    if (skipVotes > votes.length / 2) {
      this.addEvent({
        type: 'vote',
        timestamp: Date.now(),
        location: 'Meeting Room',
        agentId: 'system',
        details: 'The majority chose to skip voting. No one was ejected!',
      });
      return null;
    }

    let maxVotes = 0;
    let ejectedAgentId: string | null = null;

    for (const [agentId, count] of voteCount) {
      if (count > maxVotes) {
        maxVotes = count;
        ejectedAgentId = agentId;
      } else if (count === maxVotes) {
        // In case of a tie, no one is ejected
        ejectedAgentId = null;
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

    // Discussion phase
    this.gameState.phase = "discussion";
    this.addEvent({
      type: "meeting_called",
      timestamp: Date.now(),
      location: "Meeting Room",
      agentId: "system",
      details: "Discussion phase begins - Share your thoughts!",
    });

    // Let agents share their observations
    for (const agent of this.gameState.agents) {
      if (agent.isAlive) {
        const observations = this.getAgentObservations(agent);
        if (observations.length > 0) {
          const observation = observations[Math.floor(Math.random() * observations.length)];
          this.addEvent({
            type: "chat",
            timestamp: Date.now(),
            location: "Meeting Room",
            agentId: agent.id,
            details: observation
          });
        }
      }
    }

    // Voting phase
    this.gameState.phase = "voting";
    this.addEvent({
      type: "meeting_called",
      timestamp: Date.now(),
      location: "Meeting Room",
      agentId: "system",
      details: "Voting phase begins - Time to cast your vote!",
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

        // Use AI to generate a voting statement
        let statement: string;
        try {
          // Get AI's voting decision
          const aiResponse = await getAIMove(agent, this.gameState);
          
          // Clean up the response to ensure it's a proper voting statement
          if (aiResponse.toLowerCase().includes('skip') || aiResponse.toLowerCase().includes('not sure')) {
            statement = aiResponse;
          } else if (aiResponse.toLowerCase().includes('vote for')) {
            statement = aiResponse;
          } else if (mostSuspicious) {
            // Fallback if AI response doesn't specify a vote
            statement = `${aiResponse} I'm voting for ${mostSuspicious.personality.name}.`;
          } else {
            statement = aiResponse;
          }
        } catch (error) {
          console.error('Error getting AI vote:', error);
          // Fallback to simple statement if AI fails
          if (mostSuspicious) {
            statement = `I think ${mostSuspicious.personality.name} is suspicious.`;
          } else {
            statement = "I'm not sure who to vote for.";
          }
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

    // Announce voting results
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
    } else {
      this.addEvent({
        type: "chat",
        timestamp: Date.now(),
        location: "Meeting Room",
        agentId: "system",
        details: "No one received enough votes to be ejected.",
      });
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
