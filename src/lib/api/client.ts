import { AUTH_ENABLED } from "@/config/auth";
import { useAuthStore } from "@/stores/useAuthStore";

// Drop-in replacement for `fetch` used by every Greenroom API module. It:
//   1. attaches `Authorization: Bearer <id_token>` when auth is enabled and a
//      session exists (no-op when AUTH_ENABLED is false — behaves like fetch);
//   2. on a 401, attempts a silent re-auth. silentReauth navigates away via a
//      prompt=none redirect, so in practice the request is abandoned mid-flight
//      and the retry below only runs if renewal ever resolves synchronously.
//   3. on a 403 (e.g. role revoked server-side), fires a throttled background
//      verify() to refresh the cached identity/role so stale admin UI doesn't
//      keep rendering controls that will all fail.
//
// Only Greenroom API calls go through here, so the bearer never leaks to Google
// or to the ryOS /api routes.

function withBearer(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

// Throttle so a burst of 403s (e.g. several in-flight requests after a role
// revocation) only triggers one /auth/verify re-fetch per window.
const VERIFY_THROTTLE_MS = 60_000;
let lastForbiddenVerifyAt = 0;

function refreshIdentityAfterForbidden(): void {
  const now = Date.now();
  if (now - lastForbiddenVerifyAt < VERIFY_THROTTLE_MS) {
    return;
  }
  lastForbiddenVerifyAt = now;
  // Fire-and-forget: just refresh the cached user/role, don't retry or
  // redirect. verify() only sets status/user/error from /auth/verify.
  void useAuthStore.getState().verify();
}

export async function greenroomFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  if (!AUTH_ENABLED) {
    return fetch(url, init);
  }

  const { idToken } = useAuthStore.getState();
  const res = await fetch(url, idToken ? withBearer(init, idToken) : init);

  if (res.status === 403) {
    refreshIdentityAfterForbidden();
    return res;
  }

  if (res.status !== 401) {
    return res;
  }

  const reauthed = await useAuthStore.getState().silentReauth();
  if (!reauthed) {
    // A prompt=none redirect is in flight; nothing will consume this response.
    return res;
  }

  const freshToken = useAuthStore.getState().idToken;
  return fetch(url, freshToken ? withBearer(init, freshToken) : init);
}
