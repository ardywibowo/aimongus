"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { GameState, Agent } from "../types/game";
import GameMap from "../components/GameMap";
import { motion } from "framer-motion";

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const gameLogRef = useRef<HTMLDivElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);

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
      // Convert suspicions back to Map for each agent
      newState.agents = newState.agents.map((agent: Agent) => ({
        ...agent,
        suspicions: new Map(Object.entries(agent.suspicions)),
      }));
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

  // Add effect to handle card loading state
  useEffect(() => {
    if (gameState?.agents) {
      setIsLoadingCards(true);
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setIsLoadingCards(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [gameState?.agents]);

  // Modify the game log scroll effect
  useEffect(() => {
    if (gameLogRef.current && !isLoadingCards) {
      const scrollTimer = setTimeout(() => {
        gameLogRef.current?.scrollTo({
          top: gameLogRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100); // Small delay to ensure content is rendered
      return () => clearTimeout(scrollTimer);
    }
  }, [gameLog, isLoadingCards]);

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
                  Players (Game Theory Analysis)
                </h3>
                <div
                  ref={cardsContainerRef}
                  className="grid grid-cols-2 gap-4 relative"
                >
                  {isLoadingCards ? (
                    <div className="col-span-2 flex justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                    </div>
                  ) : (
                    gameState.agents.map((agent, index) => (
                      <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }} // Stagger the animations
                        className={`p-4 rounded-xl backdrop-blur-sm border ${
                          !agent.isAlive
                            ? "bg-slate-700/30 text-slate-400 border-slate-600/30"
                            : agent.role === "imposter"
                            ? "bg-red-900/20 text-red-200 border-red-500/30"
                            : "bg-emerald-900/20 text-emerald-200 border-emerald-500/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium">
                            {agent.personality.name}
                          </p>
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
                        <div className="space-y-2">
                          <p className="text-sm">
                            {agent.isAlive ? "Alive" : "Dead"}
                          </p>
                          <p className="text-xs text-slate-400">
                            Location: {agent.location}
                          </p>
                          {/* Personality Traits */}
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium text-blue-300">
                              Personality Analysis:
                            </p>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div className="bg-slate-800/50 p-1 rounded">
                                <span className="text-slate-400">Trust:</span>{" "}
                                <span className="text-emerald-300">
                                  {(agent.personality.trustLevel * 100).toFixed(
                                    0
                                  )}
                                  %
                                </span>
                              </div>
                              <div className="bg-slate-800/50 p-1 rounded">
                                <span className="text-slate-400">
                                  Skepticism:
                                </span>{" "}
                                <span className="text-red-300">
                                  {(
                                    agent.personality.skepticismLevel * 100
                                  ).toFixed(0)}
                                  %
                                </span>
                              </div>
                              <div className="bg-slate-800/50 p-1 rounded">
                                <span className="text-slate-400">
                                  Observation:
                                </span>{" "}
                                <span className="text-blue-300">
                                  {(
                                    agent.personality.observationSkills * 100
                                  ).toFixed(0)}
                                  %
                                </span>
                              </div>
                              <div className="bg-slate-800/50 p-1 rounded">
                                <span className="text-slate-400">Style:</span>{" "}
                                <span className="text-purple-300">
                                  {agent.personality.communicationStyle}
                                </span>
                              </div>
                            </div>
                          </div>
                          {/* Agent Analysis */}
                          {agent.isAlive && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-yellow-300">
                                Latest Analysis:
                              </p>
                              <div className="space-y-1 mt-1">
                                {/* Latest relevant events for this agent */}
                                {gameLog
                                  .filter((log) => {
                                    // Include events where this agent is involved
                                    return (
                                      log.includes(
                                        `💭 ${agent.personality.name}:`
                                      ) || // Chat messages
                                      log.includes(
                                        `🗳️ ${agent.personality.name} voted`
                                      ) || // Votes
                                      log.includes(
                                        `🔪 ${agent.personality.name} eliminated`
                                      ) || // Kills
                                      log.includes(
                                        `✅ ${agent.personality.name} completed`
                                      ) || // Tasks
                                      log.includes(
                                        `🕳️ ${agent.personality.name} was seen using vents`
                                      ) || // Vent usage
                                      (log.includes("🗳️") &&
                                        log.includes(
                                          `voted for ${agent.personality.name}`
                                        )) // Being voted for
                                    );
                                  })
                                  .slice(-3) // Show last 3 relevant events
                                  .map((log, index) => (
                                    <div
                                      key={`event-${index}`}
                                      className={`bg-slate-800/50 p-1 rounded text-xs ${
                                        log.includes("🔪")
                                          ? "text-red-300"
                                          : log.includes("🗳️")
                                          ? "text-blue-300"
                                          : log.includes("✅")
                                          ? "text-emerald-300"
                                          : log.includes("🕳️")
                                          ? "text-yellow-300"
                                          : "text-slate-300"
                                      }`}
                                    >
                                      {log.split("] ")[1]}{" "}
                                      {/* Remove timestamp */}
                                    </div>
                                  ))}
                                {/* Top suspicions */}
                                {Array.from(agent.suspicions.entries())
                                  .sort(([, a], [, b]) => Number(b) - Number(a))
                                  .slice(0, 3)
                                  .map(([targetId, suspicion]) => {
                                    const target = gameState.agents.find(
                                      (a) => a.id === targetId
                                    );
                                    if (!target) return null;
                                    return (
                                      <div
                                        key={targetId}
                                        className="bg-slate-800/50 p-1 rounded text-xs mt-1"
                                      >
                                        <span className="text-slate-400">
                                          {target.personality.name}:
                                        </span>{" "}
                                        <span
                                          className={`${
                                            Number(suspicion) > 0.6
                                              ? "text-red-300"
                                              : Number(suspicion) > 0.3
                                              ? "text-yellow-300"
                                              : "text-emerald-300"
                                          }`}
                                        >
                                          {(Number(suspicion) * 100).toFixed(0)}
                                          %
                                        </span>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
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
                Game Theory Log
              </h2>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-slate-700/30 rounded-full text-sm text-slate-300">
                  {gameLog.length} entries
                </span>
                <span className="px-3 py-1 bg-blue-500/20 rounded-full text-sm text-blue-300">
                  Round {gameState.currentRound}
                </span>
              </div>
            </div>
            <div
              ref={gameLogRef}
              className="h-[600px] overflow-y-auto space-y-3 pr-4 custom-scrollbar"
            >
              {gameLog.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400 italic">No game events yet...</p>
                </div>
              ) : (
                gameLog.map((log, index) => {
                  // Determine the type of log entry for styling
                  const isVote = log.includes("🗳️");
                  const isKill = log.includes("🔪");
                  const isTask = log.includes("✅");
                  const isMeeting = log.includes("📢");
                  const isChat = log.includes("💭");
                  const isVent = log.includes("🕳️");

                  return (
                    <motion.p
                      key={`${index}-${log}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.5) }} // Cap the delay at 0.5s
                      className={`text-sm p-3 rounded-lg border ${
                        isVote
                          ? "bg-blue-900/20 border-blue-500/30"
                          : isKill
                          ? "bg-red-900/20 border-red-500/30"
                          : isTask
                          ? "bg-emerald-900/20 border-emerald-500/30"
                          : isMeeting
                          ? "bg-purple-900/20 border-purple-500/30"
                          : isChat
                          ? "bg-slate-900/20 border-slate-500/30"
                          : isVent
                          ? "bg-yellow-900/20 border-yellow-500/30"
                          : "bg-slate-700/30 border-slate-600/30"
                      }`}
                    >
                      {log}
                    </motion.p>
                  );
                })
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
