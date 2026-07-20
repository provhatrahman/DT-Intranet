import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import { greenroomFetch } from "@/lib/api/client";

// Per-artist gig stats from the analytics service: legacy roster-sheet
// history plus live Greenroom bookings. Legacy gigs (imported from "DT Roster
// Database v2.xlsx") were weighted S/M/L = 1/2/3; live COMPLETED bookings
// contribute their project's gig-size weight (XS=1 … XL=5). total_gig_score
// and gig_count sum both sources; last_booked_date/last_event_name reflect
// whichever gig is most recent. Artists with no gigs in either source are
// absent from the response entirely.
export interface ArtistGigScore {
  artist_id: number;
  artist_name: string;
  total_gig_score: number;
  gig_count: number;
  last_booked_date: string | null;
  last_event_name?: string | null;
  legacy_gig_score?: number;
}

interface GigScoresResponse {
  gig_scores: ArtistGigScore[];
}

export async function getGigScores(): Promise<ArtistGigScore[]> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/analytics/gig-scores/`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch gig scores: ${response.statusText}`);
  }
  const data: GigScoresResponse = await response.json();
  return data.gig_scores;
}
