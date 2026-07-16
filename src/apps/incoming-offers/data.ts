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
