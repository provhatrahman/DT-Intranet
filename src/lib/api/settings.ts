// Client for the per-user UI-settings API (GET/PUT /api/users/settings/, served
// by the backend `users` domain). Mirrors src/lib/api/projects.ts: typed calls
// through greenroomFetch (which attaches the bearer + handles 401), local
// parseError. The endpoint is anonymous today (accepts a user_id fallback while
// REQUIRE_AUTH is off) and becomes per-authenticated-user once auth is enforced.

import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import { greenroomFetch } from "@/lib/api/client";
import type { StylingSnapshot } from "@/utils/stylingSnapshot";

interface GetSettingsResponse {
  settings: Record<string, unknown>;
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const error = await response
    .json()
    .catch(() => ({ error: response.statusText }));
  return error.error || fallback;
}

/**
 * Fetch the current user's styling snapshot. Returns `null` when the account
 * has no row yet (the server sends `{settings: {}}`), so callers can seed it.
 * `userId` is the anonymous fallback used while REQUIRE_AUTH is off.
 */
export async function getUserSettings(
  userId?: number | null
): Promise<StylingSnapshot | null> {
  const url =
    userId != null
      ? `${GREENROOM_API_BASE}/users/settings/?user_id=${encodeURIComponent(userId)}`
      : `${GREENROOM_API_BASE}/users/settings/`;
  const response = await greenroomFetch(url);
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to fetch settings"));
  }
  const data = (await response.json()) as GetSettingsResponse;
  const settings = data.settings;
  if (
    !settings ||
    typeof settings !== "object" ||
    Object.keys(settings).length === 0
  ) {
    return null;
  }
  return settings as unknown as StylingSnapshot;
}

/** Replace (upsert) the current user's styling snapshot. */
export async function putUserSettings(
  snapshot: StylingSnapshot,
  userId?: number | null,
  signal?: AbortSignal
): Promise<void> {
  const body: Record<string, unknown> = { settings: snapshot };
  if (userId != null) body.user_id = userId;
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/users/settings/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to save settings"));
  }
}
