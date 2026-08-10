# Plan: Non-disruptive Google token renewal (silent re-auth)

> Handoff doc for a fresh chat. Author does all browser interaction manually.
> Companion to `AUTH_SETUP.md` (the full auth design).

## Paste this into the new chat to start

> Read `SILENT_REAUTH_PLAN.md` and `AUTH_SETUP.md`. We're fixing the disruptive
> token-expiry re-auth described there. I'll run all browser testing myself —
> give me exact steps to click and what to look for, and wait for my results
> before moving on. Start with Phase 1. Don't deploy; leave changes in the
> working tree for me to review.

---

## The problem

Google `id_token`s expire ~1h (`access_type=online`, no refresh token in the
browser). On expiry, a Greenroom API call 401s and the app does a **full-page
redirect** to Google (`prompt=none`) and back. That reload **discards unsaved
work** — most painfully the debounced autosave in Active Projects' project
detail form. The "retry with fresh token" branch in `greenroomFetch` is
effectively dead code because `silentReauth()` always returns `false` after
kicking off a navigation.

Already shipped (partial mitigation, do not redo): a 403 now triggers a
throttled background `verify()` so a revoked role updates the UI without a
reload. That does NOT address token *expiry*.

## Key files

- `src/lib/api/client.ts` — `greenroomFetch`; the 401 → `silentReauth()` path and
  the dead retry branch.
- `src/stores/useAuthStore.ts` — `silentReauth()` (does `beginGoogleRedirect({prompt:"none"})`,
  returns false), `verify()`, `handleCallback()`, `startLogin()`, `expiresAt`,
  `beginGoogleRedirect()`.
- `src/config/auth.ts` — client id, endpoints, scopes, redirect URI, PKCE keys.
- `src/apps/active-projects/components/ActiveProjectsAppComponent.tsx` — the
  autosave (`ProjectDetailView`, ~700ms debounce) that loses edits on reload.
- Backend (repo `c:\Projects\backend`): `POST /api/users/auth/exchange` and
  `/verify` (server-side token exchange; needs `GOOGLE_CLIENT_SECRET` on
  `prod-users-service` + the NAT gateway so VPC Lambdas reach
  `oauth2.googleapis.com`). See `AUTH_SETUP.md`.

## Recommended approach — two phases, ship Phase 1 first

Phase 1 removes the data loss with low risk. Phase 2 is the "truly silent"
rework and is riskier — only do it if Phase 1 isn't enough.

### Phase 1 — make expiry non-destructive (low risk, do this first)

1. **Proactive refresh while idle.** Track `expiresAt`; a few minutes before it,
   if the tab is visible and there are no unsaved edits, renew (Phase-2 iframe
   if built, else the existing redirect). Renewing at a safe moment means expiry
   rarely bites mid-edit.
2. **Guard the redirect when there's unsaved work.** Before any expiry-driven
   full-page navigation, check for dirty state (start with the Active Projects
   autosave `isDirty`; consider a small global "unsaved work" registry). If
   dirty: flush/await the save first, or defer the redirect and warn the user
   ("Session expiring — save and sign in again"), rather than reloading under
   them.
3. **Preserve + restore in-flight form state across the redirect** as a
   backstop: persist the editing form to `sessionStorage` before navigating and
   rehydrate after `handleCallback` returns to the same view. (`silentReauth`
   already stashes `greenroom:return_to`.)
4. **Optional: request queue.** Hold the 401'd request(s), and after a
   successful renewal replay them so the triggering action completes instead of
   being dropped.

### Phase 2 — true silent renewal, no reload (higher risk, optional)

Goal: renew the token in the background with **no navigation at all**, then make
the dead retry branch in `greenroomFetch` real (retry the original request with
the fresh token).

Options, roughly in order of preference:

- **Hidden iframe + `prompt=none`.** Load the Google auth URL in an invisible
  iframe; the redirect target postMessages the `code` back to the parent, which
  runs the existing server-side exchange. ⚠️ Increasingly fragile under
  third-party-cookie / iframe restrictions — validate early whether Google even
  allows the app's client in an iframe.
- **FedCM / Google Identity Services.** The modern, cookie-independent path, but
  a larger integration and a different token model than the current
  auth-code+PKCE flow — scope carefully before committing.

Make `silentReauth()` resolve `true` on success so `greenroomFetch`'s retry
branch fires; only fall back to the full-page redirect when silent renewal
fails.

## Manual browser-test checklist (author runs these)

To force expiry fast without waiting an hour, temporarily shorten the local
token lifetime (e.g. override `expiryFromIdToken`'s fallback, or set `expiresAt`
to `Date.now() + 60_000` in dev) — remove before shipping.

- [ ] **Repro first:** open a project in Active Projects, type in a field, let
      the token expire, confirm the edit is lost on the redirect (baseline).
- [ ] **Phase 1 idle refresh:** leave the tab idle past expiry with no edits →
      token renews with no visible disruption; API calls keep working.
- [ ] **Phase 1 dirty guard:** have unsaved edits at expiry → edit is saved (or
      you're warned) instead of silently lost.
- [ ] **Phase 1 restore:** if a redirect still happens mid-edit, the field
      content comes back after returning to the view.
- [ ] **Phase 2 (if built):** expire the token, trigger an API call → it
      succeeds with **no page reload** (watch the Network tab: one 401 then an
      immediate retried 200; no navigation).
- [ ] **Failure fallback:** block the silent path (e.g. sign out in another tab)
      → app cleanly falls back to the login screen, no infinite loop.
- [ ] **Regression:** normal fresh login and logout still work.

## Risks & rollback

- This is the **login-critical path** — a bad change can lock users out. Keep
  the existing full-page redirect as the guaranteed fallback throughout.
- Test on localhost against the dev backend first; auth works there.
- Deploy is front+back together per the usual batch; the author deploys.
- Rollback: revert the working-tree changes; nothing here requires a schema or
  backend change if Phase 1 stays frontend-only.
