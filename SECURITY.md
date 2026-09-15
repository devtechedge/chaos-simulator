# Security Assessment - Chaos Simulator

**Date:** 2026-09-06  
**Scope:** Auth, injection, XSS, dependency risk, CORS, Socket.io surface, secrets hygiene  
**Context:** Public deploy is a **client-side simulation** (Vercel). Real Bun + Socket.io engine is **local-only** by design.

---

## Executive summary

| Area | Risk | Notes |
|------|------|--------|
| Authentication | **N/A (by design)** | No user login; public demo dashboard |
| Authorization | **High if engine is exposed** | Any Socket.io client can inject chaos / restart services |
| XSS | **Low** | No `dangerouslySetInnerHTML` found; React text escaping used |
| Injection (SQL) | **N/A** | Prisma/SQLite template **removed** |
| Dependency CVEs | **Reduced** | Unused packages dropped; remaining high-risk template deps gone |
| Secrets in repo | **Low** | `.env*` gitignored; `.env.example` has no secrets |
| CORS | **Medium (local engine)** | Engine defaults to `origin: '*'` |
| Build config | **Hardened** | `ignoreBuildErrors` is **false** - type errors fail CI/build |

**Overall (public Vercel demo):** Low residual risk - browser-only simulation, no backend secrets, no auth boundary to break.

**Overall (local chaos-engine if bound to a public network):** High - unauthenticated control plane over services.

---

## 1. Authentication & session

**Findings**
- Public site requires no login (expected for a portfolio telemetry demo).
- Template leftovers (`next-auth`, Prisma `User`/`Post`) have been **removed**.

**Verdict:** Auth is intentionally absent for the demo. Do not claim “secured with NextAuth”.

**If auth is added later:** protect any mutating API/Socket events with session checks; never rely on client-only flags.

---

## 2. Injection (command / SQL / event payload)

**Findings**
- Active demo path is client-side (`useChaosEngine`); no SQL on the hot path.
- Local engine Socket handlers accept `{ service, type }`, scenario name/steps, etc.
- Scenario `name` is echoed into logs and UI; treat as untrusted display string (React escapes text nodes).

**Hardening applied**
- Allow-list for service names and anomaly types on the engine (`src/lib/chaos-validation.ts`).
- Cap scenario name length and step count.
- Reject malformed socket payloads early.

---

## 3. XSS

**Findings**
- Code search found **no** `dangerouslySetInnerHTML` in the app.
- Logs, scenario names, and service labels render as React text → default escaping.
- Unused Markdown/MDX packages were removed so they cannot become a future XSS vector by accident.

---

## 4. Dependency / supply chain

### Cleanup (this pass)

Removed unused template packages (and their CVE surface):

- `next-auth`, `prisma`, `@prisma/client`
- `@mdxeditor/editor`, `react-syntax-highlighter`, `js-yaml` (transitive)
- `z-ai-web-dev-sdk`, `next-intl`, `zustand`, `zod` (unused), `@tanstack/*`, `@dnd-kit/*`, `cmdk`, `vaul`, `sonner`, `react-hook-form`, `react-markdown`, `react-day-picker`, `uuid`, and unused Radix/shadcn widgets

**Held:** `sharp` 0.34.x (Next 16 image pipeline; no untrusted uploads).

**Engine:** `socket.io@4.8.3` - last audit was clean.

### How to re-audit

```bash
bun install
npm audit --omit=dev
```

---

## 5. CORS & network exposure (chaos-engine)

**Hardening applied**
- CORS origin from `CORS_ORIGIN` env (default remains `*` for local DX, documented as unsafe for public bind).
- Socket payload validation (see §2).

**Operational rule**
> Never expose port 3030 to the internet without authentication and a locked `CORS_ORIGIN`.

---

## 6. Secrets & config hygiene

**Findings**
- `.gitignore` excludes `.env`, `.env*.local`, logs.
- `.env.example` documents optional `NEXT_PUBLIC_CHAOS_ENGINE_URL`, `CORS_ORIGIN`, `PORT` - no credentials.

---

## 7. Next.js / HTTP surface

| Endpoint | Auth | Notes |
|----------|------|--------|
| Dashboard `/` | None | Client-side simulation |
| Engine `GET /api/telemetry` | None | Read-only simulation state (local) |
| Engine `GET /health` | None | Health check |
| Socket.io events (mutate) | **None** | Control plane - protect if exposed |

Placeholder `GET /api` “Hello, world!” route **removed**.

`next.config.ts` rewrites `/socket.io/*` → `localhost:3030` (local only). TypeScript `ignoreBuildErrors` is **off**.

---

## 8. Residual risk & acceptance

**Accepted for portfolio demo**
- No user authentication on the public site.
- Client-side chaos controls (they only affect the browser simulation).
- `sharp` 0.34.x until Next 16 tracks 0.35.

**Not accepted if engine is public**
- Open Socket.io mutations without auth.
- `CORS_ORIGIN=*` on a public host.

---

## 9. Follow-ups (ordered)

1. **Done:** SECURITY.md + engine allow-lists / payload guards + CORS env documentation.  
2. **Done:** Dependency audit triage.  
3. **Done:** Unit tests (`bun run test`).  
4. **Done:** Drop unused deps; Prisma/NextAuth/z.ai template files; `ignoreBuildErrors: false`.  
5. **Done:** GitHub Dependabot + Playwright e2e (dashboard render, Scenario Builder, inject, partition) on CI.

---

## 10. How to re-test

```bash
bun install
bun run test
bun run typecheck
bun run test:e2e
npm audit --omit=dev
```

## Repository visibility

This repository is currently **public** for portfolio review. When the open-source
build story is no longer needed, **the GitHub repo will go private**. Making the
repo private reduces source disclosure; it does **not** replace strong production
secrets, auth allow-lists, webhook signatures, or Vercel/Actions environment
hygiene. Rotate any credential that was pasted into chat, tickets, or screenshots.
