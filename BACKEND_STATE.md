# BACKEND_STATE.md — Live Greenroom API Schema Report

**Verified against the live backend on 2026-07-06** by curling every endpoint (list,
detail, create, update, transition, delete) at
`https://jzre02jvh9.execute-api.eu-west-2.amazonaws.com/api`.
This document supersedes `API_DOCUMENTATION.md`, which is stale. Route lists below were
extracted from the backend's own Django URLconf (the API runs with `DEBUG=True`, so 404
pages enumerate every registered route).

Conventions observed everywhere:

- Trailing slashes are required.
- Money fields (`budget`, `agreed_fee`, `amount`) are **strings** of integers, e.g. `"33272"`.
- Datetime fields are ISO strings without timezone (`"2025-03-26T00:00:00"`); date fields are `"YYYY-MM-DD"`.
- Create endpoints are `POST .../create/`; updates are `PATCH` (or `PUT`) `.../{id}/update/`; deletes are `DELETE .../{id}/delete/`.
- Validation is minimal: create endpoints check required fields only (`{"error":"Missing required fields","missing_fields":[...]}`, HTTP 400). **Status/enum values are NOT validated** — `update-status` happily stored `"bogus"`. The frontend must be the gatekeeper for enum values.
- Unknown body fields are silently dropped (verified: pitch create ignores `budget`, `venue_name`, etc.).
- All `*/health/` endpoints return 200 (including events/tasks/analytics).

---

## Projects — the central entity

Routes (all verified working unless noted):

| Route | Verb | Notes |
|---|---|---|
| `GET /projects/` | GET | **Returns ONLY `status=active` when unfiltered** (see below) |
| `POST /projects/create/` | POST | required: `name`, `status` |
| `GET /projects/{id}/` | GET | detail incl. `lineup`, `members`, `tasks`, `wrapup` |
| `PATCH /projects/{id}/update/` | PATCH/PUT | accepts full field set |
| `DELETE /projects/{id}/delete/` | DELETE | blocked if any related rows exist (see below) |
| `POST /projects/{id}/assign-team/` | POST | assigns members |
| `PATCH /projects/{id}/update-status/` | **PATCH** (POST → 405) | body `{status}`; **no value validation**; writes status-history row |
| `POST /projects/{id}/archive/` | POST | empty body; sets `status="archived"`, writes history |
| `GET /projects/{id}/status-history/` | GET | `{project_id, status_history:[{id, old_status, new_status, changed_by_user_id, changed_by_username, notes, changed_at}]}` |
| `GET /projects/{id}/lineup/` + `lineup/add/` (POST, requires `artist_id`) + `DELETE lineup/{artist_id}/` | | |
| `GET /projects/{id}/suggestions/` + `suggestions/add/` (POST, requires `artist_name`) + `suggestions/{sid}/vote/` + `suggestions/{sid}/add-to-lineup/` | | |
| `GET /projects/{id}/tasks/` | GET | `{project_id, tasks_by_status:{todo|in_progress|review|blocked|completed:[...]}}` |
| `POST /projects/{id}/tasks/create/` | POST | required: `title` |
| `PATCH /tasks/{task_id}/update/`, `DELETE /tasks/{task_id}/delete/` | | task routes live under `/tasks/` |
| `GET /projects/{id}/wrapup/` + `wrapup/create|update|delete/` | | wrapup: `{id, summary, lessons_learned, submitted_by, submitted_by_user_id, date_created}`. **`wrapup/create/` accepts an empty body** — no required fields |
| `GET /artists/{artist_id}/projects/` | GET | projects for an artist |

### Project object (list item and `project` key of detail — identical shape)

```json
{
  "id": 143,
  "name": "EP Production 8",
  "description": "…" | null,
  "status": "active",                      // see status list below — NOT validated by API
  "project_type": "Video" | null,          // free text; seen: Video, Community, Event, Recording, Digital, Educational, Concert
  "start_date": "2025-03-26T00:00:00" | null,
  "end_date": "2025-03-26T00:00:00" | null,
  "feedback": "…" | null,                  // NEW
  "budget": "33272" | null,                // string
  "drive_parent_folder_id": "folder_615922" | null,  // NEW
  "event_date": "2025-03-26" | null,       // merged event fields (NEW)
  "event_type": "Video" | null,
  "venue_name": "Studio / Remote" | null,
  "location_id": 15 | null,                // auto-resolved when city/country sent to update
  "city": "Manchester" | null,
  "country": "UK" | null,
  "promoter_name": "Independent" | null,
  "source": "Direct" | null,               // "pitch" when created via pitch approve
  "gig_size_id": 1 | null,
  "gig_size_code": "XS" | null             // derived from gig_size_id (XS/S/M/…)
}
```

