import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import { greenroomFetch } from "@/lib/api/client";

export interface ArtistListItem {
  id: number;
  artist_name: string;
  preferred_name: string | null;
  is_active: boolean;
  is_collective_member: boolean;
}

export interface ArtistLocation {
  city: string;
  country: string;
}

export interface ArtistDetail {
  id: number;
  roster_unique_id?: number | null;
  artist_name: string;
  preferred_name: string | null;
  pronouns: string | null;
  type_of_act: string | null;
  heritage: string | null;
  bio: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  instagram: string | null;
  soundcloud: string | null;
  tiktok: string | null;
  website: string | null;
  is_collective_member: boolean;
  is_active: boolean;
  date_of_birth: string | null;
  genres: string[];
  locations: ArtistLocation[];
}

export interface CreateArtistPayload {
  artist_name: string;
  preferred_name?: string;
  pronouns?: string;
  type_of_act?: string;
  heritage?: string;
  bio?: string;
  primary_email?: string;
  primary_phone?: string;
  instagram?: string;
  soundcloud?: string;
  tiktok?: string;
  website?: string;
  is_collective_member?: boolean;
  is_active?: boolean;
  date_of_birth?: string;
  system_user_id?: number;
}

export interface GetArtistsParams {
  is_active?: boolean;
  is_collective_member?: boolean;
}

interface ArtistsListResponse {
  artists: ArtistListItem[];
}

interface ArtistDetailResponse {
  artist: Omit<ArtistDetail, "genres" | "locations">;
  genres?: string[];
  locations?: ArtistLocation[];
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const error = await response
    .json()
    .catch(() => ({ error: response.statusText }));
  return error.error || fallback;
}

export async function getArtists(
  params?: GetArtistsParams
): Promise<ArtistListItem[]> {
  const query = new URLSearchParams();
  if (params?.is_active !== undefined) {
    query.set("is_active", String(params.is_active));
  }
  if (params?.is_collective_member !== undefined) {
    query.set("is_collective_member", String(params.is_collective_member));
  }
  const queryString = query.toString();
  const url = queryString
    ? `${GREENROOM_API_BASE}/artists/?${queryString}`
    : `${GREENROOM_API_BASE}/artists/`;
  const response = await greenroomFetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch artists: ${response.statusText}`);
  }
  const data: ArtistsListResponse = await response.json();
  return data.artists;
}

export async function getArtistById(id: number): Promise<ArtistDetail> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/artists/${id}/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch artist ${id}: ${response.statusText}`);
  }
  const data: ArtistDetailResponse = await response.json();
  return {
    ...data.artist,
    genres: data.genres ?? [],
    locations: data.locations ?? [],
  };
}

export interface FindArtistResult {
  id: number;
  artist_name: string;
  found: boolean;
}

export async function findArtistByName(
  name: string
): Promise<FindArtistResult> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/artists/find/?name=${encodeURIComponent(name)}`
  );
  // The endpoint answers 404 with { found: false } when there's no match —
  // that's a valid "no such artist" result, not a transport error.
  if (response.status === 404) {
    return { id: 0, artist_name: name, found: false };
  }
  if (!response.ok) {
    throw new Error(`Failed to find artist: ${response.statusText}`);
  }
  return await response.json();
}

export async function createArtist(
  payload: CreateArtistPayload
): Promise<{ id: number; artist_name: string; message: string }> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/artists/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to create artist"));
  }
  return await response.json();
}
