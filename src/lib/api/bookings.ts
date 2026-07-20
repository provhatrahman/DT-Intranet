import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import { greenroomFetch } from "@/lib/api/client";

// LIVE — verified against the running backend on 2026-07-06 (BACKEND_STATE.md).
// The bookings service is project-centric: a booking links an artist to a
// project, and the event fields shown on a booking (event_date, city, country,
// venue) are denormalized FROM the project. Set event data on the project.

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed"
  | string;

export interface BookingListItem {
  booking_id: number;
  artist_id: number;
  artist_name: string;
  project_id: number;
  project_name: string;
  event_date: string | null;
  city: string | null;
  country: string | null;
  location_id: number | null;
  // Event venue, denormalized from the linked project (shown as "Venue" on
  // Inbox offer cards, distinct from the city/country "location").
  venue_name: string | null;
  status: BookingStatus;
  agreed_fee: string | null;
  notes: string | null;
  // Free-text event timings shown as "Time" on offer cards (e.g. "Doors 7pm").
  timings: string | null;
  // When the booking (offer) was logged — shown as "Submitted", mirroring a
  // pitch's date_submitted.
  date_created: string | null;
  // Vote rollups, mirroring the pitch list. Present once the backend booking
  // vote endpoints are live; treated as 0 when absent.
  total_votes?: number;
  yes_votes?: number;
  // Server-recorded creator, used to gate delete server-side (owner-or-admin).
  // null/undefined on legacy rows created before this field existed.
  created_by_user_id?: number | null;
}

// One vote per user on a booking, mirroring PitchVote exactly.
export interface BookingVote {
  user_id: number;
  username: string;
  vote_value: number;
  comment: string | null;
  // Independent of vote_value: this voter wants to be personally involved.
  wants_involvement?: boolean;
}

export interface BookingDetail {
  booking_id: number;
  artist: { id: number; name: string };
  project: {
    id: number;
    name: string;
    event_date: string | null;
    city: string | null;
    country: string | null;
    location_id: number | null;
    venue_name: string | null;
    gig_size_id: number | null;
  };
  status: BookingStatus;
  agreed_fee: string | null;
  notes: string | null;
  timings: string | null;
  date_created: string | null;
  votes: BookingVote[];
}

// One vote per user, upserted: voting again REPLACES the previous vote.
// vote_value is 1 (yes), -1 (no), or 0 (abstain / clear). The backend
// validates the value and rejects anything else with 400.
export interface BookingVotePayload {
  user_id: number;
  vote_value: 1 | -1 | 0;
  comment?: string;
  // Optional; omitted keys are left unchanged by the backend. Sent to flag
  // (or clear) that the voter wants to be personally involved.
  wants_involvement?: boolean;
}

// artist_id + project_id are the only required fields.
export interface CreateBookingPayload {
  artist_id: number;
  project_id: number;
  status?: BookingStatus;
  agreed_fee?: string | number;
  notes?: string;
  timings?: string;
}

export interface UpdateBookingPayload {
  artist_id?: number;
  project_id?: number;
  status?: BookingStatus;
  agreed_fee?: string | number;
  notes?: string;
  timings?: string;
}

interface BookingsListResponse {
  bookings: BookingListItem[];
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const error = await response
    .json()
    .catch(() => ({ error: response.statusText }));
  return error.error || fallback;
}

// The list endpoint takes no verified query params; filter client-side.
export async function getBookings(): Promise<BookingListItem[]> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/bookings/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch bookings: ${response.statusText}`);
  }
  const data: BookingsListResponse = await response.json();
  return data.bookings;
}

export async function getBookingById(id: number): Promise<BookingDetail> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/bookings/${id}/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch booking ${id}: ${response.statusText}`);
  }
  return await response.json();
}

export async function createBooking(
  payload: CreateBookingPayload
): Promise<{
  id: number;
  artist_name: string;
  project_name: string;
  message: string;
}> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/bookings/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to create booking"));
  }
  return await response.json();
}

export async function updateBooking(
  id: number,
  payload: UpdateBookingPayload
): Promise<{ message: string; booking_id: number }> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/bookings/${id}/update/`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to update booking"));
  }
  return await response.json();
}

export async function deleteBooking(
  id: number
): Promise<{ message: string }> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/bookings/${id}/delete/`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to delete booking"));
  }
  return await response.json();
}

// Mirror of voteOnPitch. One vote per user per booking, upserted on re-vote.
export async function voteOnBooking(
  id: number,
  payload: BookingVotePayload
): Promise<{ message: string; vote_id: number; vote_value: number }> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/bookings/${id}/vote/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to vote on booking"));
  }
  return await response.json();
}