**`lead_artist_id` is GONE.** Artist association is via detail-only arrays:

- `members`: `[{artist_id, artist_name, role_in_project, joined_at}]`
- `lineup`: `[{…}]` (same add/remove pattern; empty on all sampled projects)
- `tasks`: `[{id, title, description, status(todo|in_progress|review|blocked|completed), priority(low|medium|high|urgent), assignee_user_id, due_date}]`
- `wrapup`: object or `null`

### Statuses (observed in DB; API does not validate)

`active` (84), `completed` (9), `cancelled` (7), `on_hold` (8), `archived` (0 pre-existing; created by archive endpoint).

### ⚠️ List filtering behavior (inverted from old docs)

`GET /projects/` **without** `?status=` returns only **active** projects.
`?status=completed|cancelled|on_hold|archived` works correctly and is the ONLY way to
see non-active projects. The old "fetch all and filter client-side" workaround is now
wrong — there is no way to fetch all statuses in one call; fetch per status.

### Create / Update

- Create requires `name` + `status` only. Everything else optional.
- Update accepts all fields above **plus `city`/`country`, which auto-create/resolve
  `location_id`** (verified: sending `"city":"London","country":"UK"` produced `location_id:14`).
- Delete is blocked (400) if the project has any members, tasks, wrapups, files,
  bookings, payments, **pitches (a pitch whose `project_id` points at it)**, lineup, or
  suggestions. Unlink/delete those first.

---

## Pitches

Routes: `GET /pitches/`, `POST /pitches/create/`, `GET /pitches/{id}/`,
`PATCH /pitches/{id}/update/`, `DELETE /pitches/{id}/delete/`,
`POST /pitches/{id}/vote/`, `POST /pitches/{id}/move-to-project/`,
`POST /pitches/{id}/approve/`, `POST /pitches/{id}/close/`,
`POST /pitches/{id}/comments/`.

### List item

```json
{"id":255,"title":"…","description":"…","status":"submitted","project_id":null,
 "submitter_user_id":9,"date_submitted":"2025-12-29T22:56:41.277657","date_closed":null,
 "total_votes":1,"yes_votes":1}
```

### Detail

```json
{"pitch":{…same minus vote counts…},
 "votes":[{"user_id":9,"username":"manager1","vote_value":1,"comment":""}],
 "comments":[{"id":146,"user_id":9,"username":"manager1","comment":"…","parent_comment_id":null,"date_created":"…"}]}
```

- **The pitch table has ONLY these fields.** Create requires `title` + `submitter_user_id`;
  optional `description`, `status`. Extra fields (`budget`, `venue_name`, `key_dates`,
  `event_date`, `city`, `timelines`) are **silently dropped** (verified). Packing
  metadata into `description` markdown is genuinely the only storage channel for
  budget/venue/dates on a pitch.
- Statuses observed: `draft`, `submitted`, `under_review`, `approved`, `rejected`,
  `implemented`, `closed`. `update/` can set any status (used for reject).

### Votes — the real model

`POST /pitches/{id}/vote/` body `{user_id, vote_value, comment?}`:

- **One vote per user, upserted** — voting again replaces your previous vote (verified).
- `user_id` must exist (400 `"User not found"` otherwise).
- **`vote_value` is NOT validated** (the API accepted `5`). Intended domain is 1/-1/0.
- `comment` is a free-text string stored on the vote.
- List rolls up `total_votes` and `yes_votes` (count of `vote_value === 1`) only.

There is **no support for vote categories**. The UI's 4-category voting must collapse to:
one vote per user of yes(1)/no(-1)/abstain-or-interested(0) + optional comment.

### Transitions (all verified live)

- `POST /{id}/approve/` (empty body) → HTTP 201
  `{"message":"Pitch approved and project created","pitch_id","project_id","project_name","project_status":"active"}`.
  Creates a project with `name`=title, `description`=pitch description, `source:"pitch"`,
  every other field null; sets pitch `status="approved"`, `project_id`, `date_closed`.
- `POST /{id}/move-to-project/` (empty body) → same behavior (also sets status
  `approved`, creates project). Effectively an alias; no body params discovered.
- `POST /{id}/close/` (empty body) → sets `status="closed"`, `date_closed`.
- Reject: no dedicated route — use `PATCH update/ {"status":"rejected"}`.

**Implication for the approve flow:** the backend only carries title/description into
the new project. All other project fields (budget, event_date, venue, city/country,
promoter, gig_size, project_type, dates) must be written by a follow-up
`PATCH /projects/{new_id}/update/` — this is where the UI must prompt the user for
anything not already parseable from the pitch description.

