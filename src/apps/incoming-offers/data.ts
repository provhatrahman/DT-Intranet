// The Inbox shows two kinds of real backend records (see BACKEND_STATE.md):
//
//  - "pitch" offers: pitches with status submitted/under_review. Voting is the
//    backend's real model — one vote per user of yes(1)/no(-1)/abstain(0)
//    plus an optional comment. Approving calls POST /pitches/{id}/approve/.
//
//  - "booking" offers: bookings with status "pending" — an external offer for
//    an artist to appear on a project. Bookings now use the same yes/no/abstain
//    vote model as pitches (backend booking_votes); admins additionally confirm
//    (approve) or decline. Event data (date, city, venue) is denormalized from
//    the linked project.

// Pitch statuses that count as "awaiting a decision" and belong in the Inbox.
// Shared with the unread-badge counter (useInboxUnvotedCount) so the badge and
// the app's own list stay in lockstep.
export const INBOX_PITCH_STATUSES = ["submitted", "under_review"];

export interface Offer {
  id: string; // "pitch-{id}" | "booking-{id}"
  source: "pitch" | "booking";
  name: string;
  description: string;
  promoter: string;
  venue: string;
  date: string;
  fee: string;
  timings: string;
  submittedAt?: string;
  // pitch offers
  pitchId?: number;
  pitchStatus?: string;
  // booking offers
  bookingId?: number;
  projectId?: number;
  artistName?: string;
  // Server-recorded creator of the booking (owner-or-admin delete gate).
  // null/undefined for legacy bookings created before the backend tracked this.
  createdByUserId?: number | null;
}

// Rollup of the real vote values on a pitch.
export interface PitchVoteCounts {
  yes: number;
  no: number;
  abstain: number;
  // How many voters flagged that they want to be personally involved. This is
  // independent of the yes/no/abstain tally (a voter can want in either way).
  involved: number;
}

export type PitchVoteChoice = "yes" | "no" | "abstain";

// Fee/Budget fields are free text that lands directly in a backend
// DecimalField. Free text like "TBD" or "£500 + travel" 500s the API (and, in
// the Log Offer flow, does so *after* the stand-in project has already been
// created, orphaning it). Validate client-side before submit: empty stays
// allowed (the backend treats it as unset); anything else must reduce to a
// plain decimal once currency symbols/commas/whitespace are stripped.
export function isValidDecimalAmount(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const normalized = trimmed.replace(/[£$€,\s]/g, "");
  return /^\d+(\.\d+)?$/.test(normalized);
}
