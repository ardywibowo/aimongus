import "dotenv/config";
import OpenAI from "openai";
import { Agent, GameState } from "../src/types/game";

console.log("Environment variables:", {
  hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  nodeEnv: process.env.NODE_ENV,
  dotenvLoaded: !!process.env.DOTENV_LOADED,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function getAIMove(
  agent: Agent,
  gameState: GameState
): Promise<string> {
  // Check if we're in an emergency meeting
  const isEmergencyMeeting =
    gameState.phase === "voting" || gameState.phase === "discussion";

  // During emergency meetings, we MUST vote
  if (isEmergencyMeeting) {
    // Find the most suspicious agent
    let mostSuspicious: Agent | null = null;
    let highestSuspicion = -1; // Start at -1 to ensure we pick someone even with 0 suspicion

    for (const [agentId, suspicion] of agent.suspicions) {
      const target = gameState.agents.find((a) => a.id === agentId);
      if (target && target.isAlive && target.id !== agent.id) {
        if (suspicion > highestSuspicion) {
          mostSuspicious = target;
          highestSuspicion = suspicion;
        }
      }
    }

    // If we found any agent (even with 0 suspicion), vote for them
    if (mostSuspicious) {
      return `vote for ${mostSuspicious.personality.name} because they have the highest suspicion level`;
    }

    // If somehow no agents are found (shouldn't happen), pick a random alive agent
    const aliveAgents = gameState.agents.filter(
      (a) => a.isAlive && a.id !== agent.id
    );
    if (aliveAgents.length > 0) {
      const randomTarget =
        aliveAgents[Math.floor(Math.random() * aliveAgents.length)];
      return `vote for ${randomTarget.personality.name} because I need to make a decision`;
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

  // Prepare a prompt for the agent
  const prompt = `
You are playing an Among Us-like game as the following agent:
${JSON.stringify(agent, null, 2)}

Here is the full game state:
${JSON.stringify(gameState, null, 2)}

Based on your role and everything that has happened so far, what is your next move? Reply with one of: "kill", "vote", "task", or "skip". If you choose "vote", specify who you vote for and why. If you choose "kill", specify who you want to kill. If you choose "task", specify what task you want to do. If you choose "skip", explain why.`;

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