### Deletion constraints

- Pitch delete is blocked if it has **any votes or comments** (400). There is **no
  endpoint to delete a vote or comment**, so a voted/commented pitch is permanently
  undeletable — treat pitch deletion as effectively unavailable in the UI; use
  close/reject instead.
- A pitch with `project_id` set blocks deletion of that project. `PATCH update/
  {"project_id": null}` unlinks it.

---

## Bookings — LIVE (was stubbed in the old client)

Routes: `GET /bookings/`, `POST /bookings/create/`, `GET /bookings/{id}/`,
`PATCH /bookings/{id}/update/`, `DELETE /bookings/{id}/delete/`. All verified working.

**Project-centric now** — `event_id`/`event_name` are gone.

List item:

```json
{"booking_id":292,"artist_id":26,"artist_name":"Midnight Blue",
 "project_id":674,"project_name":"Afrobeat Party 2026",
 "event_date":"2026-06-17","city":"New York","country":"Canada","location_id":45,
 "status":"confirmed","agreed_fee":"4410","notes":"…"}
```

Detail nests the relations (note `id` keys differ from list):

```json
{"booking_id":583,"artist":{"id":25,"name":"Aurora Black"},
 "project":{"id":942,"name":"…","event_date":"…","city":"…","country":"…",
            "location_id":14,"venue_name":"…","gig_size_id":2},
 "status":"pending","agreed_fee":"100","notes":"…"}
```

- Create requires `artist_id` + `project_id`; optional `status`, `agreed_fee`, `notes`.
  The event fields on a booking are **denormalized from the project** — set them on the
  project, not the booking.
- Statuses observed: `pending`, `confirmed`, `declined`, `cancelled`, `completed` (not validated).

---

## Artists

Routes: list, `find/` (query by name — exact-match; partial "Aurora" → not found), create
(requires `artist_name`), get, update, delete.

List item: `{id, artist_name, preferred_name, is_active, is_collective_member}`.

Detail:

```json
{"artist":{"id":25,"roster_unique_id":1000,"artist_name":"…","preferred_name":"…",
 "pronouns":"…","type_of_act":"Collective","heritage":"…","bio":"…",
 "primary_email":"…","primary_phone":"…","instagram":"…","soundcloud":"…","tiktok":"…",
 "website":"…","is_collective_member":false,"is_active":true,"date_of_birth":"2005-01-10"},
 "genres":["Indie","Drill"],
 "locations":[{"city":"Toronto","country":"Canada"}]}
```

---

## Payments

Routes: list, create (requires `artist_id`, `amount`, `status`), get, update, delete.

List item:

```json
{"id":35,"artist_id":28,"artist_name":"Golden Hour","booking_id":null,"project_id":145,
 "amount":"9902","currency":"EUR","status":"pending","invoice_number":"INV-75188",
 "issue_date":"2025-05-08","due_date":"2026-01-04","paid_date":"2025-12-19","notes":"…"}
```

Detail nests `artist:{id,name}` instead of the flat id/name pair. A payment links to
EITHER a `project_id` or a `booking_id` (the other is null).
Statuses observed: `pending`, `issued`, `paid`, `overdue`, `cancelled`.

---

## Events — REMOVED BY DESIGN (consolidated into projects)

Confirmed with the product owner (2026-07-06): events were deliberately
consolidated into projects. A project now carries all event data (`event_date`,
`event_type`, `venue_name`, `location_id`, `city`, `country`, `promoter_name`,
`gig_size_*`), and bookings link artists to projects directly.

**The frontend must not use `/events/` — it has no client for it anymore**
(`src/lib/api/events.ts` was deleted). For reference, the leftover server-side
routes behave as follows:

- `GET /events/` and `GET /events/{id}/` → HTTP 500 (Django `ProgrammingError`;
  the events table no longer matches the leftover code).
- `POST /events/create/` still validates (`name`, `event_date`, `gig_size_id`)
  but was never exercised since reads are dead.
