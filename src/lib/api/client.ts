import { AUTH_ENABLED } from "@/config/auth";
import { useAuthStore } from "@/stores/useAuthStore";

// Drop-in replacement for `fetch` used by every Greenroom API module. It:
//   1. attaches `Authorization: Bearer <id_token>` when auth is enabled and a
//      session exists (no-op when AUTH_ENABLED is false — behaves like fetch);
//   2. on a 401, attempts a silent re-auth. silentReauth navigates away via a
//      prompt=none redirect, so in practice the request is abandoned mid-flight
//      and the retry below only runs if renewal ever resolves synchronously.
//
// Only Greenroom API calls go through here, so the bearer never leaks to Google
// or to the ryOS /api routes.

function withBearer(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
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
