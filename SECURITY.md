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
| Dependency CVEs | **Triaged** | 0 critical, 5 high, 4 moderate — see §4 |
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

**Hardening applied**
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

## 4. Dependency / supply chain (npm audit — 2026-08-20)

Ran `npm audit` against the current `package.json` ranges (965 packages resolved). **0 critical, 5 high, 4 moderate.**

Local engine (`socket.io@4.8.3`) audit: **0 vulnerabilities.**

GitHub Dependabot alerts are **disabled** on this repo (API 403). Enable them in Settings → Code security.

### High

| Package | Direct? | Issue | Exploitability here | Action |
|---------|---------|-------|---------------------|--------|
| `prisma` / `@prisma/config` / `deepmerge-ts` | Yes (`prisma`) | Stack exhaustion merging recursive objects (`GHSA-ggr8-5vv4-36mx`). Affects Prisma **6.13.0+** through ~7.10 | **Low** — Prisma is unused on the live demo path; only matters if `prisma` CLI parses hostile config | **Pinned to `6.12.0`** (below vulnerable range). Better later: remove unused Prisma |
| `sharp` `<0.35.0` | Yes | Inherited libvips CVEs (`GHSA-f88m-g3jw-g9cj`) | **Low** on this demo — Next uses sharp at **build/image** time, not for untrusted user uploads | **Hold at 0.34.x** until Next 16 officially tracks 0.35; do not process untrusted images |
| `js-yaml` (via `@mdxeditor/editor`) | Transitive | YAML DoS (quadratic merge keys / `!!omap`) | **Low** — MDX editor is unused in the chaos UI; no YAML user input | Prefer **remove unused `@mdxeditor/editor`**. Alt: upgrade editor to 4.2.0 (major) |

### Moderate

| Package | Direct? | Issue | Exploitability here | Action |
|---------|---------|-------|---------------------|--------|
| `react-syntax-highlighter` 15.x → `prismjs` DOM clobber | Yes | `GHSA-x7hr-w5r2-h6wg` | **Low** unless highlighter renders untrusted HTML | Prefer **remove unused highlighter**. Alt: jump to 16.1.1 (major) |
| `@mdxeditor/editor` ≤4.0.3 | Yes | Pulls vulnerable `js-yaml` | Same as js-yaml | Remove or major-upgrade |

### Not in this audit report, but relevant

| Package | Notes |
|---------|--------|
| `next-auth` | **Pinned to `4.24.15`** (fixes `CVE-2026-73418` / `getToken()` DoS). Package is **unused** — still safest to delete later |
| `next` 16.x | No advisory in this audit run |
| `socket.io` / `socket.io-client` 4.8.3 | Clean |

### Unused deps that inflate attack surface (cleanup later)

These are template leftovers, not used by the public dashboard:

- `next-auth`
- `prisma` / `@prisma/client`
- `@mdxeditor/editor`
- `react-syntax-highlighter`
- `next-intl` (likely)
- `z-ai-web-dev-sdk`

Removing them is better than patching them.

### How to re-audit

```bash
bun install
npm audit
# or: bun run audit
```

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

**Hardening applied**
- CORS origin from `CORS_ORIGIN` env (default remains `*` for local DX, documented as unsafe for public bind).
- Socket payload validation (see §2).

**Operational rule**
> Never expose port 3030 to the internet without authentication and a locked `CORS_ORIGIN`.

---

## 6. Secrets & config hygiene

**Findings**
- `.gitignore` correctly excludes `.env`, `.env*.local`, Prisma DB files, logs.
- `.env.example` documents optional `NEXT_PUBLIC_CHAOS_ENGINE_URL`, `CORS_ORIGIN`, `PORT` — no credentials.

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
- `sharp` 0.34.x until Next 16 tracks 0.35 (no untrusted image pipeline).

**Not accepted if engine is public**
- Open Socket.io mutations without auth.
- `CORS_ORIGIN=*` on a public host.

---

## 9. Follow-ups (ordered)

1. **Done:** SECURITY.md + engine allow-lists / payload guards + CORS env documentation.  
2. **Done:** Dependency audit triage; pin Prisma 6.12.0; pin next-auth 4.24.15.  
3. **Done:** Unit tests for validation helpers, simulation transitions, and Scenario Builder presets (`bun run test`).  
4. **Later:** Remove unused deps; drop `ignoreBuildErrors`; enable GitHub Dependabot; optional e2e/Playwright.

---

## 10. How to re-test

```bash
bun install
npm audit

# Local engine only — confirm validation rejects bad payloads
cd mini-services/chaos-engine && bun index.ts

# Confirm .env is not tracked
git check-ignore -v .env .env.local
```
