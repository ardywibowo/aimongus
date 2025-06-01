# AI Among Us 🎮

A web-based simulation of Among Us where AI agents play the game autonomously. Watch as AI crewmates and imposters interact, make decisions, and try to outsmart each other in a space-themed environment.

## Connection to Parametric Memory Build Day Themes

This project demonstrates practical applications of advanced memory systems in multi-agent environments, aligning with the event's focus on real-world AI memory architectures. Our implementation showcases three critical aspects of modern memory systems: First, we employ dynamic knowledge adaptation through our agents' suspicion and trust models, which continuously update based on game events and social interactions. Second, we implement efficient knowledge embedding by structuring agent memories into distinct components (episodic memory of events, social memory of interactions, and strategic memory of voting patterns). Finally, we explore universal memory architectures through our modular agent design, where memory components can be transferred and adapted across different agent personalities and roles. The project serves as a practical case study in how memory systems can enable complex social behaviors like deception, trust-building, and strategic planning in AI agents, while maintaining the engineering constraints necessary for real-time performance in a game environment.

## Features 🌟

- 🤖 AI-powered agents with unique personalities and decision-making
- 🎯 Real-time game simulation with day/night cycles
- 📊 Interactive game map showing agent locations and movements
- 📝 Live game log tracking all events and agent communications
- 🎨 Modern, responsive UI with real-time updates
- 🔄 Multiple game phases: day, night, discussion, and voting
- 👥 Dynamic agent interactions and voting system
- 🎭 Imposter mechanics including kills and sabotage

## Tech Stack 💻

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Socket.IO
- **AI**: OpenAI API for agent decision-making
- **Real-time Communication**: WebSocket (Socket.IO)

## Prerequisites 📋

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key (for AI agent decision-making)

## Setup 🛠️

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/dream-memory.git
   cd dream-memory
   ```

2. Install dependencies:

   ```bash
   # Install root dependencies
   npm install

   # Install server dependencies
   cd server
   npm install
   cd ..
   ```

3. Create a `.env` file in the server directory:

   ```bash
   cd server
   touch .env
   ```

4. Add your OpenAI API key to the `.env` file:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

## Running the Project 🚀

1. Start the development server:

   ```bash
   # Start the Next.js frontend (in the root directory)
   npm run dev
   ```

2. In a separate terminal, start the game server:

   ```bash
   # Start the game server (in the root directory)
   npm run server
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## How to Play 🎮

1. Click "Start Game" to begin a new simulation
2. Watch as AI agents move around the map and interact
3. Monitor the game log for events and agent communications
4. Use the controls to:
   - Start a new game
   - Stop the current game
   - Reset the game state

## Game Mechanics 🎲

### Agents

- Each agent has a unique personality with traits like:
  - Trust Level
  - Skepticism Level
  - Observation Skills
  - Communication Style

### Roles

- **Crewmates**: Complete tasks and try to identify the imposter
- **Imposter**: Eliminate crewmates while avoiding detection

### Phases

1. **Day Phase**: Agents move around and complete tasks
2. **Night Phase**: Imposter can attempt kills
3. **Discussion**: Agents discuss and share information
4. **Voting**: Agents vote to eject a suspected imposter

## Development 🛠️

### Project Structure

```
dream-memory/
├── src/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── lib/             # Game logic and utilities
│   └── types/           # TypeScript type definitions
├── server/              # Game server
│   ├── aiAgent.ts       # AI agent implementation
│   └── index.ts         # Server entry point
└── public/             # Static assets
```

### Key Files

- `src/app/page.tsx`: Main game UI
- `src/lib/gameManager.ts`: Game state management
- `server/aiAgent.ts`: AI decision-making logic
- `server/index.ts`: WebSocket server and game loop

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments 🙏

- Inspired by the game Among Us
- Built with Next.js and Socket.IO
- AI powered by OpenAI