- `GET /events/health/` → 200 (doesn't touch the dropped table).

## Tasks / Analytics / Health

- No `GET /tasks/` collection — tasks are per-project (see Projects). Task update/delete
  at `/tasks/{id}/update|delete/`.
- Analytics: `/analytics/gig-scores/`, `/analytics/artists-by-country/`,
  `/analytics/artists-multiple-cities/` (+ health). Not used by the four apps yet.
- There is no global `/health/` — per-service `/{service}/health/` and `/health/detailed/`.

---

## Entity relationships (verified)

```
pitch.project_id      → project.id   (set by approve/move-to-project; blocks project delete)
booking.artist_id     → artist.id
booking.project_id    → project.id   (event data denormalized from project)
payment.artist_id     → artist.id
payment.project_id    → project.id   (XOR booking_id)
payment.booking_id    → booking.id
project.location_id   → location     (auto-resolved from city+country on update)
project members/lineup→ artist.id
task.project_id       → project.id ; task.assignee_user_id → user
status_history        → project.id ; changed_by = authenticated user (defaults to user 9 "manager1" — no auth headers used!)
vote.user_id, comment.user_id → user.id (users 8–14 exist; 9 = "manager1")
```

**No authentication anywhere** — writes are attributed to a default user (status history
recorded `changed_by_user_id: 9` without any auth header).

## Canonical lifecycle (what the frontend should implement)

```
PITCH:    draft → submitted → under_review → approved ─┐   (rejected / closed = dead ends)
                                                       │ POST approve/  (creates project, source="pitch")
PROJECT:                                    active ────┤   ← also created directly (create/) for non-pitch offers
                                                       │ PATCH update/  (fill budget/event/venue/… — prompt user)
          on_hold ⇄ active → completed ────────────────┤
                                                       │ POST archive/  → archived  (history row written)
          cancelled (via update-status) ───────────────┘
```

- "Incoming offer (non-pitch)" = a project created via `create/` (e.g. `source:
  "Promoter"/"Direct"`) plus optional bookings rows for the artists on offer.
- "Archive" = `status="archived"` via the archive endpoint. `completed` and `cancelled`
  are distinct statuses; archived is a further, explicit filing step. All three are
  reachable in the Archive app via `?status=` queries.

## End-to-end flow verification (2026-07-06)

Both lifecycles were exercised against the live backend using exactly the call
sequences the apps make, then cleaned up.

**Flow A — pitch → incoming → active → archive** (pitch 338 → project 945):

1. `POST /pitches/create/` with metadata packed in the description (Pitch app) → 201.
2. Pitch listed as `submitted` with vote rollup fields (Inbox).
3. `POST /pitches/338/approve/` → project 945 created (`source:"pitch"`), pitch
   linked (`project_id:945`), status `approved`, `date_closed` set.
4. Details dialog `PATCH /projects/945/update/` with budget/event_date/venue/
   city/country/promoter/type/gig_size/dates → all persisted; `location_id:14`
   auto-resolved from London/UK; `gig_size_code:"M"` derived.
5. Project present in `?status=active` with every field populated.
6. `PATCH update-status/ {"status":"completed"}` → present in `?status=completed`.
7. `POST archive/` → present in `?status=archived`; status history recorded
   `active→completed→archived` (rows 13–14, user 9).
8. Cleanup: pitch unlinked (`project_id:null`), project 945 deleted, pitch 338
   deleted (no votes/comments, so deletion allowed). Zero residue.

**Flow B — incoming (non-pitch) → active → archive** (project 946, booking 584):

1. Log Offer: `POST /projects/create/` (`status:"on_hold"`, source Promoter,
   event fields) + `POST /bookings/create/` (`status:"pending"`, fee, notes).
2. Booking listed as pending with project-denormalized event data; the
   on_hold project correctly absent from `?status=active` (0 matches).
3. Approve: `PATCH /bookings/584/update/ {"status":"confirmed"}` +
   `PATCH update-status/ {"status":"active"}` → project appears in active list.
4. Details dialog PATCH filled budget/type/gig_size/dates.
5. Completed then archived; present in `?status=archived`; final state had all
   fields populated (`gig_size_code:"S"`, `location_id:15` auto-resolved).
6. Cleanup: booking 584 deleted, then project 946 deleted. Zero residue.

**What the backend blocks / known limits:**

- Events were consolidated into projects by design — the UI has no events client.
- Votes/comments make a pitch permanently undeletable (no removal endpoints);
  the Pitch app falls back to close (withdraw) when deletion is blocked.
- No auth: all writes are attributed to user 9 ("manager1") server-side.
- No status/enum validation server-side — the frontend restricts values.

## Test residue / cleanup log (2026-07-06)

All probe records were deleted (projects 942/943, booking 583, wrapup 133, pitches
336/337) **except**:

- **Pitch 335 "ZZZ CLAUDE TEST PITCH"** — undeletable because it has one comment and the
  API has no comment-delete route. Left in `status="closed"`, `project_id=null`.
- Project 143 gained two spurious status-history rows (`active→bogus→active`) from
  probing that update-status doesn't validate values; final state is `active`, unchanged.
- Pitch 255 "API Testing" is pre-existing test junk from an earlier session (also has a
  vote, so also undeletable).
