# Chaos Simulator — Handoff to GLM 5.2

## Project Overview
A **Distributed Microservices Chaos Simulator & Self-Healing Telemetry Dashboard** built with:
- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui
- Socket.io (server on port 3030, client in dashboard)
- Bun as runtime/package manager
- Caddy as gateway (port 81 → forwards to 3000 + 3030)

## Architecture
```
┌─────────────────────────────────────────────────────────┐
│ Caddy Gateway (port 81)                                 │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │ Next.js UI   │◄─┤ Chaos Engine (port 3030)          │ │
│  │ (port 3000)  │  │ Socket.io + REST + 3 microservices│ │
│  └──────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Key Files
| File | Purpose |
|------|---------|
| `mini-services/chaos-engine/index.ts` | Backend: 3 services + Chaos Injector (30s loop) + Self-Healing Worker (5s check) + REST API `/api/telemetry` + Socket.io |
| `src/app/page.tsx` | Frontend: dark-themed dashboard with health cards, live event log, chaos controls |
| `src/app/layout.tsx` | Root layout (dark mode enabled) |
| `src/app/globals.css` | Tailwind 4 + theme tokens |
| `Caddyfile` | Gateway routing (XTransformPort for backend) |

## How to Run Locally
```bash
# 1. Install deps
bun install
cd mini-services/chaos-engine && bun install && cd ../..

# 2. Start the Chaos Engine backend (port 3030)
cd mini-services/chaos-engine && bun index.ts &

# 3. Start the Next.js dev server (port 3000)
bun run dev

# 4. Open http://localhost:3000
```

## Existing Features
1. ✅ 3 mock microservices: AuthService, PaymentService, InventoryService
2. ✅ Automated Chaos Injector (30s interval): 500_ERROR, LATENCY_SPIKE, SERVICE_CRASH
3. ✅ Self-Healing Recovery Worker (recovers in 8-15s)
4. ✅ REST API `/api/telemetry` with health, latency, request volume, outages prevented
5. ✅ Dark-themed dashboard with real-time Socket.io updates
6. ✅ Service health cards (RED/AMBER/GREEN)
7. ✅ Live event stream terminal log
8. ✅ Interactive controls: Massive Network Partition, per-service 500/Latency/Crash injection
9. ✅ KPI strip (active services, outages prevented, chaos cycles, avg latency)
10. ✅ Manual restart buttons per service

## Task for GLM 5.2
1. **Read every file in this project** to understand the existing architecture
2. **Redesign the UI to be much more animated and interactive** — GLM 5.2's taste:
   - Add smooth Framer Motion transitions
   - Animated chart visualizations (real-time latency graphs per service)
   - Particle/glow effects on chaos events
   - Animated SVG topology diagram showing service dependencies
   - Better micro-interactions (hover states, button feedback, loading skeletons)
3. **Add 5 new features** of GLM 5.2's own choosing. Suggestions:
   - Real-time latency line chart (Recharts) per service, last 60 seconds
   - Anomaly history timeline view
   - Sound effects on critical events
   - Service dependency graph visualization
   - Dark/Light theme toggle
   - Export telemetry report as PDF
   - Mobile-responsive bottom navigation
   - WebSocket reconnection status indicator
   - Custom chaos scenario builder (multi-step)
   - Operator chat box that sends events back to the chaos engine
   - Pick what you think makes the dashboard most impressive!

## Conventions to Follow
- **No indigo/blue** colors unless explicitly needed (use existing orange/emerald/amber palette)
- All files under `/home/z/my-project/` (when running in sandbox)
- Socket.io client must use: `io('/?XTransformPort=3030', { path: '/socket.io/' })`
- Final deliverables go in `/home/z/my-project/download/`
- Use `bun run lint` to check code quality

Happy building! 🜄
