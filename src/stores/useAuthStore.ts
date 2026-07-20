import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import {
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_CLIENT_ID,
  GOOGLE_SCOPES,
  getRedirectUri,
  PKCE_VERIFIER_KEY,
  OAUTH_STATE_KEY,
} from "@/config/auth";
import {
  computeCodeChallenge,
  decodeJwtPayload,
  randomUrlSafe,
} from "@/lib/auth/pkce";
import {
  captureDirtyToSession,
  clearDirtyStash,
} from "@/lib/auth/dirtyStash";

// The identity the backend maps a verified Google account to. Mirrors the
// agreed POST /api/users/auth/verify response: { user: {...} }.
export interface GreenroomAuthUser {
  id: number;
  username: string;
  email: string;
  role: string | null;
  is_admin: boolean;
}

export type AuthStatus =
  | "idle" // logged out
  | "authenticating" // redirecting / exchanging / verifying
  | "authenticated"
  | "error";

interface AuthState {
  status: AuthStatus;
  idToken: string | null;
  expiresAt: number | null; // ms epoch
  user: GreenroomAuthUser | null;
  error: string | null;

  /** Kick off login: redirect to Google (Authorization Code + PKCE). */
  startLogin: () => Promise<void>;
  /** Complete the redirect: send ?code to the backend, store the session. */
  handleCallback: (search: string) => Promise<void>;
  /** Re-confirm allowlist access with the backend using the current id token. */
  verify: () => Promise<void>;
  /** Try to renew silently; resolves true if we ended up authenticated. */
  silentReauth: () => Promise<boolean>;
  logout: () => void;
  isAuthenticated: () => boolean;
}

const VERIFY_URL = `${GREENROOM_API_BASE}/users/auth/verify`;
const EXCHANGE_URL = `${GREENROOM_API_BASE}/users/auth/exchange`;

function expiryFromIdToken(idToken: string, fallbackSeconds = 3600): number {
  const exp = decodeJwtPayload(idToken)?.exp;
  return exp ? exp * 1000 : Date.now() + fallbackSeconds * 1000;
}

// Build the Google authorization URL and stash the PKCE verifier + state.
async function beginGoogleRedirect(extraParams: Record<string, string> = {}) {
  const verifier = randomUrlSafe(48);
  const state = randomUrlSafe(16);
  const challenge = await computeCodeChallenge(verifier);
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    // access_type=online — no refresh token in the browser; renew via prompt=none.
    access_type: "online",
    ...extraParams,
  });
  window.location.assign(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      status: "idle",
      idToken: null,
      expiresAt: null,
      user: null,
      error: null,

      startLogin: async () => {
        set({ status: "authenticating", error: null });
        await beginGoogleRedirect();
      },

      handleCallback: async (search: string) => {
        set({ status: "authenticating", error: null });
        const params = new URLSearchParams(search);

        const err = params.get("error");
        if (err) {
          // e.g. login_required from a failed prompt=none attempt.
          set({ status: "idle", error: err });
          return;
        }

        const code = params.get("code");
        const state = params.get("state");
        const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
        const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
        sessionStorage.removeItem(OAUTH_STATE_KEY);
        sessionStorage.removeItem(PKCE_VERIFIER_KEY);

        if (!code || !state || state !== expectedState || !verifier) {
          set({ status: "error", error: "invalid_callback" });
          return;
        }

        // The code->token exchange happens SERVER-SIDE: Google "Web application"
        // clients require the client secret, which must never reach the browser.
        // We hand the backend the code + PKCE verifier; it exchanges, verifies
        // the id_token, confirms allowlist access, and returns {user, id_token}.
        try {
          const res = await fetch(EXCHANGE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              code_verifier: verifier,
              redirect_uri: getRedirectUri(),
            }),
          });
          if (res.status === 403) {
            // 403 carries a specific code (not_allowlisted vs account_disabled)
            // in the body — surface it so the login screen shows the right copy.
            const code =
              (await res.json().catch(() => null))?.error || "not_allowlisted";
            set({ status: "error", error: code, user: null });
            return;
          }
          if (!res.ok) {
            const code =
              (await res.json().catch(() => null))?.error ||
              "token_exchange_failed";
            set({ status: "error", error: code });
            return;
          }
          const data = (await res.json()) as {
            user: GreenroomAuthUser;
            id_token: string;
          };
          if (!data.id_token || !data.user) {
            set({ status: "error", error: "token_exchange_failed" });
            return;
          }
          set({
            idToken: data.id_token,
            expiresAt: expiryFromIdToken(data.id_token),
            user: data.user,
            status: "authenticated",
            error: null,
          });
        } catch {
          set({ status: "error", error: "token_exchange_failed" });
        }
      },

      verify: async () => {
        const { idToken } = get();
        if (!idToken) {
          set({ status: "idle" });
          return;
        }

        try {
          const res = await fetch(VERIFY_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
          });
          if (res.status === 403) {
            // 403 carries a specific code (not_allowlisted vs account_disabled)
            // in the body — surface it so the login screen shows the right copy.
            const code =
              (await res.json().catch(() => null))?.error || "not_allowlisted";
            set({ status: "error", error: code, user: null });
            return;
          }
          if (!res.ok) {
            set({ status: "error", error: "verify_failed", user: null });
            return;
          }
          const data = (await res.json()) as { user: GreenroomAuthUser };
          set({ user: data.user, status: "authenticated", error: null });
        } catch {
          set({ status: "error", error: "verify_failed" });
        }
      },

      silentReauth: async () => {
        // A full-page prompt=none redirect. Remember where we were so the
        // callback can restore it. If Google can't renew silently it returns
        // error=login_required / interaction_required and handleCallback drops
        // us to idle (the LoginScreen), keeping the interactive flow as fallback.
        sessionStorage.setItem(
          "greenroom:return_to",
          window.location.pathname + window.location.search + window.location.hash
        );
        // Stash any unsaved in-app edits so the reload doesn't lose them —
        // the owning app restores + re-saves them after the callback. (The
        // token is already dead here, so flushing saves first can't work.)
        captureDirtyToSession();
        // Pass login_hint so Google can silently pick the right session without
        // an account chooser — without it, prompt=none returns
        // interaction_required even when a valid session exists.
        const email = get().user?.email;
        await beginGoogleRedirect({
          prompt: "none",
          ...(email ? { login_hint: email } : {}),
        });
        // Navigation is in flight; treat as not-yet-authenticated for callers.
        return false;
      },

      logout: () => {
        // Never let a later login in this tab resurrect this session's edits.
        clearDirtyStash();
        set({
          status: "idle",
          idToken: null,
          expiresAt: null,
          user: null,
          error: null,
        });
      },

      isAuthenticated: () => {
        const { status, user, expiresAt } = get();
        if (status !== "authenticated" || !user) return false;
        if (expiresAt && Date.now() >= expiresAt) return false;
        return true;
      },
    }),
    {
      name: "greenroom-auth",
      // Persist only the session, not transient status/error.
      partialize: (s) => ({
        idToken: s.idToken,
        expiresAt: s.expiresAt,
        user: s.user,
        status: s.status === "authenticated" ? "authenticated" : "idle",
      }),
    }
  )
);
