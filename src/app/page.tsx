"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { GameState } from "../types/game";
import GameMap from "../components/GameMap";

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameLog, setGameLog] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

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

    socketInstance.on("gameState", (state: GameState) => {
      setGameState(state);
    });

    socketInstance.on("gameLog", (log: string[]) => {
      setGameLog(log);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const startGame = () => {
    socket?.emit("startGame");
  };

  const stopGame = () => {
    socket?.emit("stopGame");
  };

  const resetGame = () => {
    socket?.emit("resetGame");
  };

  if (!gameState) {
    return (
      <main className="min-h-screen p-8 bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Connecting to game server...</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-slate-900">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">AI Among Us</h1>
          <div className="flex items-center space-x-4">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            ></div>
            <span className="text-white">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Game Map */}
        <div className="mb-8">
          <GameMap
            agents={gameState.agents}
            events={gameState.events}
            currentPhase={gameState.phase}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Game State */}
          <div className="bg-slate-800 p-6 rounded-lg shadow-lg text-white">
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">
              Game State
            </h2>
            <div className="space-y-4">
              <p className="text-slate-200">Round: {gameState.currentRound}</p>
              <p className="text-slate-200">Phase: {gameState.phase}</p>
              <p className="text-slate-200">
                Status: {gameState.gameOver ? "Game Over" : "In Progress"}
              </p>
              {gameState.winner && (
                <p className="text-xl font-bold text-emerald-400">
                  Winner:{" "}
                  {gameState.winner === "crewmate" ? "Crewmates" : "Imposter"}
                </p>
              )}

              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2 text-blue-400">
                  Players:
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {gameState.agents.map((agent) => (
                    <div
                      key={agent.id}
                      className={`p-3 rounded-lg ${
                        !agent.isAlive
                          ? "bg-slate-700 text-slate-400"
                          : agent.role === "imposter"
                          ? "bg-red-900/50 text-red-200 border border-red-500/50"
                          : "bg-emerald-900/50 text-emerald-200 border border-emerald-500/50"
                      }`}
                    >
                      <p className="font-medium">{agent.personality.name}</p>
                      <p className="text-sm">
                        {agent.isAlive ? "Alive" : "Dead"} - {agent.role}
                      </p>
                      <p className="text-xs mt-1 text-slate-300">
                        Location: {agent.location}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Game Log */}
          <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">
              Game Log
            </h2>
            <div className="h-[500px] overflow-y-auto space-y-2 text-slate-200">
              {gameLog.map((log, index) => (
                <p
                  key={index}
                  className="text-sm border-b border-slate-700 pb-2"
                >
                  {log}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-8 flex justify-center space-x-4">
          {!gameState.gameOver && (
            <button
              onClick={startGame}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
            >
              Start Game
            </button>
          )}
          <button
            onClick={stopGame}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Stop Game
          </button>
          <button
            onClick={resetGame}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Reset Game
          </button>
        </div>
      </div>
    </main>
  );
}
