import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { GameManager } from "../src/lib/gameManager";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3003"],
    methods: ["GET", "POST"],
  },
});

const gameManager = new GameManager(8);
let gameInterval: NodeJS.Timeout | null = null;

// Game state update interval (in milliseconds)
const UPDATE_INTERVAL = 1000;

io.on("connection", (socket) => {
  console.log("Client connected");

  // Send initial game state
  socket.emit("gameState", gameManager.getGameState());
  socket.emit("gameLog", gameManager.getGameLog());

  // Handle game control commands
  socket.on("startGame", () => {
    if (gameInterval) return;

    gameInterval = setInterval(async () => {
      const newState = await gameManager.runRound();
      const gameLog = gameManager.getGameLog();

      // Broadcast game state and log to all clients
      io.emit("gameState", newState);
      io.emit("gameLog", gameLog);

      if (newState.gameOver) {
        if (gameInterval) {
          clearInterval(gameInterval);
          gameInterval = null;
        }
      }
    }, UPDATE_INTERVAL);
  });

  socket.on("stopGame", () => {
    if (gameInterval) {
      clearInterval(gameInterval);
      gameInterval = null;
    }
  });

  socket.on("resetGame", () => {
    if (gameInterval) {
      clearInterval(gameInterval);
      gameInterval = null;
    }
    const newGameManager = new GameManager(8);
    Object.assign(gameManager, newGameManager);
    io.emit("gameState", gameManager.getGameState());
    io.emit("gameLog", []);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
