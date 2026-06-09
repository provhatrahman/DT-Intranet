# Greenroom Backend Integration — Status (8 June 2026)

Summary of frontend work to connect ryOS to the live Greenroom Django backend on AWS API Gateway.

**Base URL:** `https://jzre02jvh9.execute-api.eu-west-2.amazonaws.com/api`  
**Plan reference:** `.cursor/plans/greenroom_backend_integration_7846b79d.plan.md` (not modified)

---

## What we did today

Replaced localStorage and dummy data with live API calls across the project lifecycle apps, aligned frontend data models with the real backend schema, and stubbed broken services so they can be wired up later without rework.

### 1. API layer (`src/lib/api/`)

| File | Status |
|------|--------|
| `projects.ts` | Live — list, detail, create, update, status, assign-team, archive, wrap-up |
| `artists.ts` | Live — list, detail, find-by-name, create |
| `payments.ts` | Live — list, get, create, update |
| `events.ts` | Stubbed — typed per docs; **not called from UI** (backend 500) |
| `bookings.ts` | Stubbed — typed per docs; **not called from UI** (backend 500) |
| `pitches.ts` | Pre-existing; used as the pattern for new libs |

### 2. Zustand stores (`src/stores/`)

| Store | Purpose |
|-------|---------|
| `useProjectsStore.ts` | Active/all projects, detail cache, create, status, team, wrap-up |
| `useArtistsStore.ts` | Artist list, detail cache, find-by-name |
| `usePaymentsStore.ts` | Payments per project, status updates |

### 3. App changes

| App | Before | After |
|-----|--------|-------|
| **Inbox (Incoming Offers)** | Pitches from API + dummy offers; approve wrote to localStorage | Pitches live; dummy offers only for events/bookings fallback; approve creates backend project + links pitch (`project_id`, `status: approved`) |
| **Active Projects** | Full localStorage + `djDatabase.ts` dummy DJs | `useProjectsStore` + `useArtistsStore`; lineup = project members via `assign-team`; Mark Complete → `updateProjectStatus('completed')` |
| **Archive** | localStorage + dummy Revolut transactions | Completed/cancelled projects from API; real payments; single wrap-up record (`summary`, `lessons_learned`) |
| **Pitch** | Already integrated | Vote miscount fix in Inbox (see below) |

### 4. Removed / replaced

- `src/apps/active-projects/djDatabase.ts` — deleted (~93 KB dummy data)
- `src/apps/archive/utils/bankTransactions.ts` — deleted (mock Revolut checks)
- Cross-app `localStorage` + `CustomEvent` sync (`active-projects-updated`, `archived-projects-updated`, etc.)

### 5. Design decisions (agreed)

- **Frontend-only fields removed** from UI where the backend has no column (venue, promoter, timings, projectSize, statusUpdates, curationSuggestions, googleDriveLink, etc.).
- **Lineup** = backend project `members` via `assign-team` (artist_id + role_in_project).
- **Artist detail** fetched on demand for genres/socials; **gigScore hidden** until analytics is fixed.
- **Budget** maps to project `budget` (string); **deadline** = `end_date`.

### 6. Bug fix

**Pitch vote miscount in Inbox:** `vote_value: 0` with no `[INTERESTED]` or `[RECOMMEND]` comment prefix is no longer counted as "interested". Only prefixed comments map to interested/recommend; bare zeros are abstain/comment-only.

---

## Backend status (for stakeholder meeting)

### Working (200 OK) — integrated in UI

- `/api/pitches/`
- `/api/projects/`
- `/api/artists/`
- `/api/payments/`

### Broken (500 — Django ProgrammingError) — flag with backend team

| Service | Endpoints | Frontend impact |
|---------|-----------|-----------------|
| **Events** | `/api/events/` | Inbox cannot show real event offers |
| **Bookings** | `/api/bookings/` | Inbox cannot show real booking/promoter offers |
| **Analytics** | `/api/analytics/gig-scores/` | Gig scores not shown (intentionally hidden) |

**Note:** `/health/` routes do not exist on this backend; do not use them as a health signal.

### Backend quirk (worked around)

- `GET /api/projects/?status=` only filters reliably for `status=active`. Other values return all projects. Archive app fetches all and **filters client-side** for `completed` and `cancelled`.

### Real data shapes (differs from docs in places)

- Project `status`: `active`, `completed`, `on_hold`, `cancelled` (no `archived`, no `in_progress`).
- `budget` is a string (e.g. `"33272"`).
- Payment `status`: `pending`, `issued`, `paid`, `overdue`, `cancelled`.

---

## Data lifecycle (now backend-backed)

```
Pitch app → POST /api/pitches/
    → Inbox (vote, approve)
    → POST /api/projects/create/ + PATCH pitch (project_id, approved)
    → Active Projects (GET active, assign-team, update fields)
    → PATCH update-status completed
    → Archive (client-filter completed/cancelled, payments, wrap-up)

Events/Bookings (500) ──► dummyOffers fallback in Inbox only
```

---

## Local testing

```powershell
cd c:\Projects\ryos
bun install
bun run dev
```

