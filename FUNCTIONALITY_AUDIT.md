# Greenroom Functionality Audit

A living, function-by-function audit of what the app can do today, and where the
backend/database would need to change to support what it can't.

**How to read this doc**

- **Status legend**
  - ✅ **Works** — implemented today, exactly as described.
  - 🟡 **Partial / workaround** — works, but via a compromise (e.g. data faked into a text field) or missing part of the ask.
  - ❌ **Not possible** — no frontend and/or no backend support today.
- **Backend column** — for anything not fully clean, notes what *could* change vs. what *should* change on the external Greenroom API / DB.
  - **Verified?** — whether the backend shape was confirmed against the **live API** (the checked-in [API_DOCUMENTATION.md](API_DOCUMENTATION.md) is known-stale) or just read from the client code.

> Two backends exist. Unless noted, everything here is the **external Greenroom
> domain API** (`GREENROOM_API_BASE`, clients in [src/lib/api/](src/lib/api/)), not
> this repo's `/api/*` ryOS functions.

---

## Pitch app

### New pitch — name, description, key dates, venue/location, budget, timelines; submit + clear

**Status: 🟡 Works (with a data-modeling caveat)**

Every field and both actions exist in [PitchAppComponent.tsx](src/apps/pitch/components/PitchAppComponent.tsx):
name, description, key dates, venue/location, budget, timelines; **Submit Pitch**
(`handleSubmit` → `createPitch`) and **Clear** (`clearForm`, also auto-runs after a
successful submit). Submitting requires a linked Greenroom user ID.

