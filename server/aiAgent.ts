import { OpenAIApi, Configuration } from "openai";
import { Agent, GameState } from "../src/types/game";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export async function getAIMove(
  agent: Agent,
  gameState: GameState
): Promise<string> {
  // Prepare a prompt for the agent
  const prompt = `
You are playing an Among Us-like game as the following agent:
${JSON.stringify(agent, null, 2)}

Here is the full game state:
${JSON.stringify(gameState, null, 2)}

Based on your role and everything that has happened so far, what is your next move? Reply with one of: "kill", "vote", "task", or "skip". If you choose "vote", specify who you vote for and why. If you choose "kill", specify who you want to kill. If you choose "task", specify what task you want to do. If you choose "skip", explain why.`;

  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are an AI agent in an Among Us game." },
      { role: "user", content: prompt },
    ],
    max_tokens: 200,
    temperature: 0.7,
  });

  return response.data.choices[0].message?.content?.trim() || "skip";
}
