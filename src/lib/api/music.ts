import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import { greenroomFetch } from "@/lib/api/client";
import type { Track } from "@/stores/useIpodStore";

// Collective iPod library — a single global list of YouTube tracks every user
// can view, add to, and remove from. Backed by the Greenroom `music` domain
// (/api/music/tracks/). No auth: writes are anonymous and fully open (anyone
// can add and anyone can remove); the author's user_id is sent only for
// attribution. Wire shape is snake_case; map to/from the store's camelCase
// `Track` via toTrack() / at the call site.

export interface IpodTrackRow {
  id: string; // YouTube video id
  url: string;
  title: string;
  artist?: string | null;
  album?: string | null;
  lyric_offset?: number | null;
  added_by_user_id?: number | null;
  date_created?: string | null;
  date_last_updated?: string | null;
}

export interface AddTrackPayload {
  id: string;
  url: string;
  title: string;
  artist?: string;
  album?: string;
  lyric_offset?: number;
  added_by_user_id?: number;
}

interface TracksListResponse {
  tracks: IpodTrackRow[];
}

/** Map a wire row to the store's `Track` shape. */
export function toTrack(row: IpodTrackRow): Track {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    artist: row.artist ?? undefined,
    album: row.album ?? undefined,
    lyricOffset: row.lyric_offset ?? undefined,
  };
}

/** Map a store `Track` to the add-track wire payload. */
export function toAddPayload(
  track: Track,
  addedByUserId?: number
): AddTrackPayload {
  return {
    id: track.id,
    url: track.url,
    title: track.title,
    artist: track.artist,
    album: track.album,
    lyric_offset: track.lyricOffset,
    ...(addedByUserId ? { added_by_user_id: addedByUserId } : {}),
  };
}

export async function listTracks(): Promise<Track[]> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/music/tracks/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch tracks: ${response.statusText}`);
  }
  const data: TracksListResponse = await response.json();
  return (data.tracks || []).map(toTrack);
}

export async function addTrack(payload: AddTrackPayload): Promise<Track> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/music/tracks/create/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to add track: ${response.statusText}`);
  }
  const data: { track: IpodTrackRow } = await response.json();
  return toTrack(data.track);
}

export async function removeTrack(id: string): Promise<void> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/music/tracks/${encodeURIComponent(id)}/delete/`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      error.error || `Failed to remove track: ${response.statusText}`
    );
  }
}
