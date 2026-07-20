import { DIRTY_STASH_KEY } from "@/config/auth";

// Dirty-work stash: preserves unsaved in-app edits across the full-page
// token-renewal redirect (silentReauth's prompt=none round-trip to Google).
//
// The token-expiry 401 arrives when the token is ALREADY dead, so flushing a
// pending save before redirecting can't work — the flush would 401 too.
// Instead, apps with unsaved state register a snapshot provider here; right
// before the redirect, useAuthStore.silentReauth() calls
// captureDirtyToSession() to write every dirty snapshot to sessionStorage
// (sibling to greenroom:return_to), and each app consumes its own entry after
// the callback lands back in the app, letting its normal autosave re-persist
// with the fresh token.
//
// Deliberately a plain module (no store, no React): it must be callable
// synchronously from the auth store, a beforeunload listener, and components
// alike, and the data belongs in tab-scoped sessionStorage, not app state.
// This module must not import from stores or app components.

export interface StashEntry {
  /** Full stash key including scope, e.g. "active-project-form:42". */
  key: string;
  /** The provider kind, e.g. "active-project-form". */
  kind: string;
  /** The raw snapshot; restored verbatim by the owning app. */
  data: unknown;
}

/** Returns the current unsaved snapshot, or null when clean. */
export type DirtyProvider = () => StashEntry | null;

interface StashPayload {
  savedAt: number; // ms epoch, staleness guard
  entries: Record<string, { kind: string; data: unknown }>;
}

// Discard stashes older than this on read. A real renewal round-trips through
// Google in seconds; anything older means the silent path failed (e.g.
// login_required) and the user came back much later — don't resurrect
// abandoned edits over what's now on the server.
const STALE_MS = 10 * 60_000;

const providers = new Map<string, DirtyProvider>();

/**
 * Register a snapshot provider for a dirty-able surface. One registration per
 * providerId (a later registration replaces the earlier — fine for
 * single-instance views). Returns an unregister fn for effect cleanup.
 */
export function registerDirtyProvider(
  providerId: string,
  provider: DirtyProvider
): () => void {
  providers.set(providerId, provider);
  return () => {
    // Only remove if we're still the registered provider (a remount may have
    // re-registered before the old cleanup ran).
    if (providers.get(providerId) === provider) {
      providers.delete(providerId);
    }
  };
}

/** True if any registered surface currently has unsaved edits. */
export function hasDirty(): boolean {
  for (const provider of providers.values()) {
    try {
      if (provider() !== null) return true;
    } catch {
      // A broken provider must never block the caller (e.g. proactive renew).
    }
  }
  return false;
}

/**
 * Snapshot every dirty surface into sessionStorage. Fully synchronous and
 * swallows all errors — it runs in the last instants before a full-page
 * navigation (silentReauth / beforeunload) and must never block it. Writes
 * nothing when everything is clean.
 */
export function captureDirtyToSession(): void {
  try {
    const entries: StashPayload["entries"] = {};
    let count = 0;
    for (const provider of providers.values()) {
      try {
        const entry = provider();
        if (entry) {
          entries[entry.key] = { kind: entry.kind, data: entry.data };
          count++;
        }
      } catch {
        // Skip a broken provider; capture the rest.
      }
    }
    if (count === 0) return;
    sessionStorage.setItem(
      DIRTY_STASH_KEY,
      JSON.stringify({ savedAt: Date.now(), entries } satisfies StashPayload)
    );
  } catch {
    // Quota/serialization failure: worst case is today's behavior (edits lost).
  }
}

/**
 * Take one entry's snapshot out of the stash (or null if absent/stale). The
 * read is destructive so a restored snapshot can't be re-applied later; the
 * rest of the stash is kept for other surfaces.
 */
export function consumeEntry(key: string): unknown | null {
  try {
    const raw = sessionStorage.getItem(DIRTY_STASH_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as StashPayload;
    if (
      !payload ||
      typeof payload.savedAt !== "number" ||
      !payload.entries ||
      Date.now() - payload.savedAt > STALE_MS
    ) {
      sessionStorage.removeItem(DIRTY_STASH_KEY);
      return null;
    }
    const entry = payload.entries[key];
    if (!entry) return null;
    delete payload.entries[key];
    if (Object.keys(payload.entries).length === 0) {
      sessionStorage.removeItem(DIRTY_STASH_KEY);
    } else {
      sessionStorage.setItem(DIRTY_STASH_KEY, JSON.stringify(payload));
    }
    return entry.data;
  } catch {
    return null;
  }
}

/** Drop the whole stash (on logout — never resurrect another session's edits). */
export function clearDirtyStash(): void {
  try {
    sessionStorage.removeItem(DIRTY_STASH_KEY);
  } catch {
    // sessionStorage unavailable — nothing to clear.
  }
}
