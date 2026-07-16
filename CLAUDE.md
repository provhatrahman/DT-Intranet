# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Identity

This repo is **Greenroom** (package name `greenroom`), built on top of **ryOS** — a web-based desktop-environment OS (classic Mac/Windows look) with built-in apps and a system-aware AI assistant ("Ryo"). Greenroom layers a **music-industry domain** on top of the ryOS shell: domain apps like Active Projects, Pitch, Inbox/Incoming Offers, and Archive, backed by an external Greenroom API for artists, projects, bookings, pitches, payments, and events.

Much of the codebase, comments, docs, and the AI persona still say "ryOS" / "ryo.lu". Treat ryOS as the underlying platform and Greenroom as the product skin + domain layer on top of it.

## Commands

Package manager is **Bun**. Most scripts run through `bun run`.

```bash
bun install              # install deps
bun run dev:vercel       # PREFERRED dev server — runs `vercel dev`, needed for /api routes
bun dev                  # Vite-only dev (UI works, but /api endpoints will 404)
bun run build            # tsc -b + vite build (+ copies SW/version assets for Vercel)
bun run lint             # eslint .
bun run preview          # preview production build
```

Because the frontend calls local `/api/*` serverless functions, **use `bun run dev:vercel`** for anything touching chat, AI, lyrics, chat rooms, etc.

### Tests

Tests are **integration tests that hit a running API server** (`vercel dev` on `localhost:3000`), not unit tests. Start the server first, then:

```bash
bun run test                 # run all API test suites (tests/run-all-tests.ts)
bun run test:chat-rooms      # a single suite
bun run test:lyrics
# ...other test:* scripts in package.json map 1:1 to tests/test-*.ts
# Override target with: API_URL=https://... bun run test
```

### Tauri (desktop builds)

`bun run tauri:dev`, `bun run tauri:build` (and `:mac` / `:windows`). When `TAURI_ENV` is set the Vite config drops the Vercel + PWA plugins.

### i18n / asset generation

`bun run i18n:extract`, `i18n:sync`, `i18n:translate` (machine translation), and `generate:icons` / `generate:wallpapers` regenerate manifests. See `scripts/` for the implementations.

## Architecture

### Window / instance manager

The OS shell is driven by `useAppStore` (`src/stores/useAppStore.ts`) and rendered by `AppManager` (`src/apps/base/AppManager.tsx`). Key model:

- Apps are **multi-instance** — each open window is an `AppInstance` keyed by `instanceId`. `instanceOrder` is z-order (END = foreground); `foregroundInstanceId` tracks focus.
- Use `launchApp(appId, initialData?, title?, multiWindow?)` to open windows. Legacy app-level APIs (`toggleApp`, `closeApp`, `bringToForeground`) are thin wrappers kept for compatibility.
- The store is persisted (Zustand `persist`) and versioned with migrations.

### App registry & adding an app

Every app is registered in two places:

1. `src/config/appIds.ts` — the canonical `appIds` tuple; `AppId` is derived from it. Adding an id here is required and also affects the AI `launchApp` tool (it `z.enum(appIds)`).
2. `src/config/appRegistry.tsx` — maps each id to a lazy-loaded component, icon, description, `windowConfig` (sizes), `helpItems`, `metadata`, and flags like `hidden` (not shown in app launchers) and `adminOnly` (only the `ryo` admin user).

App modules live in `src/apps/[app-name]/`. Conventions (see `.cursor/rules/general-rules.mdc`):

