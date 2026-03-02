# Greenroom API Database Schema

Generated: 29/12/2025, 21:47:19

---

## artists

| Field Name | Type | Nullable | Sample Value |
|------------|------|----------|-------------|
| id | integer | No | 25 |
| artist_name | string | No | "Aurora Black" |
| preferred_name | string | No | "Aurora" |
| is_active | boolean | No | true |
| is_collective_member | boolean | No | false |

---

## artists_detailed

| Field Name | Type | Nullable | Sample Value |
|------------|------|----------|-------------|
| id | integer | No | 25 |
| roster_unique_id | integer | No | 1000 |
| artist_name | string | No | "Aurora Black" |
| preferred_name | string | No | "Aurora" |
| pronouns | string | No | "he/him" |
| type_of_act | string | No | "Collective" |
| heritage | string | No | "Caribbean" |
| bio | string | No | "Aurora Black is a talented artist known for their |
| primary_email | string | No | "aurorablack@example.com" |
| primary_phone | string | No | "+44 7711994957" |
| instagram | string | No | "@aurorablack" |
| soundcloud | string | No | "aurorablack" |
| tiktok | string | No | "@aurorablack" |
| website | string | No | "https://www.aurorablack.com" |
| is_collective_member | boolean | No | false |
| is_active | boolean | No | true |
| date_of_birth | date | No | "2005-01-10" |

**Relationships:**
- roster_unique (via roster_unique_id)

---

## bookings

| Field Name | Type | Nullable | Sample Value |
|------------|------|----------|-------------|
| booking_id | integer | No | 292 |
| artist_id | integer | No | 26 |
| artist_name | string | No | "Midnight Blue" |
| event_id | integer | No | 151 |
| event_name | string | No | "Afrobeat Party 2026" |
| event_date | date | No | "2026-06-17" |
| city | string | No | "New York" |
| country | string | No | "Canada" |
| status | string | No | "confirmed" |
| agreed_fee | string | No | "4410" |
| notes | string | No | "Booking notes for Midnight Blue at Afrobeat Party |

**Relationships:**
- booking (via booking_id)
- artist (via artist_id)
- event (via event_id)

---

## events

| Field Name | Type | Nullable | Sample Value |
|------------|------|----------|-------------|
| id | integer | No | 323 |
| name | string | No | "Test Event Migration" |
| event_date | date | No | "2026-12-31" |
| event_type | unknown | Yes | null |
| venue_name | unknown | Yes | null |
| city | string | No | "London" |
| country | string | No | "UK" |
| promoter_name | unknown | Yes | null |
| gig_size_id | integer | No | 2 |
| gig_size_code | string | No | "S" |
| source | unknown | Yes | null |

**Relationships:**
- gig_size (via gig_size_id)

---

## gig_scores

| Field Name | Type | Nullable | Sample Value |
|------------|------|----------|-------------|
| artist_id | integer | No | 45 |
| artist_name | string | No | "Jazz Collective" |
| total_gig_score | integer | No | 19 |
| gig_count | integer | No | 4 |

**Relationships:**
- artist (via artist_id)

---

## payments

| Field Name | Type | Nullable | Sample Value |
|------------|------|----------|-------------|
| id | integer | No | 35 |
| artist_id | integer | No | 28 |
| artist_name | string | No | "Golden Hour" |
| booking_id | unknown | Yes | null |
| project_id | integer | No | 145 |
| amount | string | No | "9902" |
| currency | string | No | "EUR" |
| status | string | No | "pending" |
| invoice_number | string | No | "INV-75188" |
| issue_date | date | No | "2025-05-08" |
| due_date | date | No | "2026-01-04" |
| paid_date | date | No | "2025-12-19" |
| notes | string | No | "Payment for Documentary 10" |

**Relationships:**
- artist (via artist_id)
- booking (via booking_id)
- project (via project_id)

---

## pitches

| Field Name | Type | Nullable | Sample Value |
|------------|------|----------|-------------|
| id | integer | No | 2 |
| title | string | No | "Workshop Series 1" |
| description | string | No | "Detailed description of Digital Campaign 1" |
| status | string | No | "under_review" |
| project_id | integer | No | 39 |
| submitter_user_id | integer | No | 9 |
| date_submitted | datetime | No | "2025-12-22T18:57:34.391690" |
| date_closed | unknown | Yes | null |
| total_votes | integer | No | 5 |
| yes_votes | integer | No | 1 |

**Relationships:**
- project (via project_id)
- submitter_user (via submitter_user_id)

---

## project_tasks

| Field Name | Type | Nullable | Sample Value |
|------------|------|----------|-------------|
| blocked | array | No | "[1 items]" |
| completed | array | No | "[1 items]" |
| in_progress | array | No | "[1 items]" |
| review | array | No | "[1 items]" |
| todo | array | No | "[2 items]" |

---

## projects

| Field Name | Type | Nullable | Sample Value |
|------------|------|----------|-------------|
| id | integer | No | 143 |
| name | string | No | "EP Production 8" |
| description | string | No | "Project description for Mixtape 8" |
| status | string | No | "active" |
| project_type | string | No | "Video" |
| start_date | date | No | "2025-03-26" |
| end_date | unknown | Yes | null |
| lead_artist_id | integer | No | 48 |
| budget | string | No | "33272" |

**Relationships:**
- lead_artist (via lead_artist_id)

---

## projects_detailed

| Field Name | Type | Nullable | Sample Value |
|------------|------|----------|-------------|
| id | integer | No | 143 |
| name | string | No | "EP Production 8" |
| description | string | No | "Project description for Mixtape 8" |
| status | string | No | "active" |
| project_type | string | No | "Video" |
| start_date | date | No | "2025-03-26" |
| end_date | unknown | Yes | null |
| lead_artist_id | integer | No | 48 |
| budget | string | No | "33272" |

**Relationships:**
- lead_artist (via lead_artist_id)

---

