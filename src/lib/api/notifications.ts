// Client for the per-user notification center + Web Push subscription API
// (served by the backend `users` domain, `/api/users/notifications/*`).
// Mirrors src/lib/api/settings.ts: typed calls through greenroomFetch (bearer
// + silent reauth), a local parseError, and a `user_id` fallback for
// GET/POST while REQUIRE_AUTH is off. See NOTIFICATIONS_PLAN.md for the full
// design and endpoint contract.

import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import { greenroomFetch } from "@/lib/api/client";

export type NotificationType =
  | "offer_logged"
  | "vote_reminder"
  | "offer_activated"
  | "curation_reminder"
  | "test";

export interface GreenroomNotification {
  id: number;
  type: NotificationType | string;
  title: string;
  body: string;
  link: string | null;
  pitch_id: number | null;
  project_id: number | null;
  created_at: string;
  read_at: string | null;
}

export interface FetchNotificationsResult {
  notifications: GreenroomNotification[];
  unreadCount: number;
}

interface FetchNotificationsResponse {
  notifications: GreenroomNotification[];
  unread_count: number;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
}

export interface SendTestNotificationResult {
  type: NotificationType | string;
  /** User ids a notification-center row was created for. */
  notified: number[];
  /** Requested ids that got nothing — i.e. notifications switched off. */
  skipped: number[];
  /** Push subscriptions (devices) the send was attempted against. */
  push_targets: number;
}

export interface UserPushStatus {
  user_id: number;
  /** Registered push subscriptions. 0 = a send can only reach the bell. */
  devices: number;
  /** false = this user turned notifications off, so a send skips them. */
  enabled: boolean;
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const error = await response
    .json()
    .catch(() => ({ error: response.statusText }));
  return error.error || fallback;
}

/** Appends `user_id` as a query param — the anonymous fallback used while
 * REQUIRE_AUTH is off (see src/lib/api/settings.ts for the same pattern). */
function withUserIdParam(url: string, userId?: number | null): string {
  if (userId == null) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}user_id=${encodeURIComponent(userId)}`;
}

/** Fetch the current user's notifications (newest first) + unread count. */
export async function fetchNotifications(
  userId?: number | null,
  limit = 50
): Promise<FetchNotificationsResult> {
  const url = withUserIdParam(
    `${GREENROOM_API_BASE}/users/notifications/?limit=${encodeURIComponent(limit)}`,
    userId
  );
  const response = await greenroomFetch(url);
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to fetch notifications"));
  }
  const data = (await response.json()) as FetchNotificationsResponse;
  return {
    notifications: data.notifications ?? [],
    unreadCount: data.unread_count ?? 0,
  };
}

/** Mark specific notification ids, or every notification, as read. */
export async function markNotificationsRead(
  ids: number[] | "all",
  userId?: number | null
): Promise<void> {
  const body: Record<string, unknown> = ids === "all" ? { all: true } : { ids };
  if (userId != null) body.user_id = userId;
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/users/notifications/mark-read/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    throw new Error(
      await parseError(response, "Failed to mark notifications read")
    );
  }
}

/** Upsert this device's push subscription (creates it, or reassigns an
 * existing endpoint row to the current user). */
export async function subscribePush(
  payload: PushSubscriptionPayload,
  userId?: number | null
): Promise<void> {
  const body: Record<string, unknown> = { ...payload };
  if (userId != null) body.user_id = userId;
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/users/notifications/subscribe/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    throw new Error(
      await parseError(response, "Failed to save push subscription")
    );
  }
}

/** Remove this device's push subscription. */
export async function unsubscribePush(
  endpoint: string,
  userId?: number | null
): Promise<void> {
  const body: Record<string, unknown> = { endpoint };
  if (userId != null) body.user_id = userId;
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/users/notifications/unsubscribe/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    throw new Error(
      await parseError(response, "Failed to remove push subscription")
    );
  }
}

/**
 * Admin-only: send a test notification to OTHER users (full pipeline — row +
 * real push), so an admin can verify someone else's device actually receives
 * one. `sendTestNotification` above can only ever prove the caller's own
 * device works. The response distinguishes notified from skipped because
 * users with notifications switched off are dropped server-side, silently.
 */
export async function sendTestNotificationToUsers(
  userIds: number[],
  type: NotificationType = "test"
): Promise<SendTestNotificationResult> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/users/notifications/send-test/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_ids: userIds, type }),
    }
  );
  if (!response.ok) {
    throw new Error(
      await parseError(response, "Failed to send test notification")
    );
  }
  return (await response.json()) as SendTestNotificationResult;
}

/**
 * Admin-only: per-user device count + notifications-enabled flag, so the
 * recipient picker can show whether a send can actually reach a phone rather
 * than only the in-app bell.
 */
export async function fetchPushStatus(): Promise<UserPushStatus[]> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/users/notifications/push-status/`
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to load push status"));
  }
  const data = (await response.json()) as { statuses?: UserPushStatus[] };
  return data.statuses ?? [];
}

/**
 * Admin-only: send a test notification (full pipeline — DB row + a real
 * push) to the caller. `type` lets the Notifications pane (a later stage)
 * fire one test button per notification type; defaults to the dedicated
 * "test" type. The backend returns the created notification row; typed
 * loosely since the frontend doesn't need to depend on its exact shape.
 */
export async function sendTestNotification(
  type: NotificationType = "test",
  userId?: number | null
): Promise<{ ok?: boolean } & Record<string, unknown>> {
  const body: Record<string, unknown> = { type };
  if (userId != null) body.user_id = userId;
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/users/notifications/test/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    throw new Error(
      await parseError(response, "Failed to send test notification")
    );
  }
  return (await response.json().catch(() => ({}))) as { ok?: boolean } &
    Record<string, unknown>;
}