- API calls go **browser → AWS** directly (CORS open). **Network tab (Fetch/XHR)** is the main place to see requests/responses; the dev server terminal does not log them.
- Optional `.env.local` for write actions (vote, approve, pitch submit):

  ```env
  VITE_DEV_GREENROOM_USER_ID=<valid_backend_user_id>
  VITE_DEV_GREENROOM_USER_DISPLAY=Dev Tester
  ```

  See also: `docs/dev-greenroom-test-user.md`

- **API Tester** desktop app can probe endpoints without going through Inbox/Active Projects.

`bunx tsc --noEmit` passes after integration. Changes are **not committed** unless requested.

---

## Remaining dummy / local data (not API or database)

Everything below is intentional until the broken backend services are repaired, or until dummy offers are fully replaced.

| Location | What | Used for | Replace with (when ready) |
|----------|------|----------|---------------------------|
| `src/apps/incoming-offers/data.ts` → `dummyOffers` | 6 hardcoded email/form event offers | Inbox cards for non-pitch incoming offers | `GET /api/bookings/` + `GET /api/events/` |
| `src/apps/incoming-offers/data.ts` → `initialVoteCounts` | Fake vote totals per dummy offer id (`"1"`–`"6"`) | Vote button counts on dummy offer cards | Real booking/event vote model (TBD) or remove if N/A |
| `IncomingOffersAppComponent.tsx` → `USE_DUMMY_EVENT_OFFERS = true` | Feature flag gating dummy offers | Toggle between fallback and live events/bookings | Set `false` + wire `getBookings()` / `getEvents()` |
| `IncomingOffersAppComponent.tsx` → `localStorage` key `incoming_offers_votes` | Persists accept/decline/etc. for **dummy offers only** | Vote UI state across page refresh for non-pitch cards | Backend vote/status on bookings (TBD) |
| `IncomingOffersAppComponent.tsx` → `approvedDummyIds` (React state) | Hides approved dummy cards for current session only | UX after approving a dummy offer | Booking status update on backend |
| Inbox pitch cards — `promoter`, `venue`, `fee`, `timings` | Parsed from **pitch description** metadata (`parsePitchDescription`) | Display fields on pitch-sourced offer cards | Optional: richer pitch fields or linked event/booking records |
| Active Projects / Archive lineup UI | **gigScore** not shown | Was in deleted `djDatabase.ts` | `GET /api/analytics/gig-scores/` per artist |
| `src/lib/api/events.ts` | Full typed client exists | Not imported by any app component | Wire into Inbox when events service is fixed |
| `src/lib/api/bookings.ts` | Full typed client exists | Not imported by any app component | Wire into Inbox when bookings service is fixed |

### Fully API-backed (no dummy data)

| Area | Source |
|------|--------|
| Pitch app — list, create, update, delete | `/api/pitches/` |
| Inbox — pitch offers, pitch voting, pitch approve | `/api/pitches/` + `/api/projects/` |
| Inbox — approve (all offer types) | `POST /api/projects/create/` (dummy offers also create a real project) |
| Active Projects — list, detail, edit, lineup, complete | `/api/projects/` + `/api/artists/` |
| Archive — list, detail, wrap-up, payments | `/api/projects/` + `/api/payments/` |

### Removed in this integration (no longer dummy)

- `src/apps/active-projects/djDatabase.ts` — replaced by `/api/artists/`
- `src/apps/archive/utils/bankTransactions.ts` — replaced by `/api/payments/`
- `localStorage` keys `active_projects_list`, `archived_projects_list`, `incoming_offers_list` — removed from project lifecycle flow
- Cross-app `CustomEvent` sync (`active-projects-updated`, `archived-projects-updated`, etc.)

---

## Inbox fallback flag

In `IncomingOffersAppComponent.tsx`:

```ts
const USE_DUMMY_EVENT_OFFERS = true;
```

Set to `false` and wire `getBookings()` / `getEvents()` once the backend 500s are fixed.

---

## Still blocked on backend

1. Repair **events** and **bookings** services (migrations / DB schema).
2. Repair **analytics/gig-scores** if gig scores should return in Active Projects / Archive lineup UI.
3. Fix **projects `?status=`** filter for non-active statuses (optional; client-side filter works today).

---

## Suggested next steps

1. Backend team fixes events/bookings/analytics; frontend flips `USE_DUMMY_EVENT_OFFERS` and connects stubbed API libs.
2. Smoke-test full flow: pitch → inbox vote → approve → active project → assign artist → complete → archive wrap-up + payment status.
3. Confirm a shared dev `user_id` for local testing across the team.
4. Commit integration when ready for review.

---

## Files touched (high level)

**New:** `src/lib/api/{projects,artists,payments,events,bookings}.ts`, `src/stores/{useProjectsStore,useArtistsStore,usePaymentsStore}.ts`

**Reworked:** `src/apps/active-projects/{data.ts,components/ActiveProjectsAppComponent.tsx}`, `src/apps/archive/{data.ts,components/ArchiveAppComponent.tsx}`, `src/apps/incoming-offers/components/IncomingOffersAppComponent.tsx`

**Deleted:** `src/apps/active-projects/djDatabase.ts`, `src/apps/archive/utils/bankTransactions.ts`
