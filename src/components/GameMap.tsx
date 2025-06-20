import { useEffect, useRef } from "react";
import { Agent, GameEvent } from "../types/game";
import { motion } from "framer-motion";

interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  connections: string[];
}

interface GameMapProps {
  agents: Agent[];
  events: GameEvent[];
  currentPhase: string;
}

const ROOMS: Room[] = [
  {
    id: "cafeteria",
    name: "Cafeteria",
    x: 400,
    y: 300,
    width: 200,
    height: 150,
    connections: ["admin", "storage", "reactor"],
  },
  {
    id: "admin",
    name: "Admin",
    x: 200,
    y: 300,
    width: 150,
    height: 100,
    connections: ["cafeteria", "storage"],
  },
  {
    id: "storage",
    name: "Storage",
    x: 300,
    y: 500,
    width: 150,
    height: 100,
    connections: ["cafeteria", "admin", "reactor"],
  },
  {
    id: "reactor",
    name: "Reactor",
    x: 600,
    y: 500,
    width: 200,
    height: 150,
    connections: ["cafeteria", "storage", "navigation"],
  },
  {
    id: "navigation",
    name: "Navigation",
    x: 800,
    y: 400,
    width: 150,
    height: 100,
    connections: ["reactor", "medbay"],
  },
  {
    id: "medbay",
    name: "MedBay",
    x: 800,
    y: 200,
    width: 150,
    height: 100,
    connections: ["navigation"],
  },
];

const VENT_CONNECTIONS = [
  ["admin", "medbay"],
  ["storage", "navigation"],
];

// Add color mapping for crewmates
const CREWMATE_COLORS: { [key: string]: string } = {
  red: "rgb(239, 68, 68)", // red-500
  blue: "rgb(59, 130, 246)", // blue-500
  green: "rgb(34, 197, 94)", // emerald-500
  yellow: "rgb(234, 179, 8)", // yellow-500
  orange: "rgb(249, 115, 22)", // orange-500
  purple: "rgb(168, 85, 247)", // purple-500
  pink: "rgb(236, 72, 153)", // pink-500
  cyan: "rgb(6, 182, 212)", // cyan-500
  brown: "rgb(180, 83, 9)", // amber-700
  lime: "rgb(132, 204, 22)", // lime-500
  white: "rgb(248, 250, 252)", // slate-50
  black: "rgb(30, 41, 59)", // slate-800
};

