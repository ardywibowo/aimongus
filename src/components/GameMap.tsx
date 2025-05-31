import { useEffect, useRef } from "react";
import { Agent, GameEvent } from "../types/game";

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
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw connections (corridors)
    ROOMS.forEach((room) => {
      room.connections.forEach((connectedRoomId) => {
        const connectedRoom = ROOMS.find((r) => r.id === connectedRoomId);
        if (connectedRoom) {
          ctx.beginPath();
          ctx.strokeStyle = "#2a2a3e";
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
        ctx.strokeStyle = "#3a3a4e";
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
      // Room background
      ctx.fillStyle = "#2a2a3e";
      ctx.fillRect(room.x, room.y, room.width, room.height);

      // Room border
      ctx.strokeStyle = "#3a3a4e";
      ctx.lineWidth = 2;
      ctx.strokeRect(room.x, room.y, room.width, room.height);

      // Room name
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(room.name, room.x + room.width / 2, room.y + 20);
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

      // Agent circle
      ctx.beginPath();
      ctx.fillStyle = agent.role === "imposter" ? "#ff4444" : "#44ff44";
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();

      // Agent border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Agent name
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(agent.personality.name, x, y + 25);
    });

    // Draw recent events
    const recentEvents = events.slice(-3);
    recentEvents.forEach((event, index) => {
      const room = ROOMS.find(
        (r) => r.id.toLowerCase() === event.location.toLowerCase()
      );
      if (!room) return;

      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.arc(
        room.x + room.width / 2,
        room.y + room.height / 2,
        30 + index * 10,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });
  }, [agents, events, currentPhase]);

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="w-full h-auto rounded-lg shadow-lg" />
      <div className="absolute top-4 right-4 bg-slate-800/90 text-white px-4 py-2 rounded-lg">
        <p className="text-sm font-medium">Phase: {currentPhase}</p>
        <p className="text-xs text-slate-300">
          {agents.filter((a) => a.isAlive).length} players alive
        </p>
      </div>
    </div>
  );
}
