import { useEffect, useRef } from "react";
import { AUTH_CALLBACK_PATH, AUTH_ENABLED } from "@/config/auth";
import { useAuthStore } from "@/stores/useAuthStore";
import { captureDirtyToSession, hasDirty } from "@/lib/auth/dirtyStash";

// Proactive token renewal: Google id_tokens live ~1h and renewing reactively
// (on a 401) means a full-page prompt=none redirect lands whenever the token
// happens to die — possibly mid-edit. Instead, shortly before expiry, renew
// at a safe moment: tab visible (a background navigation is unreliable) and
// nothing dirty (the reload is only non-destructive when there's nothing to
// lose). If no safe moment arrives before expiry, do nothing — the reactive
// 401 → silentReauth path (which stashes unsaved edits) remains the fallback.

// How long before expiry to start trying.
const LEAD_MS = 3 * 60_000;
// While inside the lead window but blocked (hidden tab / unsaved edits), how
// often to re-check for a safe moment.
const RETRY_MS = 30_000;

export function useProactiveReauth(): void {
  const status = useAuthStore((s) => s.status);
  const expiresAt = useAuthStore((s) => s.expiresAt);

  // The expiresAt value we've already fired a renewal for — one redirect per
  // expiry window, even if the effect re-runs before navigation completes.
  const firedForRef = useRef<number | null>(null);

  useEffect(() => {
    if (!AUTH_ENABLED || status !== "authenticated" || expiresAt == null) {
      return;
    }

    let timer: number | undefined;

    const attemptRenew = () => {
      if (firedForRef.current === expiresAt) return;
      const blocked =
        document.visibilityState !== "visible" ||
        hasDirty() ||
        window.location.pathname === AUTH_CALLBACK_PATH;
      if (blocked) {
        // Re-check for a safe moment only while the token is still alive;
        // past expiry the reactive 401 path takes over, so stop (no loop).
        if (Date.now() < expiresAt) {
          timer = window.setTimeout(attemptRenew, RETRY_MS);
        }
        return;
      }
      firedForRef.current = expiresAt;
      // Idle + clean + visible: the redirect loses nothing. On return,
      // handleCallback advances expiresAt and this effect re-schedules.
      void useAuthStore.getState().silentReauth();
    };

    const delay = Math.max(0, expiresAt - LEAD_MS - Date.now());
    timer = window.setTimeout(attemptRenew, delay);
    return () => window.clearTimeout(timer);
  }, [status, expiresAt]);

  // Backstop: stash unsaved edits on ANY full-page navigation (manual reload,
  // tab close), not just silentReauth's redirect. captureDirtyToSession is
  // synchronous, no-ops when clean, and never throws. Deliberately no
  // preventDefault/returnValue — never pop "leave site?" or block a redirect.
  useEffect(() => {
    if (!AUTH_ENABLED) return;
    window.addEventListener("beforeunload", captureDirtyToSession);
    return () =>
      window.removeEventListener("beforeunload", captureDirtyToSession);
  }, []);
}
