import "dotenv/config";
import OpenAI from "openai";
import { Agent, GameState, GameEvent } from "../src/types/game";

console.log("Environment variables:", {
  hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  nodeEnv: process.env.NODE_ENV,
  dotenvLoaded: !!process.env.DOTENV_LOADED,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface AgentAnalysis {
  name: string;
  suspicion: number;
  suspiciousBehaviors: number;
  taskCompletions: number;
  trustScore: number;
  recentEvents: Array<{
    type: string;
    actor?: string;
    target?: string;
    location: string;
    details?: string;
    timestamp: number;
  }>;
}

async function generateDiscussionResponse(
  agent: Agent,
  gameState: GameState,
  recentEvents: GameEvent[],
  agentAnalyses: AgentAnalysis[]
): Promise<string> {
  try {
    // Format recent events for context
    const formattedEvents = recentEvents
      .map(event => {
        const actor = gameState.agents.find(a => a.id === event.agentId);
        const target = event.targetId ? gameState.agents.find(a => a.id === event.targetId) : null;
        let eventText = `[${new Date(event.timestamp).toLocaleTimeString()}] `;
        
        switch (event.type) {
          case 'kill':
            eventText += `🔪 ${actor?.personality.name} eliminated ${target?.personality.name}`;
            break;
          case 'vent_use':
            eventText += `🕳️ ${actor?.personality.name} used vents in ${event.location}`;
            break;
          case 'task_complete':
            eventText += `✅ ${actor?.personality.name} completed a task in ${event.location}`;
            break;
          case 'chat':
            eventText += `💭 ${actor?.personality.name}: ${event.details}`;
            break;
          case 'vote':
            eventText += `🗳️ ${actor?.personality.name} voted to eject ${target?.personality.name}`;
            break;
          default:
            eventText += event.details || 'Something happened';
        }
        return eventText;
      })
      .join('\n');

    // Format agent analyses for context
    const formattedAnalyses = agentAnalyses
      .slice(0, 3) // Top 3 most suspicious
      .map((analysis, index) => 
        `${index + 1}. ${analysis.name} (Suspicion: ${Math.round(analysis.trustScore * 100)}%): ` +
        `${analysis.suspiciousBehaviors} suspicious behaviors, ${analysis.taskCompletions} tasks completed`
      )
      .join('\n');

    const prompt = `You are ${agent.personality.name} in an Among Us game. Your role is ${agent.role}.

Recent events in the game:
${formattedEvents}

Current suspicions (lower % means more suspicious):
${formattedAnalyses}

Your personality:
- Trust level: ${Math.round(agent.personality.trustLevel * 100)}%
- Skepticism level: ${Math.round(agent.personality.skepticismLevel * 100)}%
- Communication style: ${agent.personality.communicationStyle}

It's discussion time. Share your thoughts on who might be the imposter based on the evidence. ` +
    `Be concise but provide reasoning. If you're not sure, say so. ` +
    `Mention specific behaviors you find suspicious.\n\n` +
    `${agent.personality.name}:`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are participating in a discussion to find the imposter. " +
                  "Be observant, logical, and consider all possibilities. " +
                  "Your responses should be 1-2 sentences max."
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 100,
      temperature: 0.8,
    });

    return response.choices[0]?.message?.content?.trim() || "I'm not sure what to think yet.";
  } catch (error) {
    console.error("Error generating discussion response:", error);
    return "I'm still thinking about what happened...";
  }
}