**Caveat:** the `pitches` table stores only `title`, `description`, `status` (+ system
fields: `submitter_user_id`, dates, votes). **Budget, venue, key dates, timelines are
not real columns** — the backend silently drops them. The app packs them into the
description as a markdown block (`serializePitchDescription` / `parsePitchDescription`
in [pitches.ts](src/lib/api/pitches.ts#L95)) and parses them back out for display.

Consequence: values round-trip and display fine, but they are **not queryable /
filterable / sortable** server-side — they're embedded free text.

**Backend — could vs. should**
- **Could:** add real `budget`, `venue`, `key_dates`, `timelines` columns (or a JSON
  metadata column) to the pitches table + accept them in create/update. Frontend
  serialize/parse shim would then be removed.
- **Should?** Only worth it if we need to **query/sort/report** on these (e.g. "pitches
  over £10k", "pitches this quarter"). If they're purely display, the current text-pack
  approach is fine.
- **Verified?** ✅ Backend field set confirmed against live API on 2026-07-06 (per
  [pitches.ts](src/lib/api/pitches.ts#L3) header + BACKEND_STATE.md).

---

### View your pitches

**Status: ✅ Works** (with one likely gap around comments)

"My Pitches" tab ([PitchAppComponent.tsx:346](src/apps/pitch/components/PitchAppComponent.tsx#L346))
lists your pitches with a live count, showing title, status badge, description,
packed metadata (venue/date/budget/timelines), vote summary, comments, and a delete
button. Loading + empty states handled.

**How "yours" is scoped:** no server-side "my pitches" endpoint. App fetches **all**
pitches (`GET /pitches/`) then filters client-side to `submitter_user_id ===
greenroomUserId` (`getCurrentUserPitches`, [usePitchesStore.ts:202](src/stores/usePitchesStore.ts#L202)).
Requires a linked Greenroom user ID; otherwise the list is empty.

**Confirmed gap — FIXED 2026-07-14 (frontend only).** Added `refreshPitch` + `pitches`
to the Pitch app's store destructuring and an effect that fetches detail for the
current user's pitches lacking it
([PitchAppComponent.tsx](src/apps/pitch/components/PitchAppComponent.tsx), effect after
the initial fetch). Comments + per-vote detail now populate. Data path verified through
the running :5173 dev proxy — `GET /pitches/2/` returns 6 comments for user 9's
"Workshop Series 1". Visual check: user 9 → My Pitches → "Workshop Series 1" shows
"Comments (6)".

> **Regression note:** the first version of this fix referenced `pitches` in the
> effect's dep array without destructuring it from the store → `ReferenceError` →
> black screen on open. Fixed by adding `pitches` to the destructuring. Lesson: the
> real typecheck target is **`tsconfig.app.json`**, not the root `tsconfig.json`
> (a `tsc -b` solution file that checks nothing on its own).

Original diagnosis below.

**Confirmed gap (comments never show):** the "My Pitches" cards read
`pitchDetails[pitch.id]` ([line 508](src/apps/pitch/components/PitchAppComponent.tsx#L508))
but the component **never calls `refreshPitch`** — it's not even destructured from the
store ([line 84-94](src/apps/pitch/components/PitchAppComponent.tsx#L84-L94)), and the
only fetch effect calls `fetchPitches()` (summary list), which never populates
`pitchDetails`. So `detail` is always `undefined` → `comments = []` → the comments
block ([line 621](src/apps/pitch/components/PitchAppComponent.tsx#L621)) never renders.
The vote *summary* still shows (it comes from the list payload's
`yes_votes`/`total_votes`), but the comment list and per-vote detail do not.

The **Incoming Offers app does this correctly** — it runs an effect that fetches detail
for any pitch missing it ([IncomingOffersAppComponent.tsx:164-177](src/apps/incoming-offers/components/IncomingOffersAppComponent.tsx#L164-L177)).
Fix for the Pitch app: destructure `refreshPitch` and mirror that effect over
`userPitches`. Purely a **frontend** fix — no backend change needed.

**Backend — could vs. should**
- **Could:** add a `GET /pitches/?submitter_user_id=` (or `/users/{id}/pitches/`)
  endpoint so the client stops fetching-all-and-filtering. Also a list endpoint that
  includes vote/comment counts would remove the per-pitch detail fetch.
- **Should?** Only matters at scale (many total pitches) or if the comment gap is real
  and we don't want N detail fetches.
- **Verified?** ❌ Not re-checked against live API this session.

## Inbox app (Incoming Offers)

### Offer card shows: project name, description, date, fee, venue, time, submitted

**Status: ✅ Works for pitch offers · 🟡 partial for booking offers**

The Inbox merges two offer sources into one card type
([offers useMemo](src/apps/incoming-offers/components/IncomingOffersAppComponent.tsx#L179),
[OfferCard](src/apps/incoming-offers/components/IncomingOffersAppComponent.tsx#L696)):

- **Pitch offers** (pitches with status `submitted`/`under_review`): **all 7 fields
  visible** — name, description, date, fee, venue, time, submitted. But date/fee/venue/
  time are parsed from the packed pitch-description metadata (see Pitch app entry), so
  missing values render as **`"TBD"`**. "Submitted" = real `date_submitted`.
- **Booking offers** (bookings with status `pending`): **"Time" is swapped for "Artist"**
  and **"Submitted" is not rendered** (bookingOffers never set `submittedAt`). So 5 of
  the 7 requested fields show; time + submitted do not.

**Backend — could vs. should**
- **Verified against live API 2026-07-14** (via :5173 proxy, `GET /bookings/` and
  `GET /bookings/{id}/`). A booking object has: `booking_id, artist_id, artist_name,
  project_id, project_name, event_date, city, country, location_id, status,
  agreed_fee, notes`. Detail adds nested `artist`/`project` (incl. `venue_name`,
  `gig_size_id`). **No timestamp field of any kind, and no timings/start-time field.**
- **Could:** surfacing "Submitted" for bookings needs a new `created_at` column on the
  bookings table (+ include it in the API). "Time" needs a new timings field. Both are
  **backend/DB changes**, not frontend.
- **Should?** Only if the Inbox must carry booking offers *and* users need time/submitted
  on them. If Inbox is primarily internal pitches, leave as-is. "Submitted" (created_at)
  is the more defensible add — a booking-created timestamp is generally useful; a
  start-time field is more speculative.

### Pitch voting — desired model: "we should do this" / "I'd like to be involved" / "decline"

**Status: ❌ Not possible today (involvement tracking doesn't exist)**

**Current model (verified live + BACKEND_STATE.md):** `POST /pitches/{id}/vote/` with
`{user_id, vote_value, comment?}`. One vote per user, **upserted** (re-voting replaces;
no history, no delete). `vote_value` is an **unvalidated integer** (API accepted `5`);
intended domain `1`=yes / `-1`=no / `0`=abstain. List rollup `yes_votes` counts **only
`=== 1`**; detail returns the full votes array. UI today = Yes / No (+comment) / clear,
plus a separate **Reject Pitch** action that changes the *pitch status* (not a vote).
Type is `PitchVoteChoice = "yes" | "no" | "abstain"` — **no "involved" concept**.

**Desired mapping (per user, 2026-07-14):**
- "We should do this" → yes (`vote_value = 1`) — exists.
- "Decline" → **No vote** (`vote_value = -1`, reversible tally) — exists. *Not* the
  Reject-Pitch status change.
- "I'd like to be involved" → **track the interested user; must NOT count as a double
  yes** — does not exist.

**Backend — could vs. should (for the "involved" signal)**
- **Option A — no backend change:** encode `vote_value = 2` = "yes + interested". Yes
  tally counts `1` and `2` as one yes each (no double count); involved list = users with
  `2`. Works today because value isn't validated. Downsides: involvement can't exist
  without a yes; must count client-side everywhere (server `yes_votes` ignores `2`).
- **Option B — real separate record (backend + DB):** add `wants_involvement` boolean on
  the votes table, or a `pitch_involvement (pitch_id, user_id)` table + endpoint. Clean,
  queryable, independent of the tally. **Truer fit for "just track the user."**
- **Should?** User wants involvement as independent data → **Option B** is the honest
  design; Option A is the no-backend shortcut for a UI-only prototype.
- **Verified?** ✅ Vote model + unvalidated `vote_value` verified live (this session +
  BACKEND_STATE.md). Involvement columns/tables: not present (would be new).

### "Decline" restricted to admins (roles / permissions)

**Status: ❌ Not possible today — no role or auth model exists in the domain**

**Key architectural facts (verified live 2026-07-14 + BACKEND_STATE.md):**
- **No `/users/` endpoint** (404) — can't list users or fetch a user record.
- **No authentication anywhere on the Greenroom API.** Every write is anonymous and
  attributed server-side to a default user (user 9 "manager1"); no auth headers are used
  (BACKEND_STATE.md:287-288, 347).
- **No role / permission / is_admin field** anywhere in the domain data.
- The app's only "admin" is the **ryOS platform admin** (`username === "ryo"`, ryOS auth
  token; `adminOnly` apps in the registry) — a property of the desktop shell, **not**
  connected to Greenroom domain users. A Greenroom user is just a numeric
  `greenroomUserId` typed in at account setup (`useGreenroomAccountStore` has only
  `greenroomUserId` + `displayName`).

**Backend — could vs. should**
- **Frontend-only gating (cosmetic):** hide/disable the decline button unless the user is
  "admin" (ryOS `ryo`, or a configured allowlist of Greenroom user IDs). Easy, but
  **not enforced** — the auth-less endpoint can still be called directly. OK for a
  prototype only.
- **Real enforced admin-only (large backend project):** requires (1) authentication on
  the Greenroom API (server currently cannot identify the caller) and (2) a role/
  permission model on users. Neither exists today; the whole API is anonymous.
- **Decision needed from product:** what defines a Greenroom "admin"? ryOS `ryo` /
  configured user-ID allowlist / a proper backend user-role system. This gates which
  option is even achievable.
- **Verified?** ✅ Absence of users endpoint, auth, and roles all confirmed live +
  BACKEND_STATE.md.

**Update 2026-07-14 — frontend admin allowlist added.** Chose the configured-user-ID
allowlist approach. New [greenroomAdmins.ts](src/config/greenroomAdmins.ts) with dummy
admins seeded to real backend users **8 "admin", 9 "manager1", 10 "manager2"**
(non-admin: 11-14). New `useIsGreenroomAdmin()` hook in
[useGreenroomAccount.ts](src/hooks/useGreenroomAccount.ts). This is the mechanism to
gate admin-only UI (e.g. decline); still **cosmetic only** — not enforced by the
auth-less backend. Typechecks clean.

**Update 2026-07-14 (cont.) — decline wired to admin gate in the Inbox.** In
[IncomingOffersAppComponent.tsx](src/apps/incoming-offers/components/IncomingOffersAppComponent.tsx):
`isAdmin = useIsGreenroomAdmin()`. **Final split (2026-07-14):**
- **Everyone:** pitch **Yes** and **No** votes (both reversible tally votes;
  `vote_value` 1 / -1). Backend allows any user to vote either way — no auth, one vote
  per user upserted (verified).
- **Admin only:** **Reject Pitch** (terminal status→rejected), booking **Decline
  Offer**, **Approve & Move to Active Projects**.

Pitch card shows Yes+No (grid-cols-2) for non-admins, +Reject (grid-cols-3) for admins.
Bookings show actions only to admins; footer hidden entirely otherwise. Terminal
handlers (`handleRejectClick`, `handleDeclineBookingConfirm`, `handleApproveClick`,
`handleApproveConfirm`) guard defensively with a toast. (Earlier the No vote was briefly
admin-gated too; reverted per user — No is an opinion, Reject is the decision.)
Reminder: UI gating only — the anonymous backend accepts any of these from a direct
caller. Typechecks clean; not yet exercised end-to-end.

Known backend users (live): 8 admin, 9 manager1, 10 manager2, 11 coordinator1,
12 coordinator2, 13 staff1, 14 staff2.

### Dev "View as: Admin / Non-admin" switch

**Status: ✅ Added 2026-07-14 (dev-only demo tool)**

A `Switch` in the Inbox toolbar (rendered only when `import.meta.env.DEV`) flips the
**effective Greenroom identity** between an admin (8 "admin") and a non-admin
(13 "staff1"), so the role-gated UI can be previewed live. It drives the *real*
`isAdmin`, not a display-only flag.

Implementation: new `viewAsUserId` override in
[useDevOverridesStore.ts](src/stores/useDevOverridesStore.ts) (persisted); honored as
top priority (dev-only) in
[useGreenroomAccount.ts](src/hooks/useGreenroomAccount.ts); demo IDs + known-users map
in [greenroomAdmins.ts](src/config/greenroomAdmins.ts); switch UI in
[IncomingOffersAppComponent.tsx](src/apps/incoming-offers/components/IncomingOffersAppComponent.tsx)
toolbar. Because it's a top-priority global override, it also changes identity in other
domain apps (e.g. Pitch) while set — the label shows the active user ID. Typechecks
clean.

### Why can't users vote on (some) inbox offers?

**Status: ⚠️ Working as designed — voting is pitch-only; bookings have no vote model**

The inbox merges two sources. Live counts 2026-07-14: **9 pitch offers, 36 booking
offers.** Voting (`VoteButton` Yes/No) renders **only for pitch offers** (`isPitch`).
**Booking offers have no voting at all** — by design ([data.ts:1-10](src/apps/incoming-offers/data.ts#L1-L10)):
bookings' only actions are confirm (approve) / decline, and the Greenroom booking object
has no vote fields (verified earlier). So the majority of inbox cards (bookings) show no
vote buttons, and after the admin gating a **non-admin sees a booking card with zero
buttons** (footer hidden).

Pitch voting itself works for all users (Yes + No render for non-admins; Reject is
admin-only).

**Backend — could vs. should**
- **Could:** to make bookings votable, add a booking-vote model to the Greenroom API
  (new table + endpoints), or generalize the pitch-vote model — neither exists today.
- **Should?** Only if bookings are meant to be team-voted. Currently bookings are an
  admin approve/decline decision, so voting may not belong there.
- **UI polish option (no backend):** show a read-only "Awaiting admin decision" note on
  booking cards for non-admins instead of a blank/absent footer.
- **Verified?** ✅ Booking objects have no vote fields (live); inbox composition counted
  live.

### Should users be able to vote on booking (external) offers?

**Status: ❌ Not possible today — no booking-vote model on the backend**

**User intent:** booking offers are external offers that come in *for us*, so the team
should vote yes/no on them (like pitches).

**Backend reality (verified live 2026-07-14):**
- A **booking is an artist↔project link** (both IDs required), not a standalone "offer"
  entity. Event fields are denormalized from the project.
- The "external offer" info **does exist — on the linked *project***: `source` ∈
  {Direct, Cold Outreach, Promoter, Referral, Agent}, plus `promoter_name`,
  `event_type`, `venue_name`. The app's "Log Offer" flow models an incoming offer as an
  on-hold project + pending booking.
- **Voting is pitch-only.** `POST /pitches/{id}/vote/`, votes keyed to `pitch_id`.
  **No vote table/endpoint for bookings; booking objects have no vote fields.** Nothing
  to record a yes/no against.
- Live booking status spread: confirmed 35, cancelled 38, pending 36, completed 40,
  declined 31.

**Backend — could vs. should**
- **Could:** add a **booking-vote model** to the external Greenroom API (votes keyed by
  `booking_id` + `/bookings/{id}/vote/` endpoints), mirroring pitches. Then the Inbox's
  existing `VoteButton` UI drops onto booking cards with modest frontend work. NOTE: the
  Greenroom API is an external AWS service — this repo can't implement that change.
- **Should?** Matches the stated product intent (team-vote on incoming offers). The
  cleanest long-term model may be to unify pitches + booking-offers under one
  votable "opportunity" concept, but that's a larger backend redesign.

**Decision 2026-07-14:** confirmed we DO want booking voting (Path A — add it to the
Greenroom API, not a ryOS-side overlay). Booking-vote surface confirmed absent live:
`GET /bookings/{id}/vote/` → 404 vs `GET /pitches/{id}/vote/` → 405. The external
Greenroom API is not in this repo, so this can't be implemented here — wrote an
implementation-ready backend spec for its owners:
[docs/greenroom-booking-votes-spec.md](docs/greenroom-booking-votes-spec.md) (new
`booking_votes` table, `POST /bookings/{id}/vote/`, `votes` in detail, `total_votes`/
`yes_votes` in list — all mirroring pitches). Frontend work once shipped is mechanical
(§5 of the spec). **Blocked on backend team.**

**Related frontend bug (fixable here):** the Inbox shows a booking's **"promoter" as its
city/country** ([IncomingOffersAppComponent.tsx:206](src/apps/incoming-offers/components/IncomingOffersAppComponent.tsx#L206)),
ignoring the linked project's real `promoter_name`/`source`. Booking cards should pull
promoter/source from the project instead of mislabeling location.

## Active Projects app

### Overview tab — requested fields

**Status: 🟡 5 of 11 shown; 3 are quick frontend adds; 3 need backend fields**

Overview tab = an editable project form
([ProjectDetailView](src/apps/active-projects/components/ActiveProjectsAppComponent.tsx#L352)).
Verified against live API 2026-07-14.

**Shown today (5):**
- **event date** ✅ (Event Date)
- **venue** ✅ (`venue_name`)
- **fee** 🟡 shown as **Budget** — projects have no separate fee field; `budget` is the
  money field (bookings have `agreed_fee`, projects use `budget`).
- **project size** ✅ (Gig Size = `gig_size_id`/`gig_size_code`)
- **promoter** ✅ (`promoter_name`)

**Data exists on backend but NOT surfaced in Overview — frontend-only adds (3):**
- **google drive link** — `drive_parent_folder_id` exists (set on 23/84 projects live,
  e.g. `folder_615922`). Not displayed/edited anywhere. Can add a field + constructed
  `drive.google.com/drive/folders/{id}` link. Caveat: live values are placeholders, not
  real folder IDs, so links won't resolve against test data.
- **status updates** — current status is shown + editable, but the **status history**
  (`GET /projects/{id}/status-history/` → old/new status, changed_by_username, notes,
  changed_at; verified populated) is not surfaced. Can render as a timeline.
- **team** — `members` is populated on project detail but rendered in the **Lineup tab**,
  not Overview. Members are **artists**, not internal staff. Could mirror onto Overview.

**No backend field — need backend change (3):**
- **timings** ❌ — no time-of-day column on projects.
- **deadline** ❌ — only `start_date`/`end_date`; no dedicated deadline field.
- **project lead** ❌ — `lead_artist_id` was REMOVED from the model
  ([projects.ts:4](src/lib/api/projects.ts#L4)); no project-lead field exists. (A member
  with a "lead" role is the only proxy.)

**Verified?** ✅ Project field set, `drive_parent_folder_id` values, status-history
endpoint, and members-on-detail all confirmed live.

**Follow-ups 2026-07-14:**
- **#4 Google Drive link — DONE (frontend).** Added an editable "Google Drive Folder"
  field to the Overview bound to `drive_parent_folder_id`, with an "Open in Google
  Drive" link (`drive.google.com/drive/folders/{id}`). Saved via `updateProject`.
  Typechecks clean. Caveat: live values are placeholders (`folder_615922`), so links
  won't resolve against test data.
- **#3/#8 Team vs Lineup — clarified.** Backend has NO staff-team concept. Both
  `members` (assign-team) and `lineup` are **artist**-keyed (→ artists table);
  redundant, and `lineup` is empty on all projects. Staff (users) only touch projects
  via task `assignee_user_id` / status-history / wrapup author. A real staff "Team"
  (and thus "project lead") needs a new `project_team (project_id, user_id, role)`
  table — see spec.
  - **DECISION (product 2026-07-14):** consolidate to **`lineup` = artists** (drop the
    redundant artist `members` array, migrate members→lineup) and repurpose **"members"
    = team members = staff**, in a **separate table** (the `project_team` above, keyed to
    users). Two clean concepts instead of two redundant artist lists + no staff. Details
    in the spec.
- **#5 Status updates — two different things:**
  - **Status *history* (change log)** IS real/populated and **addable frontend-only** as
    a read-only timeline of status *transitions* (old→new, who, when). **DONE 2026-07-14**
    — added a read-only "Status History" section to the Overview
    ([ActiveProjectsAppComponent.tsx](src/apps/active-projects/components/ActiveProjectsAppComponent.tsx),
    via `getProjectStatusHistory`, re-fetches on project/status change). Typechecks clean.
  - **Status *updates* (free-text log posted by users)** is **NOT possible** today.
    Probed `/projects/{id}/updates|notes|comments|activity|log/` → all 404. And the
    `notes` field on status-history is **not writable** — verified live: PATCH
    `update-status` with `{status, notes}` stored `notes: null` (input ignored). History
    rows are also only created on an actual status change.
  - **PROGRESS UPDATES — CONFIRMED BACKEND TO-DO (product 2026-07-14).** Users need to
    post free-text progress updates on a project at any time (independent of status
    changes). Not possible today. **Recommended:** a dedicated `project_updates` table +
    `GET/POST /projects/{id}/updates/` (the `POST` must store the body's `user_id` so the
    real author shows — the API otherwise attributes writes to default user 9). The
    writable-`notes`-on-update-status option is a lesser fallback (updates would be tied
    to status changes). Blocked on the external Greenroom API — see
    [spec §2](docs/greenroom-active-projects-backend-gaps.md). Frontend is a quick
    follow-up once endpoints exist (fetch + list + a post box, alongside the status
    history already added).
  - NOTE: verifying `notes` required a live status transition on test-project 143
    (active→on_hold→active, restored); status-history can't be deleted, so 143 now has
    today-dated test rows (already a test-polluted project).
- **#6 Timings — no backend field.** Needs a `timings` column — see spec.
- **#7 Deadline — dropped** per product; Overview keeps Start/End Date (nothing to
  remove; no deadline field existed).
- Backend spec for #3/#5/#6/lead:
  [docs/greenroom-active-projects-backend-gaps.md](docs/greenroom-active-projects-backend-gaps.md).

<!-- Append new findings above this line as we walk through each function. -->








