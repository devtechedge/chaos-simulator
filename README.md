# 🜄 Chaos Simulator — Distributed Microservices Telemetry Dashboard

A real-time chaos engineering simulator with self-healing microservices, animated SVG topology, particle effects, sound, and a multi-step scenario builder.

Built with **Next.js 16** (frontend) + **Bun + Socket.io** (backend chaos engine).

![dashboard](https://img.shields.io/badge/Next.js-16-black) ![bun](https://img.shields.io/badge/Bun-1.x-black) ![socket.io](https://img.shields.io/badge/Socket.io-4.8-black) ![tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4)

---

## ✨ Features

### Core (existing)
- 3 mock microservices: `AuthService`, `PaymentService`, `InventoryService`
- Automated Chaos Injector (30s loop): `500_ERROR`, `LATENCY_SPIKE`, `SERVICE_CRASH`
- Self-Healing Recovery Worker (recovers within 8–15s)
- REST API: `/api/telemetry`, `/api/anomalies`, `/api/latency-history`
- Real-time Socket.io telemetry
- Per-service 500/Latency/Crash injection + Massive Network Partition
- KPI strip (active services, outages prevented, chaos cycles, avg latency)

### Animated UI redesign
- **Framer Motion** transitions everywhere (layout, hover, AnimatePresence on log entries)
- **Animated SVG service topology** — gateway + 3 services with live particle data flow along edges, pulse rings on degraded/down nodes, rotating dashed rings
- **Canvas particle burst overlay** — colored particles + shockwaves on every CRITICAL event
- Animated connection indicator (LIVE / CONNECTING / RECONNECTING / OFFLINE)
- Drifting background glow blobs + animated grid

### 5 new features
1. **Real-time multi-line latency chart** (Recharts, 60s window, SLO threshold reference)
2. **Animated SVG service topology** with particle flow + health-based pulse rings
3. **Chaos Scenario Builder wizard** — 3-step dialog with 4 presets (Rolling Thunder, Latency Cascade, Black Friday, Cascading Failure) + custom composer + live progress banner
4. **Anomaly History Timeline** — filterable by service, stats summary, triggered-by badges (auto/manual/scenario)
5. **Sound + Toast notification system** — Web Audio API synthesized tones (no audio files needed), animated toast stack with progress bars

---

## 📁 Project structure

```
chaos-simulator/
├── src/                              # Next.js frontend
│   ├── app/
│   │   ├── layout.tsx                # Root layout (dark mode)
│   │   ├── page.tsx                  # Main dashboard (~750 lines)
│   │   ├── globals.css              # Tailwind + custom animations
│   │   └── api/route.ts             # Sample API route
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   └── chaos/                    # Custom dashboard components
│   │       ├── ParticleOverlay.tsx
│   │       ├── ServiceTopology.tsx
│   │       ├── LatencyChart.tsx
│   │       ├── ServiceCard.tsx
│   │       ├── LiveLog.tsx
│   │       ├── ChaosScenarioBuilder.tsx
│   │       ├── AnomalyTimeline.tsx
│   │       ├── ToastStack.tsx
│   │       └── ConnectionIndicator.tsx
│   ├── lib/
│   │   ├── chaos-types.ts            # Shared types + service metadata
│   │   ├── sound-manager.ts          # Web Audio API sound engine
│   │   ├── db.ts                     # Prisma client
│   │   └── utils.ts                  # cn() helper
│   └── hooks/
│       ├── use-toast.ts
│       └── use-mobile.ts
├── mini-services/
│   └── chaos-engine/                 # Backend: Bun + Socket.io on port 3030
│       ├── index.ts                  # Chaos engine + REST + scenarios
│       ├── package.json
│       └── tsconfig.json
├── prisma/
│   └── schema.prisma                 # (Optional — app works without a DB)
├── public/
│   ├── logo.svg
│   └── robots.txt
├── package.json                      # Frontend deps
├── next.config.ts                    # Next.js config + socket.io rewrite
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
├── components.json                   # shadcn/ui config
├── Caddyfile                         # Optional: Caddy reverse proxy config
├── .env.example                      # Environment variables template
└── README.md                         # This file
```

---

## 🚀 Quick start (local dev)

### Prerequisites
- [Node.js 18+](https://nodejs.org/) or [Bun](https://bun.sh/) (recommended)
- Any terminal

### 1. Install dependencies

```bash
# Install Bun first (optional but recommended):
# curl -fsSL https://bun.sh/install | bash

# Install frontend deps
bun install

# Install chaos-engine deps
cd mini-services/chaos-engine
bun install
cd ../..
```

### 2. Start the chaos engine (port 3030)

```bash
cd mini-services/chaos-engine
bun index.ts
```

Leave this running in a separate terminal. You should see:
```
🜄 Chaos Engine running on port 3030
  REST API:  http://localhost:3030/api/telemetry
  WebSocket: ws://localhost:3030/socket.io/
```

### 3. Start the Next.js dev server (port 3000)

```bash
# From project root
bun run dev
# OR: npm run dev / pnpm dev / yarn dev
```

Open **http://localhost:3000** — the dashboard should connect within a second and show LIVE status.

### 4. (Optional) Use Caddy as a unified gateway on port 81

If you want a single entry point that routes both the dashboard and the WebSocket through one port, use the included `Caddyfile`:

```bash
caddy run --config Caddyfile
# Then visit http://localhost:81
```

This is what the original handoff used. For local dev you don't need it — Next.js's built-in rewrite handles the socket.io proxy automatically.

---

## 🌐 Hosting guide

### Do you need Vercel? Supabase?

| Service | Do you need it? | Why |
|---|---|---|
| **GitHub** | ✅ Yes (free, required) | Just to store/share your code |
| **Vercel** | ⚠️ Partial — frontend only | Perfect for the Next.js dashboard, but **cannot host the chaos-engine WebSocket server** (Vercel is serverless, no long-running processes) |
| **Supabase** | ❌ Not needed | The app uses in-memory state, no database. Supabase would only be useful if you wanted to persist anomaly history to Postgres |
| **Render / Railway / Fly.io** | ✅ Yes (for the backend) | These support long-running Bun/Node processes + WebSockets on free tiers |

### Recommended production setup

You need **two hosts** because the chaos-engine is a stateful WebSocket server, not a serverless function:

```
┌──────────────────────────┐       ┌──────────────────────────┐
│  Vercel (frontend)       │       │  Render / Railway        │
│  - Next.js dashboard     │ ────► │  - chaos-engine (Bun)    │
│  - Static + SSR          │ WSS   │  - Socket.io on port 3030│
│  - Free tier             │       │  - Free tier             │
└──────────────────────────┘       └──────────────────────────┘
```

#### Option A: Vercel (frontend) + Render (backend) — recommended

**1. Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit: Chaos Simulator"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/chaos-simulator.git
git push -u origin main
```

**2. Deploy the chaos-engine to Render**
- Go to [render.com](https://render.com), sign in with GitHub
- New → Web Service → connect your repo
- Settings:
  - **Name**: `chaos-engine`
  - **Region**: closest to you
  - **Runtime**: `Bun` (or `Node` if Bun isn't available — but Bun is recommended)
  - **Build command**: `cd mini-services/chaos-engine && bun install`
  - **Start command**: `cd mini-services/chaos-engine && bun index.ts`
  - **Plan**: Free
- Add environment variable: `PORT=3030` (Render assigns its own port via `PORT` env var — see below for code tweak needed)
- Deploy. You'll get a URL like `https://chaos-engine.onrender.com`

**3. Deploy the Next.js dashboard to Vercel**
- Go to [vercel.com](https://vercel.com), sign in with GitHub
- New Project → import your repo
- Framework preset: Next.js (auto-detected)
- **Important**: Add an environment variable:
  - `NEXT_PUBLIC_CHAOS_ENGINE_URL=https://chaos-engine.onrender.com`
- Deploy. You'll get `https://chaos-simulator.vercel.app`

**4. Update the frontend to point to the Render URL**

The frontend currently connects via `io('/?XTransformPort=3030', { path: '/socket.io/' })` which assumes the chaos engine is on the same origin. For production you need to change this in `src/app/page.tsx`:

```ts
const CHAOS_ENGINE_URL = process.env.NEXT_PUBLIC_CHAOS_ENGINE_URL || ''
const socketInstance = io(CHAOS_ENGINE_URL, {
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  // ... rest of options
})
```

Also remove the `rewrites()` block from `next.config.ts` since you no longer need the proxy.

Also update `mini-services/chaos-engine/index.ts` to use the `PORT` env var Render assigns:
```ts
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3030
```

**5. Enable CORS on the chaos engine**

In `mini-services/chaos-engine/index.ts`, the CORS is already set to `origin: '*'` for development. For production you might want to lock it down to your Vercel URL:
```ts
cors: { 
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'] 
}
```

#### Option B: All-in-one on Railway or Render

You can host **both** services on a single Railway/Render account:
- Create two web services from the same repo
- Service 1 (frontend): build = `bun install`, start = `bun run dev` (or `bun run start` after build)
- Service 2 (backend): as above

Railway gives you a private network so the frontend can reach the backend without exposing it publicly.

#### Option C: Self-host on a VPS (Hetzner / DigitalOcean / Fly.io)

Cheapest for 24/7 use. ~$5/month gets you a small VPS that runs both services.

```bash
# On the VPS:
git clone https://github.com/YOUR_USERNAME/chaos-simulator.git
cd chaos-simulator
bun install
cd mini-services/chaos-engine && bun install && cd ../..

# Start backend
cd mini-services/chaos-engine && bun index.ts &

# Build + start frontend
bun run build
bun run start

# Use the included Caddyfile as a reverse proxy on port 80/443
caddy run --config Caddyfile
```

### Why not just GitHub?

GitHub only hosts **static** files (via GitHub Pages). This app has:
1. A Next.js server (server-side rendering, API routes)
2. A separate Bun WebSocket server (the chaos engine)

Neither can run on GitHub Pages. You need a runtime host.

If you wanted a **static-only** version (no live chaos engine), you could export the Next.js app as static HTML — but then you'd lose all the real-time WebSocket features that make this dashboard impressive.

---

## 🔧 Environment variables

Create a `.env` file (or `.env.local`) in the project root:

```bash
# Copy this file to .env.local and adjust as needed
# All variables are optional for local dev — defaults work out of the box

# URL of the chaos-engine backend (only needed in production)
# Leave empty for local dev (Next.js rewrite proxies it automatically)
NEXT_PUBLIC_CHAOS_ENGINE_URL=

# CORS origin for the chaos-engine (lock down in production)
# Set to your Vercel URL like https://chaos-simulator.vercel.app
CORS_ORIGIN=*
```

---

## 🛠 Tech stack

| Layer | Tech |
|---|---|
| Frontend framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York style) |
| Animations | Framer Motion 12 |
| Charts | Recharts 2 |
| Icons | Lucide React |
| Real-time | Socket.io-client 4 |
| Backend runtime | Bun 1.x |
| Backend server | Socket.io 4 + Node http |
| Package manager | Bun (or npm/pnpm/yarn) |
| Reverse proxy (optional) | Caddy 2 |

---

## 📜 Available scripts

### Frontend (project root)
```bash
bun run dev        # Start dev server on port 3000
bun run build      # Production build
bun run start      # Start production server
bun run lint       # ESLint check
bun run db:push    # Push Prisma schema (only if you add a DB)
```

### Backend (mini-services/chaos-engine)
```bash
bun index.ts       # Start chaos engine on port 3030
bun --hot index.ts # Start with hot reload (dev only)
```

---

## 🎨 Color palette

The dashboard intentionally avoids indigo/blue. The palette is:
- **Orange** `#f97316` — chaos engine, primary accent
- **Emerald** `#10b981` — healthy services, recovery
- **Amber** `#f59e0b` — degraded services, warnings
- **Red** `#ef4444` — down services, critical alerts
- **Slate** `#0a0e17` / `#0d1220` — background layers

---

## 🧪 Testing the features

Once running, try these:

1. **Wait 30 seconds** — the chaos engine will auto-inject a random anomaly. Watch the topology pulse, the particle burst, the toast notification, and the latency chart spike.

2. **Open the Scenario Builder** (top-right button) → pick "Black Friday" → Launch. Watch the header banner show live progress as 4 anomalies fire in sequence.

3. **Toggle sound on** (Volume icon top-right) before triggering a partition — the synthesized alarm + particle burst combo is the most dramatic moment.

4. **Filter the Anomaly Timeline** by service or "resolved only" to see historical patterns.

5. **Click "Crash" on any service** in the Targeted Chaos Injection panel — watch it go DOWN, then self-heal within ~15 seconds.

---

## 🤝 Credits

- Original handoff: `HANDOFF_TO_GLM5.2.md`
- Built with the Z.ai fullstack-dev skill

## 📄 License

MIT — do whatever you want with it.