export default function GameMap({
  agents,
  events,
  currentPhase,
}: GameMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = 1000;
    canvas.height = 800;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = "rgba(15, 23, 42, 0.5)"; // slate-900 with opacity
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw connections (corridors)
    ROOMS.forEach((room) => {
      room.connections.forEach((connectedRoomId) => {
        const connectedRoom = ROOMS.find((r) => r.id === connectedRoomId);
        if (connectedRoom) {
          ctx.beginPath();
          ctx.strokeStyle = "rgba(51, 65, 85, 0.3)"; // slate-700 with opacity
          ctx.lineWidth = 40;
          ctx.moveTo(room.x + room.width / 2, room.y + room.height / 2);
          ctx.lineTo(
            connectedRoom.x + connectedRoom.width / 2,
            connectedRoom.y + connectedRoom.height / 2
          );
          ctx.stroke();
        }
      });
    });

    // Draw vent connections
    VENT_CONNECTIONS.forEach(([room1Id, room2Id]) => {
      const room1 = ROOMS.find((r) => r.id === room1Id);
      const room2 = ROOMS.find((r) => r.id === room2Id);
      if (room1 && room2) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(71, 85, 105, 0.3)"; // slate-600 with opacity
        ctx.lineWidth = 20;
        ctx.setLineDash([10, 10]);
        ctx.moveTo(room1.x + room1.width / 2, room1.y + room1.height / 2);
        ctx.lineTo(room2.x + room2.width / 2, room2.y + room2.height / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Draw rooms
    ROOMS.forEach((room) => {
      // Room background with glassmorphism effect
      ctx.fillStyle = "rgba(30, 41, 59, 0.5)"; // slate-800 with opacity
      ctx.fillRect(room.x, room.y, room.width, room.height);

      // Room border
      ctx.strokeStyle = "rgba(51, 65, 85, 0.5)"; // slate-700 with opacity
      ctx.lineWidth = 2;
      ctx.strokeRect(room.x, room.y, room.width, room.height);

      // Room name
      ctx.fillStyle = "rgba(226, 232, 240, 0.9)"; // slate-200 with opacity
      ctx.font = "14px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(room.name, room.x + room.width / 2, room.y + 20);

      // Check for events in this room
      const roomEvents = events.filter(
        (e) => e.location?.toLowerCase() === room.id
      );
      if (roomEvents.length > 0) {
        const latestEvent = roomEvents[roomEvents.length - 1];
        const isKill = latestEvent.type === "kill";
        const isTask = latestEvent.type === "task";
        const isChat = latestEvent.type === "chat";

        // Event indicator
        ctx.beginPath();
        ctx.fillStyle = isKill
          ? "rgba(239, 68, 68, 0.2)" // red-500 with opacity
          : isTask
          ? "rgba(34, 197, 94, 0.2)" // emerald-500 with opacity
          : "rgba(59, 130, 246, 0.2)"; // blue-500 with opacity
        ctx.arc(
          room.x + room.width / 2,
          room.y + room.height / 2,
          30,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    });

    // Draw agents
    agents.forEach((agent) => {
      if (!agent.isAlive) return;

      const room = ROOMS.find(
        (r) => r.id.toLowerCase() === agent.location.toLowerCase()
      );
      if (!room) return;

      // Add some randomness to agent position within room
      const x = room.x + 30 + Math.random() * (room.width - 60);
      const y = room.y + 30 + Math.random() * (room.height - 60);

      // Draw agent circle
      ctx.beginPath();

      // Get the agent's color from their name (assuming color is in the name)
      const agentColor = agent.personality.name.toLowerCase().includes("red")
        ? "red"
        : agent.personality.name.toLowerCase().includes("blue")
        ? "blue"
        : agent.personality.name.toLowerCase().includes("green")
        ? "green"
        : agent.personality.name.toLowerCase().includes("yellow")
        ? "yellow"
        : agent.personality.name.toLowerCase().includes("orange")
        ? "orange"
        : agent.personality.name.toLowerCase().includes("purple")
        ? "purple"
        : agent.personality.name.toLowerCase().includes("pink")
        ? "pink"
        : agent.personality.name.toLowerCase().includes("cyan")
        ? "cyan"
        : agent.personality.name.toLowerCase().includes("brown")
        ? "brown"
        : agent.personality.name.toLowerCase().includes("lime")
        ? "lime"
        : agent.personality.name.toLowerCase().includes("white")
        ? "white"
        : agent.personality.name.toLowerCase().includes("black")
        ? "black"
        : "blue";

      // Set the fill color based on the agent's color
      ctx.fillStyle = CREWMATE_COLORS[agentColor];
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();

      // Draw agent border
      if (agent.role === "imposter") {
        // Draw a pulsing red circle around the imposter
        ctx.beginPath();
        ctx.strokeStyle = "rgba(239, 68, 68, 0.6)"; // red-500 with opacity
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw a second, larger pulsing circle
        ctx.beginPath();
        ctx.strokeStyle = "rgba(239, 68, 68, 0.3)"; // red-500 with less opacity
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.arc(x, y, 25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Regular white border for crewmates
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw agent name
      ctx.fillStyle =
        agent.role === "imposter"
          ? "rgba(239, 68, 68, 0.9)"
          : "rgba(255, 255, 255, 0.9)";
      ctx.font = "12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(agent.personality.name[0], x, y + 5);
    });
  }, [agents, events, currentPhase]);

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-slate-900/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50 shadow-xl"
      >
        <canvas ref={canvasRef} className="w-full h-auto rounded-lg" />
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <div className="px-4 py-2 rounded-full bg-slate-800/50 backdrop-blur-sm border border-slate-700/50">
            <span className="text-sm font-medium text-slate-300 capitalize">
              {currentPhase} Phase
            </span>
          </div>
          <div className="px-4 py-2 rounded-full bg-slate-800/50 backdrop-blur-sm border border-slate-700/50">
            <span className="text-sm font-medium text-slate-300">
              {agents.filter((a) => a.isAlive).length} players alive
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
