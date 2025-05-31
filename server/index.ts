import { config } from "dotenv";
import path from "path";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { GameManager } from "../src/lib/gameManager";

// Load environment variables from .env file
const envPath = path.resolve(__dirname, ".env");
const result = config({ path: envPath });

console.log("Environment loading status:", {
  hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  nodeEnv: process.env.NODE_ENV,
  dotenvLoaded: result.parsed !== undefined,
  envPath,
  error: result.error,
});

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
    ],
    methods: ["GET", "POST"],
  },
});

const gameManager = new GameManager(8);
let gameInterval: NodeJS.Timeout | null = null;

// Game state update interval (in milliseconds)
const UPDATE_INTERVAL = 10000;

io.on("connection", (socket) => {
  console.log("Client connected");

  // Handle initial state request
  socket.on("requestInitialState", () => {
    console.log("Received request for initial state");
    const initialState = gameManager.getGameState();
    const initialLog = gameManager.getGameLog();
    console.log("Sending initial state:", {
      stateEvents: initialState.events.length,
      logEntries: initialLog.length,
      events: initialState.events,
      log: initialLog,
    });
    socket.emit("gameState", initialState);
    socket.emit("gameLog", initialLog);
  });

  // Handle game control commands
  socket.on("startGame", () => {
    console.log("Received startGame event");
    if (gameInterval) {
      console.log("Game already running, ignoring startGame");
      return;
    }

    console.log("Starting new game with 8 agents...");
    // Reset game manager to ensure clean state
    const newGameManager = new GameManager(8);
    Object.assign(gameManager, newGameManager);

    // Add initial game start event
    const initialState = gameManager.getGameState();
    initialState.events.push({
      type: "meeting_called",
      timestamp: Date.now(),
      location: "Ship",
      agentId: "system",
      details: "Game started! Crewmates and Imposter are ready.",
    });

    // Send initial state immediately
    const initialLog = gameManager.getGameLog();
    console.log("Sending initial game state:", {
      eventsCount: initialState.events.length,
      logEntries: initialLog.length,
      events: initialState.events,
      log: initialLog,
    });
    io.emit("gameState", initialState);
    io.emit("gameLog", initialLog);

    gameInterval = setInterval(async () => {
      console.log("--- Starting new round ---");
      const newState = await gameManager.runRound();
      const gameLog = gameManager.getGameLog();

      console.log("Round completed, sending updates:", {
        round: newState.currentRound,
        phase: newState.phase,
        eventsCount: newState.events.length,
        logEntries: gameLog.length,
        latestEvents: newState.events.slice(-3),
        latestLogEntries: gameLog.slice(-3),
        hasEvents: newState.events.length > 0,
        hasLogEntries: gameLog.length > 0,
      });

      // Emit updates to all clients
      io.emit("gameState", newState);
      io.emit("gameLog", gameLog);

      if (newState.gameOver) {
        if (gameInterval) {
          clearInterval(gameInterval);
          gameInterval = null;
          console.log("Game loop stopped - game over");
        }
      }
    }, UPDATE_INTERVAL);
    console.log("Game loop started (gameInterval set)");
  });

  socket.on("stopGame", () => {
    console.log("Received stopGame event");
    if (gameInterval) {
      clearInterval(gameInterval);
      gameInterval = null;
      console.log("Game loop stopped by user request");

      // Update game state to reflect stopped state
      const currentState = gameManager.getGameState();
      currentState.phase = "day"; // Reset to day phase

      // Add a game stopped event
      currentState.events.push({
        type: "meeting_called",
        timestamp: Date.now(),
        location: "Ship",
        agentId: "system",
        details: "Game stopped by user request.",
      });

      // Send updated state to all clients
      io.emit("gameState", currentState);
      io.emit("gameLog", gameManager.getGameLog());
    }
  });

  socket.on("resetGame", () => {
    console.log("Received resetGame event");
    if (gameInterval) {
      clearInterval(gameInterval);
      gameInterval = null;
      console.log("Game loop stopped for reset");
    }
    const newGameManager = new GameManager(8);
    Object.assign(gameManager, newGameManager);
    const resetState = gameManager.getGameState();
    const resetLog = gameManager.getGameLog();
    console.log("Game reset, sending new state and log:", {
      stateEvents: resetState.events.length,
      logEntries: resetLog.length,
    });
    io.emit("gameState", resetState);
    io.emit("gameLog", resetLog);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
