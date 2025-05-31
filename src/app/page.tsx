"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { GameState } from "../types/game";
import GameMap from "../components/GameMap";
import { motion } from "framer-motion";

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const gameLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io("http://localhost:3001");
    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      console.log("Connected to server");
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      console.log("Disconnected from server");
      setIsConnected(false);
    });

    socketInstance.on("gameState", (newState) => {
      console.log("Received game state update:", {
        round: newState.currentRound,
        phase: newState.phase,
        eventsCount: newState.events.length,
        latestEvents: newState.events.slice(-3),
        hasEvents: newState.events.length > 0,
        events: newState.events,
      });
      setGameState(newState);
    });

    socketInstance.on("gameLog", (newLog) => {
      console.log("Received game log update:", {
        logLength: newLog.length,
        latestEntries: newLog.slice(-3),
        hasEntries: newLog.length > 0,
        log: newLog,
      });
      // Ensure we're setting a new array to trigger re-render
      setGameLog([...newLog]);
    });

    // Request initial game state and log
    socketInstance.emit("requestInitialState");

    return () => {
      console.log("Cleaning up socket connection");
      socketInstance.disconnect();
    };
  }, []);

  // Add a separate effect to monitor game log changes
  useEffect(() => {
    console.log("Game log state changed:", {
      logLength: gameLog.length,
      latestEntries: gameLog.slice(-3),
      hasEntries: gameLog.length > 0,
      log: gameLog,
    });
  }, [gameLog]);

  // Add effect to scroll to bottom when game log updates
  useEffect(() => {
    if (gameLogRef.current) {
      gameLogRef.current.scrollTo({
        top: gameLogRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [gameLog]);

  const startGame = () => {
    console.log("Starting game...");
    setGameLog([]); // Clear existing log
    socket?.emit("startGame");
  };

  const stopGame = () => {
    console.log("Stopping game...");
    socket?.emit("stopGame");
  };

  const resetGame = () => {
    console.log("Resetting game...");
    setGameLog([]); // Clear existing log
    socket?.emit("resetGame");
  };

  if (!gameState) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-6">
            Connecting to game server...
          </h1>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-12"
        >
          <div>
            <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              AI Among Us
            </h1>
            <p className="text-slate-400 mt-2">
              Watch AI agents play and interact in real-time
            </p>
          </div>
          <div className="flex items-center space-x-4 bg-slate-800/50 px-6 py-3 rounded-full backdrop-blur-sm border border-slate-700/50">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              }`}
            ></div>
            <span className="text-slate-300 font-medium">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </motion.div>

        {/* Game Map */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-12 bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50 shadow-xl"
        >
          <GameMap
            agents={gameState.agents}
            events={gameState.events}
            currentPhase={gameState.phase}
          />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Game State */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-slate-800/50 p-8 rounded-2xl backdrop-blur-sm border border-slate-700/50 shadow-xl"
          >
            <h2 className="text-2xl font-semibold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Game State
            </h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700/30 p-4 rounded-xl">
                  <p className="text-slate-400 text-sm">Round</p>
                  <p className="text-2xl font-bold text-white">
                    {gameState.currentRound}
                  </p>
                </div>
                <div className="bg-slate-700/30 p-4 rounded-xl">
                  <p className="text-slate-400 text-sm">Phase</p>
                  <p className="text-2xl font-bold text-white capitalize">
                    {gameState.phase}
                  </p>
                </div>
              </div>

              <div className="bg-slate-700/30 p-4 rounded-xl">
                <p className="text-slate-400 text-sm">Status</p>
                <p
                  className={`text-xl font-bold ${
                    gameState.gameOver ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {gameState.gameOver ? "Game Over" : "In Progress"}
                </p>
                {gameState.winner && (
                  <p className="text-lg font-semibold text-emerald-400 mt-2">
                    Winner:{" "}
                    {gameState.winner === "crewmate" ? "Crewmates" : "Imposter"}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4 text-blue-400">
                  Players
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {gameState.agents.map((agent) => (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`p-4 rounded-xl backdrop-blur-sm border ${
                        !agent.isAlive
                          ? "bg-slate-700/30 text-slate-400 border-slate-600/30"
                          : agent.role === "imposter"
                          ? "bg-red-900/20 text-red-200 border-red-500/30"
                          : "bg-emerald-900/20 text-emerald-200 border-emerald-500/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">{agent.personality.name}</p>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            agent.role === "imposter"
                              ? "bg-red-500/20 text-red-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {agent.role}
                        </span>
                      </div>
                      <p className="text-sm mb-2">
                        {agent.isAlive ? "Alive" : "Dead"}
                      </p>
                      <p className="text-xs text-slate-400">
                        Location: {agent.location}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Game Log */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-slate-800/50 p-8 rounded-2xl backdrop-blur-sm border border-slate-700/50 shadow-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                Game Log
              </h2>
              <span className="px-3 py-1 bg-slate-700/30 rounded-full text-sm text-slate-300">
                {gameLog.length} entries
              </span>
            </div>
            <div
              ref={gameLogRef}
              className="h-[600px] overflow-y-auto space-y-3 pr-4 custom-scrollbar"
            >
              {gameLog.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400 italic">No game events yet...</p>
                </div>
              ) : (
                gameLog.map((log, index) => (
                  <motion.p
                    key={`${index}-${log}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="text-sm p-3 rounded-lg bg-slate-700/30 border border-slate-600/30"
                  >
                    {log}
                  </motion.p>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-12 flex justify-center space-x-6"
        >
          {!gameState.gameOver && (
            <button
              onClick={startGame}
              className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 font-medium shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
            >
              Start Game
            </button>
          )}
          <button
            onClick={stopGame}
            className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 font-medium shadow-lg shadow-red-500/20 hover:shadow-red-500/30"
          >
            Stop Game
          </button>
          <button
            onClick={resetGame}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
          >
            Reset Game
          </button>
        </motion.div>
      </div>

      {/* Add custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </main>
  );
}
