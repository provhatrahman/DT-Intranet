// Wires account-tied UI-settings sync into the React lifecycle. Mounted once in
// App.tsx (above the boot/auth early returns so it runs in every render path).
// Dormant unless AUTH_ENABLED + a logged-in user — a clean no-op otherwise.
//
//   Effect A — pull once per authenticated session (covers both "already authed
//     at boot" and the login transition).
//   Effect B — subscribe to the three styling stores and push (debounced) on
//     change, skipping changes caused by a remote apply.
//   Effect C — tear down sync state on logout (local styling is left intact).

import { useEffect, useRef } from "react";
import { AUTH_ENABLED } from "@/config/auth";
import { useAuthStore } from "@/stores/useAuthStore";
import { useEffectiveGreenroomAccount } from "@/hooks/useGreenroomAccount";
import { useSettingsSyncStore } from "@/stores/useSettingsSyncStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { useDockStore } from "@/stores/useDockStore";
import { useDisplaySettingsStore } from "@/stores/useDisplaySettingsStore";
import { useNotificationsStore } from "@/stores/useNotificationsStore";
import {
  SETTINGS_SYNC_DEBOUNCE_MS,
  SETTINGS_SYNC_MAX_WAIT_MS,
} from "@/config/settingsSync";

export function useSettingsSync() {
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const authExpiresAt = useAuthStore((s) => s.expiresAt);
  const { realUserId } = useEffectiveGreenroomAccount();

  const isAuthed =
    AUTH_ENABLED &&
    authStatus === "authenticated" &&
    !!authUser &&
    (!authExpiresAt || Date.now() < authExpiresAt);

  // One pull per authenticated session; reset when auth drops.
  const pulledRef = useRef(false);

  // Effect A — pull.
  useEffect(() => {
    if (!isAuthed) {
      pulledRef.current = false;
      return;
    }
    if (pulledRef.current) return;
    pulledRef.current = true;
    void useSettingsSyncStore.getState().pull(realUserId);
  }, [isAuthed, realUserId]);

  // Effect B — debounced push on any styling change.
  useEffect(() => {
    if (!isAuthed) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let maxTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (maxTimer) {
        clearTimeout(maxTimer);
        maxTimer = null;
      }
      void useSettingsSyncStore.getState().push(realUserId);
    };

    const schedule = () => {
      // Skip changes caused by applying a remote snapshot.
      if (useSettingsSyncStore.getState().isApplyingRemote) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, SETTINGS_SYNC_DEBOUNCE_MS);
      // Cap how long a continuous change stream can defer the push.
      if (!maxTimer) maxTimer = setTimeout(flush, SETTINGS_SYNC_MAX_WAIT_MS);
    };

    const unsubscribes = [
      useThemeStore.subscribe(schedule),
      useDockStore.subscribe(schedule),
      useDisplaySettingsStore.subscribe(schedule),
      useNotificationsStore.subscribe(schedule),
    ];

    return () => {
      unsubscribes.forEach((u) => u());
      if (timer) clearTimeout(timer);
      if (maxTimer) clearTimeout(maxTimer);
    };
  }, [isAuthed, realUserId]);

  // Effect C — logout / not-authed cleanup. Leaves local styling untouched.
  useEffect(() => {
    if (isAuthed) return;
    useSettingsSyncStore.getState().reset();
  }, [isAuthed]);
}
