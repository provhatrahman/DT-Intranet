import { GREENROOM_API_BASE } from "@/config/greenroomApi";

// STUBBED: The /api/bookings/ service currently returns 500 (Django
// ProgrammingError, likely an unapplied migration). These functions and types
// are implemented against the documented contract so the Inbox/Incoming Offers
// app can be wired up trivially once the backend is repaired, but they are NOT
// called from the UI yet. Do not rely on these at runtime until the bookings
// service is fixed.

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | string;

export interface BookingListItem {
  booking_id: number;
  artist_id: number;
  artist_name: string;
  event_id: number;
  event_name: string;
  status: BookingStatus;
  agreed_fee: string | null;
}

export interface BookingDetail {
  booking_id: number;
  artist: { id: number; name: string };
  event: { id: number; name: string; event_date: string };
  status: BookingStatus;
  agreed_fee: string | null;
}

export interface CreateBookingPayload {
  artist_id: number;
  event_id: number;
  status?: BookingStatus;
  agreed_fee?: string | number;
  notes?: string;
  user_id?: number;
}

export interface UpdateBookingPayload {
  artist_id?: number;
  event_id?: number;
  status?: BookingStatus;
  agreed_fee?: string | number;
  notes?: string;
  user_id?: number;
  updated_by_user_id?: number;
}

export interface GetBookingsParams {
  artist_id?: number;
  start_date?: string;
  end_date?: string;
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

export async function getBookings(
  params?: GetBookingsParams
): Promise<BookingListItem[]> {
  const query = new URLSearchParams();
  if (params?.artist_id !== undefined) {
    query.set("artist_id", String(params.artist_id));
  }
  if (params?.start_date) query.set("start_date", params.start_date);
  if (params?.end_date) query.set("end_date", params.end_date);
  const queryString = query.toString();
  const url = queryString
    ? `${GREENROOM_API_BASE}/bookings/?${queryString}`
    : `${GREENROOM_API_BASE}/bookings/`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch bookings: ${response.statusText}`);
  }
  const data: BookingsListResponse = await response.json();
  return data.bookings;
}

export async function getBookingById(id: number): Promise<BookingDetail> {
  const response = await fetch(`${GREENROOM_API_BASE}/bookings/${id}/`);
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
  event_name: string;
  message: string;
}> {
  const response = await fetch(`${GREENROOM_API_BASE}/bookings/create/`, {
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
  const response = await fetch(
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
