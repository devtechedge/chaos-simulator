# 🔲 Chaos Simulator

Real-time chaos engineering dashboard with self-healing microservices, animated SVG topology, particle effects, scenario builder, and live WebSocket telemetry.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?logo=vercel)](https://chaos-simulator-telemetry.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.x-fbf0df?logo=bun)](https://bun.sh/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-black?logo=socket.io)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Live Demo

**https://chaos-simulator-telemetry.vercel.app**

> **Current status:** Frontend only is deployed on Vercel. The live site shows the full UI with static/demo service data. The real-time chaos engine (Bun + Socket.io backend) is not hosted in production, so auto-injection, self-healing, live logs, and scenario playback only work when you run the project locally.

---

## Features

- **3 mock microservices** (Auth, Payment, Inventory) with live health, latency, and request volume
- **Automated chaos injector** — 500 errors, latency spikes, and service crashes every 30 s
- **Self-healing recovery** — services restore themselves within 8–15 seconds
- **Animated SVG topology** with particle data flow and health-based pulse rings
- **Canvas particle bursts + synthesized sound** on every critical event
- **Multi-step Scenario Builder** with presets (Black Friday, Cascading Failure, etc.)
- **Real-time latency chart** (60 s window) and filterable anomaly timeline
- **Manual injection controls** and massive network-partition button

---

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Frontend     | Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui |
| Animation    | Framer Motion 12, Canvas particles  |
| Charts       | Recharts                            |
| Realtime     | Socket.io 4 (client + server)       |
| Backend      | Bun + Node http server              |
| Package mgr  | Bun                                 |

---

## Quick Start (local)

```bash
# Install frontend deps
bun install

# Install & start the chaos engine (port 3030)
cd mini-services/chaos-engine
bun install
bun index.ts

# In another terminal — start the dashboard (port 3000)
cd ../..
bun run dev
```

Open **http://localhost:3000**. The dashboard connects automatically and shows LIVE status.

---

## Architecture

```
┌──────────────────────┐       ┌──────────────────────────────┐
│  Next.js Dashboard   │◀─────■│  Chaos Engine (Bun)          │
│  (port 3000)         │  WSS  │  Socket.io + REST + 3 services│
└──────────────────────┘       └──────────────────────────────┘
```

- Frontend is a pure client that talks to the engine over Socket.io.
- All state (service health, anomaly history, latency samples) lives in the engine process.
- The Vercel deployment hosts only the frontend. A full live demo with working chaos engine would require a second host (Render, Railway, Fly.io, or a small VPS) for the long-running WebSocket server.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
