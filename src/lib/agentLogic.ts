import { Agent, GameState, Vote } from "../types/game";

export class AgentAI {
  private agent: Agent;
  private gameState: GameState;

  constructor(agent: Agent, gameState: GameState) {
    this.agent = agent;
    this.gameState = gameState;
  }

  private calculateSuspicion(targetAgent: Agent): number {
    let suspicion = 0;
    const personality = this.agent.personality;

    // Analyze events involving the target
    const relevantEvents = this.gameState.events.filter(
      (event) =>
        event.agentId === targetAgent.id || event.targetId === targetAgent.id
    );

    // Check for suspicious behavior
    for (const event of relevantEvents) {
      switch (event.type) {
        case "vent_use":
          suspicion += 10;
          break;
        case "kill":
          if (event.agentId === targetAgent.id) {
            suspicion += 1.0;
          }
          break;
        case "task_complete":
          suspicion -= 0.2; // Completing tasks reduces suspicion
          break;
      }
    }

    // Consider personality traits
    suspicion *= 1 + personality.skepticismLevel;

    // Consider trust level
    if (this.agent.suspicions.has(targetAgent.id)) {
      const previousSuspicion = this.agent.suspicions.get(targetAgent.id) || 0;
      suspicion = (suspicion + previousSuspicion) / 2;
    }

    return Math.min(Math.max(suspicion, 0), 1);
  }

  private generateAlibi(): string {
    const locations = [
      "Cafeteria",
      "Reactor",
      "Navigation",
      "Admin",
      "Storage",
      "MedBay",
    ];
    const randomLocation =
      locations[Math.floor(Math.random() * locations.length)];
    const randomTime = Math.floor(Math.random() * 10);

    return `I was in ${randomLocation} about ${randomTime} minutes ago.`;
  }

  private analyzeEvents(): string[] {
    const observations: string[] = [];
    const recentEvents = this.gameState.events.slice(-5);

    for (const event of recentEvents) {
      if (event.type === "kill") {
        const killer = this.gameState.agents.find(
          (a) => a.id === event.agentId
        );
        const victim = this.gameState.agents.find(
          (a) => a.id === event.targetId
        );
        if (killer && victim) {
          observations.push(
            `I saw ${killer.personality.name} near ${victim.personality.name} before they died.`
          );
        }
      } else if (event.type === "vent_use") {
        const user = this.gameState.agents.find((a) => a.id === event.agentId);
        if (user) {
          observations.push(
            `I think I saw ${user.personality.name} acting suspiciously near the vents.`
          );
        }
      }
    }

    return observations;
  }

  public makeDecision(): { action: string; vote?: Vote; statement?: string } {
    if (!this.agent.isAlive) {
      return { action: "dead" };
    }

    if (this.agent.role === "imposter") {
      return this.makeImposterDecision();
    }

    return this.makeCrewmateDecision();
  }

  private makeImposterDecision(): {
    action: string;
    vote?: Vote;
    statement?: string;
  } {
    const aliveCrewmates = this.gameState.agents.filter(
      (a) => a.isAlive && a.role === "crewmate"
    );

    if (aliveCrewmates.length === 0) {
      return { action: "win" };
    }

    // Decide whether to kill or blend in
    const shouldKill = Math.random() < 0.3; // 30% chance to kill each round
    if (shouldKill) {
      return {
        action: "kill",
        statement: `I'm going to ${this.generateAlibi()}`,
      };
    }

    // Blend in by voting for someone else
    const suspiciousAgents = this.gameState.agents.filter(
      (a) => a.isAlive && a.id !== this.agent.id
    );
    const voteTarget =
      suspiciousAgents[Math.floor(Math.random() * suspiciousAgents.length)];

    return {
      action: "vote",
      vote: {
        voterId: this.agent.id,
        targetId: voteTarget.id,
        reason: `I haven't seen ${voteTarget.personality.name} doing any tasks.`,
      },
      statement: this.generateAlibi(),
    };
  }

  private makeCrewmateDecision(): {
    action: string;
    vote?: Vote;
    statement?: string;
  } {
    // Update suspicions for all agents
    for (const otherAgent of this.gameState.agents) {
      if (otherAgent.id !== this.agent.id) {
        const suspicion = this.calculateSuspicion(otherAgent);
        this.agent.suspicions.set(otherAgent.id, suspicion);
      }
    }

    // Find the most suspicious agent
    let mostSuspicious: Agent | null = null;
    let highestSuspicion = 0;

    for (const [agentId, suspicion] of this.agent.suspicions) {
      if (suspicion > highestSuspicion) {
        const agent = this.gameState.agents.find((a) => a.id === agentId);
        if (agent && agent.isAlive) {
          mostSuspicious = agent;
          highestSuspicion = suspicion;
        }
      }
    }

    const observations = this.analyzeEvents();
    const statement =
      observations.length > 0
        ? observations[Math.floor(Math.random() * observations.length)]
        : this.generateAlibi();

    // Check if we're in an emergency meeting
    const isEmergencyMeeting = this.gameState.events.some(
      (event) => event.type === "meeting_called"
    );

    // During emergency meetings, we MUST vote for someone
    if (isEmergencyMeeting) {
      // If we have a most suspicious agent, vote for them
      if (mostSuspicious) {
        return {
          action: "vote",
          vote: {
            voterId: this.agent.id,
            targetId: mostSuspicious.id,
            reason: `I'm voting for ${mostSuspicious.personality.name} because ${statement}`,
          },
          statement,
        };
      }

      // If we don't have a suspicious agent, vote for a random alive agent
      const aliveAgents = this.gameState.agents.filter(
        (a) => a.isAlive && a.id !== this.agent.id
      );
      if (aliveAgents.length > 0) {
        const randomTarget =
          aliveAgents[Math.floor(Math.random() * aliveAgents.length)];
        return {
          action: "vote",
          vote: {
            voterId: this.agent.id,
            targetId: randomTarget.id,
            reason: `I need to vote for someone, and I haven't seen ${randomTarget.personality.name} doing tasks.`,
          },
          statement: "I need to make a decision based on what I've seen.",
        };
      }
    }

    // Outside of emergency meetings, use normal voting behavior
    if (mostSuspicious && highestSuspicion > 0.6) {
      return {
        action: "vote",
        vote: {
          voterId: this.agent.id,
          targetId: mostSuspicious.id,
          reason: `I'm suspicious of ${mostSuspicious.personality.name} because ${statement}`,
        },
        statement,
      };
    }

    return {
      action: "task",
      statement,
    };
  }
}
