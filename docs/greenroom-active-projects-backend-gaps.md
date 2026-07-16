# Backend Spec: Active Projects gaps

**Audience:** owners of the external Greenroom API.
**Date:** 2026-07-14. **Status:** proposal — not implemented.

Requested Overview-tab features that have **no backend field/endpoint** today. Verified
live 2026-07-14.

## 1. Internal staff "Team" on a project (distinct from artist Lineup)

**Problem:** the only people attachable to a project are **artists**. Both `members`
(`assign-team`) and `lineup` (`lineup/add`) are keyed by `artist_id` → the artists table.
There is **no way to attach internal staff (the users table: managers, coordinators,
staff) to a project as a working team.** Staff only appear incidentally via task
`assignee_user_id`, status-history `changed_by_user_id`, and wrapup
`submitted_by_user_id`.

**Requested:** a first-class **project team of staff users**, separate from the artist
lineup ("team members working on the project" vs "the lineup performing").

**Proposed:**
```
project_team
------------------------------------------------
id            PK
project_id    FK -> projects.id
user_id       FK -> users.id
role          text        (e.g. Project Lead, Coordinator, Producer)
added_at      timestamp
UNIQUE (project_id, user_id)
```
Endpoints (mirror assign-team / lineup patterns):
- `GET  /projects/{id}/team/`
- `POST /projects/{id}/team/add/`      body `{ user_id, role }`
- `DELETE /projects/{id}/team/{user_id}/`
- include a `team` array in `GET /projects/{id}/` detail.

This also gives **"project lead"** (a `project_team` row with role = Project Lead) — the
old `lead_artist_id` field was removed and there is no replacement.

**Cleanup note:** `members` and `lineup` are currently redundant (both artist lists;
`lineup` is empty on every project). Recommend consolidating to ONE artist list and
reserving the new `project_team` for staff.

### DECISION (product, 2026-07-14): split artists vs staff cleanly

Target end state:

- **`lineup` = artists.** Make `lineup` the single artist-linking list. **Drop the
  current `members` array** (the `assign-team` artist list) and migrate its existing
  artist rows into `lineup`. The `lineup/add/` + `DELETE lineup/{artist_id}/` endpoints
  become the canonical way to manage the performing lineup. (Live data note: `members`
  is the populated one today with musical roles like Engineer/Performer/Lead Artist;
  `lineup` is empty — so the migration direction is members → lineup.)
- **"Members" = team members (staff), in a DIFFERENT table.** Reuse the word "members"
  for **internal staff** working on the project, backed by the new `project_team`
  table above (users, not artists) — NOT the old artist `members` array. Naming: the
  staff table can be `project_team` or `project_members`; the point is it links the
  **users** table with a staff `role`, and is entirely separate from the artist
  `lineup`.

**Net:** two clearly separated concepts —
`lineup` (artists performing) and `members`/team (staff working on it) — instead of two
redundant artist lists + no staff concept.

**Frontend impact when the backend lands this:** the Active Projects "Lineup" tab
(currently reads the artist `members` array via `assignTeam`) switches to reading/writing
`lineup`; a new "Team"/"Members" section reads/writes the staff `project_team`. Both are
mechanical once the endpoints exist.

## 2. Progress updates — a text log posted by users  ⬅ TO IMPLEMENT (product-confirmed)

**Status: confirmed needed (2026-07-14). Blocked on backend — must be built here.**

**Problem:** no free-text progress-update feed exists. Probed `/projects/{id}/updates/`,
`/notes/`, `/comments/`, `/activity/`, `/log/` — all 404. `status-history` is NOT a
substitute: it records only status *transitions*, its `notes` field is unused and
`update-status` ignores any `notes` sent (verified — stored `null`), and rows are only
created when the status actually changes. So today a user cannot post "rider confirmed,
waiting on visas" anywhere.

**Requested:** users post free-text **progress updates** on a project at any time; the
Active Projects Overview shows them as a chronological log (distinct from the read-only
status-change history already shown).

**Recommended: the dedicated table** (not the writable-notes shortcut) — progress
updates should be postable independent of status changes.

**Proposed:**
```
project_updates
------------------------------------------------
id            PK
project_id    FK -> projects.id
user_id       FK -> users.id
body          text
created_at    timestamp
```
Endpoints:
- `GET  /projects/{id}/updates/`   → `{ project_id, updates:[{id, user_id, username, body, created_at}] }`
- `POST /projects/{id}/updates/`   body `{ user_id, body }`
- (optional) `DELETE /projects/{id}/updates/{update_id}/`

Return `username` joined (as votes/comments do) so the client needs no user lookup.

**Attribution caveat:** the Greenroom API has no auth — all writes are currently
attributed server-side to a default user (9, "manager1"). For progress updates to show
the real author, the `POST` must **accept and store the `user_id` from the body** (as the
pitch vote/comment endpoints already do), rather than defaulting server-side.

**Note on the existing `notes` field:** `status_history` rows have a `notes` column, but
`update-status` **ignores** any `notes` sent in the body (verified live 2026-07-14 — the
stored row was `notes: null`). A cheaper alternative to the table above is to **make that
`notes` field writable** on `update-status`, giving a note-per-status-change. That only
covers updates tied to a status change, though — for standalone updates use
`project_updates`. Also: the read-only status-*change* timeline is already surfaceable
frontend-only (no backend work needed) — this section is only about **free-text updates**.

## 3. Timings field on a project

**Problem:** projects have no time-of-day / set-times field. (Pitches packed a free-text
"timelines" into their description; projects have nothing.)

**Requested:** a "timings" value on the project Overview.

**Proposed (simplest):** add a nullable free-text `timings` column to the projects table,
accepted by `create/` and `update/`, returned in list + detail. If structured set-times
are needed later, model as a child table instead — but free text matches how pitches did
it and is enough for the Overview.

## 4. Not needed

- **Deadline** — dropped per product; the Overview keeps `start_date` + `end_date`. No
  new field.