- Main component is `[AppName]AppComponent.tsx` under `components/`, exported and lazy-imported in the registry via `createLazyComponent`.
- `src/apps/[app-name]/index.tsx` re-exports `appMetadata` and `helpItems` (imported eagerly by the registry).
- Folders within an app: `components/`, `hooks/`, `utils/`, `types/`; plus `commands/` (Terminal) and `extensions/` (TextEdit).
- All apps receive the shared `AppProps<TInitialData>` (`src/apps/base/types.ts`). Window chrome comes from the shared `WindowFrame`. Each app defines its own menu bar.
- **Theme-aware menu bars**: for `xp`/`win98` themes the menu bar is passed as the `menuBar` prop to `WindowFrame` (it's a taskbar); for other themes it renders normally outside the frame. See the comment block at the bottom of `src/apps/base/types.ts`.

### State management

Zustand stores in `src/stores/`, named `use[Name]Store`. Most are persisted to localStorage/IndexedDB. Two categories:

- **OS/platform stores**: `useAppStore`, `useThemeStore`, `useFilesStore`, `useChatsStore`, `useIpodStore`, etc.
- **Greenroom domain stores**: `useProjectsStore`, `useArtistsStore`, `usePaymentsStore`, `usePitchesStore`, `useGreenroomAccountStore`. These wrap the external Greenroom API.

Prefer `useAppStoreShallow` / shallow selectors (`src/stores/helpers.ts`) to avoid re-renders.

### Two backends — don't confuse them

1. **ryOS API** (`api/*.ts`, this repo's Vercel serverless functions): AI chat (`api/chat.ts`), Internet Explorer generation, lyrics/translation, speech/transcription, link previews, and **chat rooms** (`api/chat-rooms/`, backed by **Upstash Redis** + **Pusher** realtime). Auth/rate-limiting utilities live in `api/utils/`. AI models are abstracted in `api/utils/aiModels.ts` and prompts in `api/utils/aiPrompts.ts` (OpenAI / Anthropic / Google via the Vercel AI SDK).

2. **Greenroom domain API** (external, AWS API Gateway): base URL in `src/config/greenroomApi.ts` (`GREENROOM_API_BASE`). Typed client functions live in `src/lib/api/*.ts` (`projects.ts`, `artists.ts`, `bookings.ts`, `events.ts`, `payments.ts`, `pitches.ts`) and are consumed by the domain stores. These use plain `fetch` against the external base — they are **not** routed through this repo's `/api`. Note the documented quirks in `src/lib/api/projects.ts` (e.g. the unreliable `?status=` filter → fetch-all-and-filter-client-side for archived projects).

### Agentic AI layer

`api/chat.ts` is the core: it `streamText`s with the Vercel AI SDK and exposes **tools that drive the OS** (e.g. `launchApp` to open apps, with special URL/year handling for Internet Explorer's "time machine"). The AI receives a `SystemState` snapshot (current IE page, video/iPod track, open TextEdit instances, theme, locale, etc.) so it can act on live UI state. When adding OS-control capabilities, extend the tools here and the corresponding client wiring.

### Build / PWA specifics

- `vite.config.ts` defines aggressive **manual chunking** (heavy libs like `tone`, `three`, `tiptap`, `ai-sdk`, `shiki` are split so they load only when their app opens). Keep new heavy deps out of the critical path.
- A **service worker** (vite-plugin-pwa / Workbox) handles offline + caching with per-asset-type strategies. `navigateFallbackDenylist` keeps `/api/*` and OG-preview deep links from being served `index.html`. App deep links are also listed in `vercel.json` rewrites.
- Path alias `@/*` → `src/*` (configured in both `tsconfig.json` and `vite.config.ts`).

### Themes

Four OS themes: `system7`, `macosx` (Aqua), `xp`, `win98`. Current theme is in `useThemeStore`; theme definitions in `src/themes/`. XP/98 are structurally different (taskbar vs top menu bar) — check `currentTheme === "xp" || "win98"` when doing window/menu chrome work.

## Resetting local data

ryOS state lives in localStorage (keys prefixed `ryos:`, `dock-`, `app_`, `_usr_`, `_auth_`) and an IndexedDB database named `ryOS`. The README has a console snippet to clear both; refresh afterward to reinitialize defaults.

## Greenroom development & operations (CLI)

Operational source of truth for developing and shipping Greenroom. Full walkthrough: `DEVELOPMENT.md`. Step-by-step procedures are packaged as skills in `.claude/skills/` (`greenroom-local-dev`, `greenroom-deploy-frontend`, `greenroom-deploy-backend`, `greenroom-db-change`) — prefer invoking those for the actual moves.

**Repos & branch.** Frontend = this repo (`ryos`). Backend = `c:\Projects\backend` (Django split into per-domain AWS Lambdas; github.com/arronS22/greenroom-backend). Active dev branch on both = **`greenroom-develop`**.

**AWS.** Account `471028617262`, region `eu-west-2`, CLI profile **`greenroom-cli`** (admin). Always pass `--profile greenroom-cli`. NOTE: the SSO profile `AdministratorAccess-471028617262` is **MFA-locked/unusable** — the deploy scripts default to it, so always override with `greenroom-cli`.

**Local dev loop** (isolated, safe): backend `cd c:\Projects\backend && .venv\Scripts\python manage.py runserver 8000` (serves all `/api/<domain>/` from the dev DB); frontend `GREENROOM_API_TARGET=http://localhost:8000 bun dev` (env-driven proxy in `vite.config.ts`; unset → prod). `bun run dev:vercel` runs the frontend against the **prod** Greenroom API (needed for ryOS AI `/api` routes).

**Databases** (one RDS `prod-postgres…eu-west-2`): **dev** = `greenroom_dev` as `devuser` (what `.env` points at — an isolated clone, cannot touch prod); **prod** = `DT-Test` as `appdaytimers` (real data). Domain-table schema is **hand-run SQL** (`backend/scripts/sql/*.sql`), NOT Django migrations. Postgres client at `C:\Program Files\PostgreSQL\18\bin`.

**Deploy.** Frontend → `AWS_PROFILE=greenroom-cli .\deploy.ps1` (build → S3 `daytimers-intranet-prod-471028617262` → CloudFront `E3OF10QS7S5YPV`; live at greenroom.daytimers.org). Backend → push to `main` (GitHub Actions builds + uploads `*-service.zip` to S3), then `aws lambda update-function-code --function-name prod-<domain>-service --s3-bucket prod-lambda-artifacts-471028617262 --s3-key <domain>-service.zip`. Do NOT build Lambda zips locally (Windows/Py3.13 ≠ Lambda Linux/Py3.11).

**Safety.** Prod RDS: deletion protection ON, 7-day backups, restore snapshot `prod-postgres-predev-20260716`. Take a fresh snapshot before any prod schema change. Each prod Lambda has published version `1` as a rollback point. `DEBUG=False` in prod (SSM `/prod/app/debug=false`); `DEBUG=True` locally.

**Known limitation:** the Greenroom API has **no authentication** — all gateway routes are open and writes are anonymous. Frontend "admin" (`src/config/greenroomAdmins.ts`) is UI-only, not enforced. To be addressed later via development; do not treat it as access control.
