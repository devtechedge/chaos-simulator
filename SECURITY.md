# Security Assessment - Chaos Simulator

**Date:** 2026-09-06
**Revised:** 2026-09-16 (socket layer removed from this repo)
**Scope:** Auth, injection, XSS, dependency risk, network exposure, secrets hygiene
**Context:** The public deploy is a **client-side simulation** on Vercel. This repository ships the
dashboard only: there is no Socket.io server, no `/api` routes, and no rewrite to a local engine.

> **Revision note.** Earlier revisions described a local Bun + Socket.io chaos engine and a
> `next.config.ts` rewrite proxying `/socket.io/*` to `localhost:3030`. That engine is not part of
> this repository and Vercel's serverless runtime cannot host a long-lived socket server, so the
> rewrite was dead config and has been removed. Sections about a local control plane are kept as
> guidance for anyone who adds one later, and are marked as such.

---

## Executive summary

| Area | Risk | Notes |
|------|------|--------|
| Authentication | **N/A (by design)** | No user login; public demo dashboard |
| Authorization | **N/A** | No server-side control plane in this repo |
| XSS | **Low** | No `dangerouslySetInnerHTML` found; React text escaping used |
| Injection (SQL) | **N/A** | No database; Prisma/SQLite template removed |
| Dependency CVEs | **Reduced** | Unused packages dropped; remaining high-risk template deps gone |
| Secrets in repo | **Low** | `.env*` gitignored; `.env.example` has no secrets |
| CORS | **N/A** | No server, so no cross-origin surface |
| Build config | **Hardened** | `ignoreBuildErrors` is **false** - type errors fail CI/build |

**Overall (public Vercel demo):** Low residual risk. The product is a browser-only simulation with
no backend secrets and no auth boundary to break.

**If a real control plane is added later:** it becomes an unauthenticated control plane over
services unless auth and a locked origin are added first. Treat port 3030 and any socket endpoint
as private by default.

---

## 1. Authentication & session

**Findings**
- Public site requires no login (expected for a portfolio telemetry demo).
- Template leftovers (`next-auth`, Prisma `User`/`Post`) have been **removed**.

**Verdict:** Auth is intentionally absent for the demo. Do not claim "secured with NextAuth".

**If auth is added later:** protect any mutating API or socket events with session checks; never
rely on client-only flags.

---

## 2. Injection (command / SQL / event payload)

**Findings**
- The whole app is client-side (`useChaosEngine`); there is no SQL and no server handler.
- Scenario `name` is echoed into logs and UI; treat it as an untrusted display string (React
  escapes text nodes).
- Chaos inputs (`service`, anomaly `type`, scenario steps) are attacker-controlled in the sense
  that a visitor can type anything, so they still need bounds.

**Hardening applied**
- Allow-list for service names and anomaly types (`src/lib/chaos-validation.ts`).
- Cap scenario name length and step count.
- Malformed payloads are rejected before they reach the simulation.

**If a server is added later:** apply the same allow-lists server-side too. Client-side validation
is a UX affordance, not a security boundary.

---

## 3. XSS

**Findings**
- Code search found **no** `dangerouslySetInnerHTML` in the app.
- Logs, scenario names, and service labels render as React text, so they get default escaping.
- Unused Markdown/MDX packages were removed so they cannot become a future XSS vector by accident.

---

## 4. Dependency / supply chain

### Cleanup (this pass)

Removed unused template packages (and their CVE surface):

- `next-auth`, `prisma`, `@prisma/client`
- `@mdxeditor/editor`, `react-syntax-highlighter`, `js-yaml` (transitive)
- `z-ai-web-dev-sdk`, `next-intl`, `zustand`, `zod` (unused), `@tanstack/*`, `@dnd-kit/*`, `cmdk`, `vaul`, `sonner`, `react-hook-form`, `react-markdown`, `react-day-picker`, `uuid`, and unused Radix/shadcn widgets

**Held:** `sharp` 0.34.x (Next 16 image pipeline; no untrusted uploads).

**Removed with the socket layer:** `socket.io` and `socket.io-client` are no longer dependencies,
so their CVE surface is gone from this repo.

### How to re-audit

```bash
bun install
npm audit --omit=dev
```

---

## 5. Network exposure

**Current state:** none. There is no server in this repo, no listening port, and no proxy rule, so
the deploy has nothing to expose.

**Guidance if a control plane is added later**
- Read the allowed origin from `CORS_ORIGIN`; never default to `*` on a public host.
- Validate every socket payload against the §2 allow-lists.
- Operational rule: never expose the engine port to the internet without authentication and a
  locked `CORS_ORIGIN`.
- Vercel's serverless runtime cannot host a long-lived socket server. A persistent-process host is
  required.

---

## 6. Secrets & config hygiene

**Findings**
- `.gitignore` excludes `.env`, `.env*.local`, and logs.
- `.env.example` documents optional vars only and contains no credentials.

---

## 7. Next.js / HTTP surface

| Endpoint | Auth | Notes |
|----------|------|--------|
| Dashboard `/` | None | Client-side simulation |

No `/api` routes ship with this app. The placeholder `GET /api` "Hello, world!" route was removed
in an earlier pass, and the `/socket.io/*` rewrite to `localhost:3030` was removed on 2026-09-16.

`next.config.ts` sets security headers for `/:path*` and keeps `ignoreBuildErrors` **off**.

---

## 8. Residual risk & acceptance

**Accepted for portfolio demo**
- No user authentication on the public site.
- Client-side chaos controls (they only affect the browser simulation).
- `sharp` 0.34.x until Next 16 tracks 0.35.

**Not acceptable if a server is added later**
- Open socket mutations without auth.
- `CORS_ORIGIN=*` on a public host.

---

## 9. Follow-ups (ordered)

1. **Done:** SECURITY.md + allow-lists / payload guards + CORS env documentation.
2. **Done:** Dependency audit triage.
3. **Done:** Unit tests (`bun run test`).
4. **Done:** Drop unused deps; Prisma/NextAuth/z.ai template files; `ignoreBuildErrors: false`.
5. **Done:** GitHub Dependabot + Playwright e2e (dashboard render, Scenario Builder, inject, partition) on CI.
6. **Done (2026-09-16):** remove the `/socket.io/*` rewrite and the Socket.io badges; retarget the
   docs at the browser-only architecture this repo actually ships.

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

This repository is currently **public** for portfolio review. When the open-source build story is
no longer needed, **the GitHub repo will go private**. Making the repo private reduces source
disclosure; it does **not** replace strong production secrets, auth allow-lists, webhook
signatures, or Vercel/Actions environment hygiene. Rotate any credential that was pasted into chat,
tickets, or screenshots.