export async function getAIMove(
  agent: Agent,
  gameState: GameState
): Promise<string> {
  // Calculate suspicions for all agents
  for (const otherAgent of gameState.agents) {
    if (otherAgent.id !== agent.id) {
      let suspicion = 0;
      const personality = agent.personality;

      // Analyze events involving the target
      const relevantEvents = gameState.events.filter(
        (event) =>
          event.agentId === otherAgent.id || event.targetId === otherAgent.id
      );

      // Check for suspicious behavior
      for (const event of relevantEvents) {
        switch (event.type) {
          case "vent_use":
            suspicion += 10;
            break;
          case "kill":
            if (event.agentId === otherAgent.id) {
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
      if (agent.suspicions.has(otherAgent.id)) {
        const previousSuspicion = agent.suspicions.get(otherAgent.id) || 0;
        suspicion = (suspicion + previousSuspicion) / 2;
      }

      // Update suspicion in the Map
      agent.suspicions.set(otherAgent.id, Math.min(Math.max(suspicion, 0), 1));
    }
  }

  // Check if we're in an emergency meeting
  const isEmergencyMeeting =
    gameState.phase === "voting" || gameState.phase === "discussion";

  // During emergency meetings, we'll use OpenAI to generate more natural discussions and voting decisions
  if (isEmergencyMeeting) {
    // Get recent events for context (last 15 events or all if fewer)
    const recentEvents = gameState.events
      .slice(-15)
      .filter(e => e.timestamp > Date.now() - 300000); // Only last 5 minutes

    // Format events for analysis
    const formattedRecentEvents = recentEvents.map(e => {
      const actor = gameState.agents.find(a => a.id === e.agentId);
      const target = e.targetId ? gameState.agents.find(a => a.id === e.targetId) : null;
      return {
        type: e.type,
        actor: actor?.personality.name,
        target: target?.personality.name,
        location: e.location,
        details: e.details,
        timestamp: e.timestamp
      };
    });

    // Get list of alive agents (excluding self)
    const aliveAgents = gameState.agents.filter(a => a.isAlive && a.id !== agent.id);

    // Analyze each agent's behavior
    const agentAnalyses: AgentAnalysis[] = aliveAgents.map(target => {
      const suspicion = agent.suspicions.get(target.id) || 0;
      const eventsInvolving = formattedRecentEvents.filter(
        e => e.actor === target.personality.name || e.target === target.personality.name
      );
      
      // Count suspicious behaviors
      const suspiciousBehaviors = eventsInvolving.filter(e => 
        e.type === 'vent_use' || 
        (e.type === 'kill' && e.actor === target.personality.name)
      ).length;

      // Count task completions (reduces suspicion)
      const taskCompletions = eventsInvolving.filter(e => 
        e.type === 'task_complete' && e.actor === target.personality.name
      ).length;

      // Calculate trust score (lower is more suspicious)
      const trustScore = Math.max(0.1, 1 - (suspicion * 0.8 + suspiciousBehaviors * 0.1 - taskCompletions * 0.05));
      
      return {
        name: target.personality.name,
        suspicion,
        suspiciousBehaviors,
        taskCompletions,
        trustScore,
        recentEvents: eventsInvolving
      };
    });

    // Sort by trust score (ascending - most suspicious first)
    agentAnalyses.sort((a, b) => a.trustScore - b.trustScore);

    // If in discussion phase, generate a discussion response
    if (gameState.phase === 'discussion') {
      return await generateDiscussionResponse(agent, gameState, recentEvents, agentAnalyses);
    }
    
    // In voting phase, make a final decision using AI
    if (agentAnalyses.length > 0) {
      try {
        // Format the prompt for the voting decision
        const topSuspects = agentAnalyses.slice(0, 3);
        const prompt = `You are ${agent.personality.name} in an Among Us game. It's time to vote. Here's what you know:

Top suspicious players:
${topSuspects.map((suspect, i) => 
  `${i + 1}. ${suspect.name} (Suspicion: ${Math.round(suspect.trustScore * 100)}%): ` +
  `${suspect.suspiciousBehaviors} suspicious behaviors, ${suspect.taskCompletions} tasks completed`
).join('\n')}

Recent events:
${recentEvents
  .slice(-5)
  .map(e => {
    const actor = gameState.agents.find(a => a.id === e.agentId);
    const targetAgent = e.targetId ? gameState.agents.find(a => a.id === e.targetId) : null;
    const actorName = actor?.personality.name || 'Someone';
    const targetName = targetAgent?.personality.name || 'someone';
    
    switch(e.type) {
      case 'kill':
        return `- ${actorName} eliminated ${targetName} in ${e.location}`;
      case 'vent_use':
        return `- ${actorName} was seen using vents in ${e.location}`;
      case 'task_complete':
        return `- ${actorName} completed a task in ${e.location}`;
      case 'chat':
        return `- ${actorName} said: "${e.details}"`;
      default:
        return `- ${e.details || 'Something happened'}`;
    }
  })
  .join('\n')}

Your personality:
- Trust level: ${Math.round(agent.personality.trustLevel * 100)}%
- Skepticism level: ${Math.round(agent.personality.skepticismLevel * 100)}%
- Communication style: ${agent.personality.communicationStyle}

It's time to vote. You can:
1. Vote to eject someone (name them specifically)
2. Skip voting if you're not sure

${agent.personality.name}: I`;

        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are voting in an Among Us game. Be decisive but thoughtful. " +
                      "If you're not sure, it's okay to skip. Keep your response to 1-2 sentences max."
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 100,
          temperature: 0.7,
        });

        const decision = response.choices[0]?.message?.content?.trim() || 
          `I'm not sure who to vote for. I choose to skip.`;
        
        return decision;
      } catch (error) {
        console.error("Error generating vote decision:", error);
        return "I need more time to think about this...";
      }
    }
  }

  // For non-emergency meeting phases, use the original logic
  if (!process.env.OPENAI_API_KEY) {
    console.error("OpenAI API key not found in environment variables");
    // Fallback to a simple decision for testing
    if (agent.role === "imposter") {
      const aliveCrewmates = gameState.agents.filter(
        (a) => a.isAlive && a.role === "crewmate"
      );
      if (aliveCrewmates.length > 0) {
        const target =
          aliveCrewmates[Math.floor(Math.random() * aliveCrewmates.length)];
        return Math.random() < 0.3 ? `kill ${target.personality.name}` : "task";
      }
      return "task";
    }
    return "task";
  }

  // Check if we're in voting phase
  const isVotingPhase = gameState.phase === 'voting';
  
  // Prepare a prompt for the agent
  const prompt = `
You are playing an Among Us-like game as the following agent:
${JSON.stringify(agent, null, 2)}

Current Phase: ${gameState.phase}

Here is the full game state:
${JSON.stringify(gameState, null, 2)}

${isVotingPhase ? 
  'You MUST vote for someone to eject. Consider who has been suspicious and who you can trust. ' +
  'Format your response as: "vote for [player name] because [reason]"' :
  'Based on your role and everything that has happened so far, what is your next move? ' +
  'Reply with one of: "kill", "vote", "task", or "skip". ' +
  'If you choose "vote", specify who you vote for and why. ' +
  'If you choose "kill", specify who you want to kill. ' +
  'If you choose "task", specify what task you want to do. ' +
  'If you choose "skip", explain why.'}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an AI agent in an Among Us game." },
        { role: "user", content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    return response.choices[0].message?.content?.trim() || "task";
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    // Fallback to simple decision if API call fails
    if (agent.role === "imposter") {
      const aliveCrewmates = gameState.agents.filter(
        (a) => a.isAlive && a.role === "crewmate"
      );
      if (aliveCrewmates.length > 0) {
        const target =
          aliveCrewmates[Math.floor(Math.random() * aliveCrewmates.length)];
        return Math.random() < 0.3 ? `kill ${target.personality.name}` : "task";
      }
    }
    return "task";
  }
}
