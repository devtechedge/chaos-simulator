# Security Assessment — Chaos Simulator

**Date:** 2026-08-20  
**Scope:** Auth, injection, XSS, dependency risk, CORS, Socket.io surface, secrets hygiene  
**Context:** Public deploy is a **client-side simulation** (Vercel). Real Bun + Socket.io engine is **local-only** by design.

---

## Executive summary

| Area | Risk | Notes |
|------|------|--------|
| Authentication | **N/A (by design)** | No user login; public demo dashboard |
| Authorization | **High if engine is exposed** | Any Socket.io client can inject chaos / restart services |
| XSS | **Low** | No `dangerouslySetInnerHTML` found; React text escaping used |
| Injection (SQL) | **N/A in active path** | Prisma/SQLite present as template; not used by demo UI |
| Dependency CVEs | **Needs audit** | Run `bun audit` / `npm audit` on every release |
| Secrets in repo | **Low** | `.env*` gitignored; `.env.example` has no secrets |
| CORS | **Medium (local engine)** | Engine defaults to `origin: '*'` |
| Build config | **Process smell** | `typescript.ignoreBuildErrors: true` hides type issues |

**Overall (public Vercel demo):** Low residual risk — browser-only simulation, no backend secrets, no auth boundary to break.

**Overall (local chaos-engine if bound to a public network):** High — unauthenticated control plane over services.

---

## 1. Authentication & session

**Findings**
- `next-auth` is listed in `package.json` but **not implemented** (no auth routes, no session usage in app tree).
- Prisma `User` / `Post` models look like **scaffold leftovers**; demo path does not use the DB.
- Public site requires no login (expected for a portfolio telemetry demo).

**Verdict:** Auth is intentionally absent for the demo. Do not claim “secured with NextAuth” until routes and session guards exist.

**Recommendations**
1. If auth is never needed: remove unused `next-auth` (and unused Prisma models) in a later cleanup pass to shrink supply-chain surface.
2. If auth is added later: protect any mutating API/Socket events with session checks; never rely on client-only flags.

---

## 2. Injection (command / SQL / event payload)

**Findings**
- Active demo path is client-side (`useChaosEngine`); no SQL on the hot path.
- Local engine Socket handlers accept `{ service, type }`, scenario name/steps, etc.
- Service lookups use `Map.get(name)` — unknown names are mostly no-ops, but **types and names were not strictly validated** before hardening.
- Scenario `name` is echoed into logs and UI; treat as untrusted display string (React escapes text nodes).

**Hardening applied (this pass)**
- Allow-list for service names and anomaly types on the engine.
- Cap scenario name length and step count.
- Reject malformed socket payloads early.

---

## 3. XSS

**Findings**
- Code search found **no** `dangerouslySetInnerHTML` in the app.
- Logs, scenario names, and service labels render as React text → default escaping.
- Risk rises only if future code injects HTML/Markdown without sanitization (`react-markdown` is a dependency — unused paths should stay off or use a safe config).

**Recommendations**
- Keep rendering user/scenario strings as text.
- If Markdown is enabled later, use a sanitizing config and never pass raw HTML.

---

## 4. Dependency / supply chain

**Findings**
- Large dependency tree (Next 16, Radix, Prisma, next-auth, socket.io-client, `z-ai-web-dev-sdk`, etc.).
- No GitHub security advisories published on this repo yet.
- `typescript.ignoreBuildErrors: true` can hide broken types that sometimes correlate with unsafe patterns.

**Required ongoing practice**
```bash
bun audit
# or
npm audit --omit=dev
```
Re-run on every dependency bump and before each release.

**Recommendations**
1. Run audit locally and fix high/critical issues.
2. Prefer removing unused deps (`next-auth`, Prisma if unused, `z-ai-web-dev-sdk` if unused).
3. Turn off `ignoreBuildErrors` when practical so CI catches type regressions.

---

## 5. CORS & network exposure (chaos-engine)

**Findings (pre-hardening)**
```ts
res.setHeader('Access-Control-Allow-Origin', '*')
cors: { origin: '*', methods: ['GET', 'POST'] }
```
Any origin can call REST telemetry endpoints and open a Socket.io control channel if the engine port is reachable.

**Risk model**
- **Localhost-only** (default): acceptable for a lab demo.
- **Public IP / tunnel without auth**: anyone can trigger partitions, crashes, scenarios.

**Hardening applied (this pass)**
- CORS origin from `CORS_ORIGIN` env (default remains `*` for local DX, documented as unsafe for public bind).
- Socket payload validation (see §2).

**Operational rule**
> Never expose port 3030 to the internet without authentication and a locked `CORS_ORIGIN`.

---

## 6. Secrets & config hygiene

**Findings**
- `.gitignore` correctly excludes `.env`, `.env*.local`, Prisma DB files, logs.
- `.env.example` documents optional `NEXT_PUBLIC_CHAOS_ENGINE_URL`, `CORS_ORIGIN`, `PORT` — no credentials.
- No secret scanning hits expected for committed example config.

**Recommendations**
- Keep real secrets out of git (already).
- Prefer server-only env vars (no `NEXT_PUBLIC_`) for anything sensitive if a real backend is added later.

---

## 7. Next.js / HTTP surface

| Endpoint | Auth | Notes |
|----------|------|--------|
| `GET /api` (Next route) | None | Returns `{ message: "Hello, world!" }` — harmless |
| Engine `GET /api/telemetry` | None | Read-only simulation state |
| Engine `GET /api/anomalies` | None | Read-only |
| Engine `GET /api/latency-history` | None | Read-only |
| Engine `GET /health` | None | Health check |
| Socket.io events (mutate) | **None** | Control plane — protect if exposed |

`next.config.ts` rewrites `/socket.io/*` → `localhost:3030` (local only; not a production backend on Vercel).

---

## 8. Residual risk & acceptance

**Accepted for portfolio demo**
- No user authentication on the public site.
- Client-side chaos controls (they only affect the browser simulation).

**Not accepted if engine is public**
- Open Socket.io mutations without auth.
- `CORS_ORIGIN=*` on a public host.

---

## 9. Follow-ups (ordered)

1. **Done in this pass:** SECURITY.md + engine allow-lists / payload guards + CORS env documentation.  
2. **Next:** Run `bun audit` and record results; remove clearly unused deps.  
3. **Next:** Unit/integration tests for validation helpers and critical UI paths.  
4. **Later:** Deep code review; consider dropping `ignoreBuildErrors`; optional auth if productized.

---

## 10. How to re-test

```bash
# Dependency audit
bun install
bun audit

# Local engine only — confirm validation rejects bad payloads
cd mini-services/chaos-engine && bun index.ts
# From another terminal, attempt invalid inject-anomaly / run-scenario payloads via a socket client

# Confirm .env is not tracked
git check-ignore -v .env .env.local
```
