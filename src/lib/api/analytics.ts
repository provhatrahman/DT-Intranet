import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import { greenroomFetch } from "@/lib/api/client";

// Per-artist gig stats from the analytics service. Scores are computed from
// COMPLETED bookings only: each completed booking contributes its project's
// gig-size weight (XS=1 … XL=5) to total_gig_score. last_booked_date is the
// most recent project event_date across the artist's completed bookings, so
// it can be set even for bookings whose project has no gig size. Artists with
// no completed bookings are absent from the response entirely.
export interface ArtistGigScore {
  artist_id: number;
  artist_name: string;
  total_gig_score: number;
  gig_count: number;
  last_booked_date: string | null;
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
