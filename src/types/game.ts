export type AgentRole = "crewmate" | "imposter";

export type AgentPersonality = {
  name: string;
  trustLevel: number; // 0-1, how much they trust others
  skepticismLevel: number; // 0-1, how skeptical they are of others
  observationSkills: number; // 0-1, how good they are at noticing details
  communicationStyle: "direct" | "indirect" | "analytical" | "emotional";
};

export type Agent = {
  id: string;
  personality: AgentPersonality;
  role: AgentRole;
  isAlive: boolean;
  location: string;
  suspicions: Map<string, number>; // Map of agent ID to suspicion level (0-1)
  alibi: string | null;
  lastSeenWith: string[]; // IDs of agents last seen with
};

export type GameEvent = {
  type: "kill" | "task_complete" | "vent_use" | "meeting_called" | "vote";
  timestamp: number;
  location: string;
  agentId: string;
  targetId?: string;
  details?: string;
};

export type GameState = {
  agents: Agent[];
  events: GameEvent[];
  currentRound: number;
  phase: "discussion" | "voting" | "night" | "day";
  gameOver: boolean;
  winner: AgentRole | null;
};

export type Vote = {
  voterId: string;
  targetId: string;
  reason: string;
};
