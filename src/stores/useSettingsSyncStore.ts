// Non-persisted store that drives account-tied UI-settings sync. It owns the
// pull (login → adopt account settings) and push (debounced local change →
// account) actions plus the guards that stop an apply from bouncing back as a
// push. The React wiring (when to pull/push, subscriptions, debounce) lives in
// src/hooks/useSettingsSync.ts; this store holds the logic + state.

import { create } from "zustand";
import { getUserSettings, putUserSettings } from "@/lib/api/settings";
import {
  applyStylingSettings,
  collectStylingSettings,
  stripVolatile,
  type StylingSnapshot,
} from "@/utils/stylingSnapshot";
import { SETTINGS_CONFLICT_STRATEGY } from "@/config/settingsSync";

type SyncStatus = "idle" | "pulling" | "pushing" | "error";

interface SettingsSyncState {
  status: SyncStatus;
  isSyncing: boolean;
  /** True once the initial pull has landed — pushes are blocked until then. */
  hasPulled: boolean;
  /** True while applying a remote snapshot, so change listeners don't push it back. */
  isApplyingRemote: boolean;
  lastSyncedAt: number | null;
  /** The last snapshot we know matches the server (baseline for the echo diff). */
  lastSyncedSnapshot: StylingSnapshot | null;
  error: string | null;
  pull: (userId?: number | null) => Promise<void>;
  push: (userId?: number | null) => Promise<void>;
  reset: () => void;
}

// Module-scoped so only one push is ever in flight; a newer push aborts it.
let inFlightPush: AbortController | null = null;

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const useSettingsSyncStore = create<SettingsSyncState>((set, get) => ({
  status: "idle",
  isSyncing: false,
  hasPulled: false,
  isApplyingRemote: false,
  lastSyncedAt: null,
  lastSyncedSnapshot: null,
  error: null,

  pull: async (userId) => {
    if (get().status === "pulling") return;
    set({ status: "pulling", isSyncing: true, error: null });
    try {
      const server = await getUserSettings(userId);

      const seedFromLocal = async () => {
        const local = collectStylingSettings();
        await putUserSettings(local, userId);
        set({ lastSyncedSnapshot: local });
      };

      if (!server) {
        // No account row yet → seed it from this device (all strategies).
        await seedFromLocal();
      } else if (SETTINGS_CONFLICT_STRATEGY === "local-wins") {
        await seedFromLocal();
      } else {
        // server-wins (default) or last-write-wins.
        let applyServer = true;
        if (SETTINGS_CONFLICT_STRATEGY === "last-write-wins") {
          const local = collectStylingSettings();
          applyServer = !(
            local.updatedAt &&
            server.updatedAt &&
            local.updatedAt > server.updatedAt
          );
        }
        if (applyServer) {
          set({ isApplyingRemote: true });
          try {
            await applyStylingSettings(server);
          } finally {
            // Clear one microtask later so any trailing synchronous store
            // notification from the apply is still suppressed.
            queueMicrotask(() => set({ isApplyingRemote: false }));
          }
          // Baseline = the post-apply local state (exact echo target).
          set({ lastSyncedSnapshot: collectStylingSettings() });
        } else {
          await seedFromLocal();
        }
      }

      set({
        hasPulled: true,
        lastSyncedAt: Date.now(),
        status: "idle",
        isSyncing: false,
      });
    } catch (e) {
      set({
        status: "error",
        isSyncing: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  push: async (userId) => {
    const state = get();
    if (!state.hasPulled) return; // ordering: never push before the first pull
    if (state.isApplyingRemote) return; // don't push a remote apply back

    const snap = collectStylingSettings();
    if (
      state.lastSyncedSnapshot &&
      deepEqual(stripVolatile(snap), stripVolatile(state.lastSyncedSnapshot))
    ) {
      return; // nothing meaningful changed (echo backstop)
    }

    if (inFlightPush) inFlightPush.abort();
    const controller = new AbortController();
    inFlightPush = controller;

    set({ status: "pushing", isSyncing: true, error: null });
    try {
      await putUserSettings(snap, userId, controller.signal);
      if (controller.signal.aborted) return;
      set({
        lastSyncedSnapshot: snap,
        lastSyncedAt: Date.now(),
        status: "idle",
        isSyncing: false,
      });
    } catch (e) {
      if (
        controller.signal.aborted ||
        (e instanceof DOMException && e.name === "AbortError")
      ) {
        return;
      }
      // Leave lastSyncedSnapshot stale so the change stays "dirty" and retries
      // on the next store change.
      set({
        status: "error",
        isSyncing: false,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      if (inFlightPush === controller) inFlightPush = null;
    }
  },

  reset: () => {
    if (inFlightPush) {
      inFlightPush.abort();
      inFlightPush = null;
    }
    set({
      status: "idle",
      isSyncing: false,
      hasPulled: false,
      isApplyingRemote: false,
      lastSyncedAt: null,
      lastSyncedSnapshot: null,
      error: null,
    });
  },
}));
