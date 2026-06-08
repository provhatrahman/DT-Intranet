import { GREENROOM_API_BASE } from "@/config/greenroomApi";

// STUBBED: The /api/events/ service currently returns 500 (Django
// ProgrammingError, likely an unapplied migration). These functions and types
// are implemented against the documented contract so the UI can be wired up
// trivially once the backend is repaired, but they are NOT called from the UI
// yet. Do not rely on these at runtime until the events service is fixed.

export interface EventListItem {
  id: number;
  name: string;
  event_date: string;
  city: string | null;
  country: string | null;
  gig_size_id: number | null;
  gig_size_code: string | null;
}

export interface EventDetail extends EventListItem {
  event_type: string | null;
  venue_name: string | null;
  budget: string | null;
}

export interface CreateEventPayload {
  name: string;
  event_date: string;
  gig_size_id: number;
  event_type?: string;
  venue?: number;
  venue_name?: string;
  city?: string;
  country?: string;
  promoter?: number;
  promoter_name?: string;
  budget?: string | number;
  source?: string;
  gig_size_code?: string;
  user_id?: number;
}

export interface UpdateEventPayload {
  name?: string;
  event_date?: string;
  event_type?: string;
  venue_name?: string;
  venue?: number;
  city?: string;
  country?: string;
  promoter_name?: string;
  promoter?: number;
  budget?: string | number;
  source?: string;
  gig_size_id?: number;
  gig_size_code?: string;
  user_id?: number;
  updated_by_user_id?: number;
}

export interface GetEventsParams {
  start_date?: string;
  end_date?: string;
}

interface EventsListResponse {
  events: EventListItem[];
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const error = await response
    .json()
    .catch(() => ({ error: response.statusText }));
  return error.error || fallback;
}

export async function getEvents(
  params?: GetEventsParams
): Promise<EventListItem[]> {
  const query = new URLSearchParams();
  if (params?.start_date) query.set("start_date", params.start_date);
  if (params?.end_date) query.set("end_date", params.end_date);
  const queryString = query.toString();
  const url = queryString
    ? `${GREENROOM_API_BASE}/events/?${queryString}`
    : `${GREENROOM_API_BASE}/events/`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.statusText}`);
  }
  const data: EventsListResponse = await response.json();
  return data.events;
}

export async function getEventById(id: number): Promise<EventDetail> {
  const response = await fetch(`${GREENROOM_API_BASE}/events/${id}/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch event ${id}: ${response.statusText}`);
  }
  return await response.json();
}

export async function createEvent(
  payload: CreateEventPayload
): Promise<{ id: number; name: string; message: string }> {
  const response = await fetch(`${GREENROOM_API_BASE}/events/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to create event"));
  }
  return await response.json();
}

export async function updateEvent(
  id: number,
  payload: UpdateEventPayload
): Promise<{ message: string; event_id: number }> {
  const response = await fetch(`${GREENROOM_API_BASE}/events/${id}/update/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to update event"));
  }
  return await response.json();
}
