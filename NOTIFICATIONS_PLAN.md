# Per-User Push Notifications — Design & Implementation Plan

Status: **LIVE IN PROD** (deployed 2026-08-04, frontend v10.10; sweep = EventBridge rule
`prod-notifications-sweep` direct-invoking the users Lambda every 6h). Owner decisions locked 2026-08-04.
Note: the HTTP sweep endpoint's X-Sweep-Secret path is unreachable in prod (REQUIRE_AUTH middleware runs
first) — the direct Lambda invoke is the only cron path, which is what the EventBridge rule uses.

## Product decisions (locked)

- **Proper Web Push** notifications (VAPID), modeled on `C:\Projects\Budgeting` (web-push + per-user
  `push_subscriptions`, self-cleaning on 404/410, resubscribe self-heal), PLUS what Budgeting lacks:
  a persistent per-user notification center with server-side read state and deep linking.
- Notification types:
  1. `offer_logged` — a pitch/offer is newly created → notify **everyone** (creator included). Deep link `/open/pitch/{id}`.
  2. `vote_reminder` — every ~2 days (measured from the offer's logged date) until the offer leaves the
     inbox (approved OR closed/declined), for users who haven't responded. "Responded" = vote value
     `1`/`-1` **or** `wants_involvement=true`. Abstain (`0`) alone does NOT count. Deep link `/open/pitch/{id}`.
  3. `offer_activated` — pitch approved → project created → notify everyone. Deep link `/open/project/{id}`.
  4. `curation_reminder` — every ~2 days while a project is `active` AND `curation_deadline` (new field)
     is set AND today <= deadline, for users who have **neither added a curation suggestion nor voted on
     one** for that project. If `curation_deadline` is unset → no reminders for that project.
     Deep link `/open/project/{id}`.
  5. `test` — admin-only test notifications to self (full pipeline: DB row + real push). The test
     endpoint accepts `{type}` (any of the 5 types) and builds a realistic "[Test] "-prefixed sample —
     referencing the most recent real inbox pitch / active project for deep-link realism — so each
     notification type can be exercised end-to-end after a deploy. The Control Panels pane exposes
     **one test button per type** (admin-only).
- Existing inbox items DO generate reminders from day one (sweep is stateless over current data).
- Master on/off toggle: new **Notifications pane in Control Panels**, per-user, synced across devices via
  the `user_settings` JSONB (`notifications.enabled`), **default ON** when absent. Backend respects it
  (skips row creation + push for disabled users).
- Read/dismiss state: server-side (`notifications.read_at`), cross-device.
- Admin "Send test notification" button lives inside the new Notifications pane.

## Architecture

Pull + push hybrid:
- **Materialized `notifications` table** (per-user rows). Event triggers (pitch created / pitch approved)
  insert rows and fire Web Push immediately. A **sweep** (idempotent, run every ~6-12h by EventBridge in
  prod; manually via HTTP in dev) inserts reminder rows, deduped so a user gets a given reminder for a
  given item at most once per 2 days (dedupe window: 47h to tolerate cron drift).
- **In-app**: a poller (same pattern as `InboxBadgeSync`) fetches the list + unread count every 5 min and
  on window focus; menu-bar bell shows the center; fresh unread items surface as sonner toasts.
- **Push**: service worker `push` handler shows OS notification; `notificationclick` deep-links via
  `data.url` (focus existing client + postMessage, else `clients.openWindow(url)`).

## DB schema (new file `backend/scripts/sql/notifications.sql`, idempotent, hand-run: dev now, prod at deploy)

> **As built (deviations from the sketch below):** the notifications table is named
> **`user_notifications`** (model `UserNotification`) — a dead legacy `notifications` table from the
> original ERD already occupies that name (left untouched; its model class renamed `LegacyNotification`).
> The push util lives at **`backend/shared/utils/push.py`** (shared/ is copied into every Lambda zip;
> `api/utils.py` is a flat module so `api/utils/` wasn't creatable). `pywebpush` went into the single
> shared `requirements.txt` that builds all Lambda zips. The users Lambda handler direct-invoke branch
> (`{"task":"notifications_sweep"}`) IS implemented. Prod DDL note: run `notifications.sql` on `DT-Test`
> **as `admindaytimers`** (app roles lack REFERENCES/DDL rights — same constraint hit in dev).

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,          -- offer_logged | vote_reminder | offer_activated | curation_reminder | test
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT,                          -- app path, e.g. /open/pitch/123
  pitch_id INTEGER,                   -- soft refs (no FK; pitches/projects live in same DB but keep loose)
  project_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications(user_id, type, pitch_id, project_id, created_at);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS curation_deadline DATE;
```

## Backend (c:\Projects\backend, branch greenroom-develop)

- Models (`models/models.py`, `managed=False`): `PushSubscription`, `Notification`; add
  `curation_deadline` to `Project`.
- Push util `api/utils/push.py` (new; create `api/utils/` if absent — else place beside existing utils):
  `pywebpush`, VAPID from env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CLAIMS_EMAIL`). On
  404/410 delete the subscription row. All sends fire-and-forget (try/except; never break the request).
  `notify_users(user_ids, type, title, body, link, pitch_id=None, project_id=None)` helper: filters out
  users with `user_settings.settings->'notifications'->>'enabled' = 'false'`, bulk-inserts notification
  rows, then pushes payload `{title, body, url}` to each user's subscriptions.
- New views `api/views/notifications.py`, routes added to **BOTH** `api/urls.py` and
  `lambdas/users/urls.py` (users domain owns this):
  - `GET  /api/users/notifications/?limit=50` → `{ notifications: [...], unread_count }` (auth user's, newest first)
  - `POST /api/users/notifications/mark-read/` body `{ids:[...]} | {all:true}`
  - `POST /api/users/notifications/subscribe/` body `{endpoint,p256dh,auth,user_agent?}` (upsert on endpoint, reassign user)
  - `POST /api/users/notifications/unsubscribe/` body `{endpoint}`
  - `POST /api/users/notifications/test/` (admin-only) → row + real push to self
  - `POST /api/users/notifications/sweep/` — runs the reminder sweep. Allowed for admin bearer OR header
    `X-Sweep-Secret` == env `NOTIFICATIONS_SWEEP_SECRET`. Returns counts.
- Sweep logic:
  - vote reminders: pitches with status in `('submitted','under_review')`, age >= 2 days; for each active
    user lacking a responding vote AND lacking a `vote_reminder` row for that pitch newer than 47h.
  - curation reminders: projects `status='active'`, `curation_deadline` set, today <= deadline; for each
    active user with no suggestion authored and no suggestion vote on that project, deduped 47h.
- Event triggers: `create_pitch` → `offer_logged` fan-out; `approve_pitch` → `offer_activated` fan-out.
- `projects` serializer/update: include `curation_deadline`.
- `pywebpush` added to the users-service requirements (GitHub Actions builds the Lambda zip — never build locally).
- Dev env (`backend/.env`): VAPID keys + `NOTIFICATIONS_SWEEP_SECRET` (dev values). Prod: SSM at deploy time.

## Frontend (this repo)

- **SW**: stay on `generateSW`; add `workbox.importScripts: ["push-sw.js"]` in `vite.config.ts` and create
  `public/push-sw.js` with `push` (showNotification with icon/badge, payload `{title,body,url}`) and
  `notificationclick` (focus+postMessage `{type:'greenroom:notification-click', url}` to an existing
  client, else `openWindow(url)`).
- `src/lib/api/notifications.ts`: typed client via `greenroomFetch` for the endpoints above.
- `src/stores/useNotificationsStore.ts`: list, unreadCount, fetch/markRead, enabled flag
  (`notificationsEnabled`, persisted + synced — wire into `StylingSnapshot` as `notifications.enabled`,
  `collectStylingSettings`/`applyStylingSettings`, and subscribe in `useSettingsSync.ts`).
- `NotificationsSync` component mounted in `AppManager` (clone of `InboxBadgeSync` cadence): poll 5 min +
  focus refetch; toast (sonner, cap ~3) for newly-arrived unread while app open; also listens for SW
  `greenroom:notification-click` messages and routes through the same `/open/...` resolution used at
  `AppManager` boot (`resolveOpenLink` in `src/utils/deepLinks.ts`).
- `src/hooks/usePushSubscription.ts` (port Budgeting patterns): permission state, subscribe
  (`urlBase64ToUint8Array(VITE_VAPID_PUBLIC_KEY)`), unsubscribe, resubscribe self-heal, backfill re-upsert
  on mount when already subscribed + authenticated.
- **Menu-bar bell** `src/components/layout/menu-bar/MenuBarNotifications.tsx`: unread badge; popover panel
  listing notifications (unread emphasized, relative time), click → mark read + deep-link resolve in-app;
  "mark all read". Mounted in BOTH `MacTopMenuBar.tsx` status controls and `WindowsTaskbar.tsx` tray.
- **Control Panels pane** `notifications`: new `ControlPanelPaneId` + category + section slot +
  `NotificationsPaneContent.tsx` + case in `ControlPanelsMacPaneRenderer.tsx` (check Windows-theme legacy
  layout reachability; extend legacy tabs if that's the established route). Contents: master toggle
  (synced setting), this-device push toggle (permission flow, denied-state message), and — admin-only via
  `useIsGreenroomAdmin()` — a "Send test notification" button hitting the test endpoint.
- **Project field**: `curation_deadline` (date input, optional, labelled "Curation deadline") in
  `ProjectDetailsFormDialog.tsx` + Active Projects details tab + `src/lib/api/projects.ts` types +
  `toUpdatePayload` skip-if-blank convention.
- Env: `VITE_VAPID_PUBLIC_KEY` (dev value in `.env.local`; prod baked at build — add to `deploy.ps1` notes).

## Deploy checklist (prod — DO NOT run without owner approval)

1. Fresh RDS snapshot; run `notifications.sql` on `DT-Test`.
2. Generate PROD VAPID pair (`bun x web-push generate-vapid-keys`); SSM params
   `/prod/app/vapid_public_key`, `/prod/app/vapid_private_key`, `/prod/app/vapid_claims_email`,
   `/prod/app/notifications_sweep_secret`; wire into users Lambda env (and any Lambda that sends —
   pitches service triggers fan-out on create/approve, so it needs them too).
3. Backend: push to main → Actions builds zips → `aws lambda update-function-code` for `prod-users-service`
   and `prod-pitches-service` (+ `prod-projects-service` for `curation_deadline`).
4. EventBridge Scheduler rule (~every 6h) → invoke `prod-users-service` with `{"task":"notifications_sweep"}`
   (handler branch) or API-destination POST to the sweep endpoint with the secret header.
5. Frontend: `VITE_VAPID_PUBLIC_KEY=<prod pub> AWS_PROFILE=greenroom-cli .\deploy.ps1`.
6. Admin test: Control Panels → Notifications → Send test notification.
