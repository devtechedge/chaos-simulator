# 🔥 Chaos Simulator

Real-time chaos engineering dashboard with self-healing microservices, animated SVG topology, particle effects, scenario builder, and live telemetry.

[![CI](https://github.com/devtechedge/chaos-simulator/actions/workflows/ci.yml/badge.svg)](https://github.com/devtechedge/chaos-simulator/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?logo=vercel)](https://chaos-simulation.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.x-fbf0df?logo=bun)](https://bun.sh/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-black?logo=socket.io)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss)](https://tailwindcss.com/)
[![Framer Motion](https://img.shields.io/badge/Framer%20Motion-12-black)](https://www.framer.com/motion/)
[![Recharts](https://img.shields.io/badge/Recharts-2-orange)](https://recharts.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Live Demo

**https://chaos-simulation.vercel.app**

> **Status:** The live site is a full **client-side simulation** (no backend, no paid host). Chaos injection, self-healing, scenarios, latency charts, and the event stream all run in the browser. A Bun + Socket.io engine lives in this repo for **local** use only — it is not exposed on Vercel.

This is the **only** public repo for the project.

---

## Screenshots

### Dashboard Overview
![Dashboard with live topology, latency chart and toast notifications](docs/screenshots/01-dashboard-overview.png)

### Chaos Scenario Builder
![Multi-step Scenario Builder with presets](docs/screenshots/02-scenario-builder.png)

### Live Controls & Event Stream
![Disaster controls, targeted injection and live event stream](docs/screenshots/03-controls-and-stream.png)

### Anomaly Timeline
![Filterable anomaly history with recovery times](docs/screenshots/04-anomaly-timeline.png)

---

## Features

- **3 mock microservices** (Auth, Payment, Inventory) with live health, latency, and request volume
- **Automated chaos injector** — 500 errors, latency spikes, and service crashes every 30 s
- **Self-healing recovery** — services restore themselves within 8–15 seconds
- **Animated SVG topology** with particle data flow and health-based pulse rings
- **Canvas particle bursts + synthesized sound** on every critical event
- **Multi-step Scenario Builder** with presets (Black Friday, Cascading Failure, etc.)
- **Real-time latency chart** (60 s window) and filterable anomaly timeline
- **Manual injection controls** and a network-partition button

---

## Tech Stack

| Layer        | Technology |
|--------------|------------|
| Frontend     | Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui |
| Animation    | Framer Motion 12, Canvas particles |
| Charts       | Recharts |
| Demo mode    | Client-side simulation on Vercel |
| Local engine | Bun + Socket.io (not public) |
| CI           | GitHub Actions — unit, `tsc`, Playwright |
| Package mgr  | Bun |

---

## Architecture

**Public demo (Vercel)** uses `useChaosEngine` in the browser. No paid backend.


```
Vercel / Demo                         Local only
┌─────────────────────────┐         ┌──────────────────────────┐
│ Next.js dashboard       │         │ Chaos Engine (Bun :3030) │
│ + useChaosEngine        │         │ + 3 mock services        │
│ (client simulation)     │         └──────────────────────────┘
└─────────────────────────┘
```

---

## Quality

| Check | How |
|-------|-----|
| Unit tests | Validation, simulation transitions, Scenario Builder presets |
| Types | `ignoreBuildErrors` is **off** — `bun run typecheck` |
| E2E | Playwright: dashboard, Scenario Builder, 500 inject, partition |
| CI | [GitHub Actions](https://github.com/devtechedge/chaos-simulator/actions) on every push to `main` |
| Supply chain | Unused template packages removed; Dependabot weekly (**patch/minor only** — do not merge majors blindly) |

```bash
bun install
bun run test
bun run typecheck
bunx playwright install chromium
bun run test:e2e
```

---

## Security

Portfolio demo: **no user login** on the public site. The browser simulation cannot reach other users.

The local Bun engine allow-lists service names and anomaly types, caps scenario payloads, and reads `CORS_ORIGIN` from the environment. **Do not bind port 3030 to the internet** without auth and a locked origin.

Details: **[SECURITY.md](SECURITY.md)**.

---

## Quick Start (demo — same as Vercel)

```bash
bun install
bun run dev
```

Open **http://localhost:3000**.

---


## License

MIT License. See [LICENSE](LICENSE).
