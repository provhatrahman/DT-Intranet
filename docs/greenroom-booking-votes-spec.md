# Backend Spec: Voting on Bookings (Incoming Offers)

**Audience:** the team that owns the external Greenroom API (AWS API Gateway,
base `https://jzre02jvh9.execute-api.eu-west-2.amazonaws.com/api`).
**Author/context:** Greenroom frontend. **Date:** 2026-07-14.
**Status:** proposal — not yet implemented on the backend.

## 1. Why

The Greenroom Inbox ("Incoming Offers") shows two kinds of decision items:

- **Pitches** (`status` submitted/under_review) — the team **votes** yes/no on these,
  then an admin approves/rejects. Backed by the existing pitch-vote model.
- **Bookings** (`status` pending) — external offers for an artist to appear on a
  project. Today the **only** action is an admin confirm/decline. There is **no way to
  vote** on them.

Product requirement: **the team must be able to vote on incoming bookings, exactly like
pitches.** Verified 2026-07-14 that no booking-vote surface exists — `GET
/bookings/{id}/vote/` and all sibling paths return **404**, whereas `GET
/pitches/{id}/vote/` returns **405** (POST-only endpoint exists). We need the booking
side brought to parity.

**Design principle: mirror the pitch-vote model exactly** so the frontend reuses its
existing vote client, store logic, and `VoteButton` UI with minimal change.

## 2. Data model

New table, mirroring the pitch votes table:

```
booking_votes
------------------------------------------------------------------
id             PK
booking_id     FK -> bookings.booking_id   (required, indexed)
user_id        FK -> users.id              (required)
vote_value     integer                     (1 = yes, -1 = no, 0 = abstain)
comment        text        null            (optional, free text)
date_created   timestamp
date_updated   timestamp
------------------------------------------------------------------
UNIQUE (booking_id, user_id)   -- one vote per user per booking; upsert on re-vote
```

Behavior to match pitches (all verified on the pitch side):

- **One vote per user, upserted** — voting again REPLACES the user's previous vote.
- `user_id` must exist → `400 {"error": "User not found"}` otherwise.
- `booking_id` must exist → `404` otherwise.
- `vote_value` intended domain is `1` / `-1` / `0`. (Pitch endpoint does not validate
  this; **please DO validate here** and reject other values with `400` — see §6.)

## 3. Endpoints

### 3.1 Cast / update a vote — NEW

```
POST /bookings/{booking_id}/vote/
Content-Type: application/json

{ "user_id": 13, "vote_value": -1, "comment": "Fee too high" }
```

`comment` optional. Response (mirror pitch vote response):

```json
{ "message": "Vote recorded successfully", "vote_id": 42, "vote_value": -1 }
```

Errors: `400` invalid `vote_value` / missing `user_id` / user not found; `404` booking
not found.

### 3.2 Booking detail — ADD `votes` (and optionally `comments`)

`GET /bookings/{booking_id}/` currently returns:

```json
{ "booking_id": 292, "artist": {...}, "project": {...},
  "status": "pending", "agreed_fee": "4410", "notes": "..." }
```

Add a `votes` array, shaped **identically** to pitch votes:

```json
{ "booking_id": 292, "artist": {...}, "project": {...},
  "status": "pending", "agreed_fee": "4410", "notes": "...",
  "votes": [
    { "user_id": 13, "username": "staff1", "vote_value": -1, "comment": "Fee too high" },
    { "user_id": 9,  "username": "manager1", "vote_value": 1,  "comment": "" }
  ]
}
```

### 3.3 Booking list — ADD vote rollups

`GET /bookings/` currently returns flat booking items. Add `total_votes` and
`yes_votes` per item, matching the pitch list rollup:

```json
{ "booking_id": 292, "...": "...", "status": "pending",
  "total_votes": 2, "yes_votes": 1 }
```

- `total_votes` = count of all votes on the booking.
- `yes_votes` = count of votes with `vote_value === 1`.

(This lets the Inbox show a summary without fetching every booking's detail.)

### 3.4 Comments — OPTIONAL (nice-to-have, matches pitches)

Pitches also support threaded comments (`POST /pitches/{id}/comments/`, returned in
detail). If you want full parity (e.g. reject-with-reason feedback on bookings), add:

```
POST /bookings/{booking_id}/comments/   body { user_id, comment, parent_comment_id? }
```

and include a `comments` array in the detail response, shaped like pitch comments
(`{ id, user_id, username, comment, parent_comment_id, date_created }`). **Not required
for MVP** — the vote-level `comment` field covers "vote no with a reason."

## 4. Reference: the existing pitch shapes to mirror

Verified live 2026-07-06/07-14.

- `POST /pitches/{id}/vote/` body `{ user_id, vote_value, comment? }` →
  `{ message, vote_id, vote_value }`. One vote/user, upserted.
- `GET /pitches/{id}/` → `{ pitch, votes:[{user_id,username,vote_value,comment}],
  comments:[...] }`.
- `GET /pitches/` list items include `total_votes` and `yes_votes`.

Keep booking field names **identical** (`vote_value`, `user_id`, `username`, `comment`,
`total_votes`, `yes_votes`) so no per-entity mapping is needed on the client.

## 5. Frontend integration (once the backend ships this)

Small, mechanical work — no new UI to design:

1. Add `voteOnBooking(id, {user_id, vote_value, comment?})` to
   `src/lib/api/bookings.ts` (copy of `voteOnPitch`).
2. Extend `BookingDetail`/`BookingListItem` types with `votes` / `total_votes` /
   `yes_votes`.
3. `useBookingsStore`: add `voteOnBooking` + detail fetch (mirror `usePitchesStore`).
4. Inbox: render the existing `VoteButton` Yes/No on **booking** offer cards too, and
   compute vote counts from the booking `votes` array (mirror the pitch path). Admin
   still owns approve/decline.

## 6. Decisions / open questions for the backend team

1. **Validate `vote_value`?** We recommend rejecting anything other than `1/-1/0` with
   `400` (the pitch endpoint does NOT validate and has accepted stray values like `5` —
   please don't repeat that here).
2. **Who can vote?** The API is currently unauthenticated (all writes attributed to a
   default user server-side). Voting parity only needs `user_id` in the body, as pitches
   do. Real per-user auth is a separate, larger effort (see FUNCTIONALITY_AUDIT.md).
3. **Should a vote be allowed only while `status = pending`?** Suggest allowing votes in
   `pending` (and maybe `under_review`-equivalent) states only; ignore/reject once
   confirmed/declined/cancelled/completed. Your call.
4. **Deletion constraints:** pitches can't be deleted once they have votes/comments.
   Decide whether the same applies to bookings, or whether declining/cancelling should
   cascade-delete votes.
