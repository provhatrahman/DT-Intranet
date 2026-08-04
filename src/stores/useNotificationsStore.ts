// Per-user notification center store: the list + unread count backing the
// (future) menu-bar bell and Control Panels pane, plus the master on/off
// toggle synced across devices via the account settings blob (see
// src/utils/stylingSnapshot.ts `notifications.enabled` and
// src/hooks/useSettingsSync.ts). See NOTIFICATIONS_PLAN.md for the full
// design.
//
// `notificationsEnabled` is the only field persisted locally — the
// notification list itself is small and server-fetched every session (by
// NotificationsSync, mirroring InboxBadgeSync's cadence), so there's no
// benefit to caching it in localStorage and it would only go stale.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  fetchNotifications,
  markNotificationsRead,
  type GreenroomNotification,
} from "@/lib/api/notifications";

interface NotificationsState {
  notifications: GreenroomNotification[];
  unreadCount: number;
  lastFetchedAt: number | null;
  isLoading: boolean;
  /** Master on/off toggle. Default ON when absent, per the plan. */
  notificationsEnabled: boolean;

  /** Fetch the current user's notifications + unread count. */
  fetch: (userId?: number | null) => Promise<void>;
  /** Mark specific ids, or all, as read — optimistic with rollback on failure. */
  markRead: (ids: number[] | "all", userId?: number | null) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => void;
  /** Clear transient (server-derived) state; leaves notificationsEnabled intact. */
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      lastFetchedAt: null,
      isLoading: false,
      notificationsEnabled: true,

      fetch: async (userId) => {
        if (get().isLoading) return;
        set({ isLoading: true });
        try {
          const { notifications, unreadCount } = await fetchNotifications(userId);
          set({
            notifications,
            unreadCount,
            lastFetchedAt: Date.now(),
            isLoading: false,
          });
        } catch (e) {
          console.error("[useNotificationsStore] fetch failed:", e);
          set({ isLoading: false });
        }
      },

      markRead: async (ids, userId) => {
        const previousNotifications = get().notifications;
        const previousUnreadCount = get().unreadCount;
        const now = new Date().toISOString();

        const nextNotifications =
          ids === "all"
            ? previousNotifications.map((n) =>
                n.read_at ? n : { ...n, read_at: now }
              )
            : previousNotifications.map((n) =>
                ids.includes(n.id) && !n.read_at ? { ...n, read_at: now } : n
              );
        const nextUnreadCount = nextNotifications.filter(
          (n) => !n.read_at
        ).length;

        set({ notifications: nextNotifications, unreadCount: nextUnreadCount });

        try {
          await markNotificationsRead(ids, userId);
        } catch (e) {
          console.error("[useNotificationsStore] markRead failed:", e);
          // Roll back the optimistic update on failure.
          set({
            notifications: previousNotifications,
            unreadCount: previousUnreadCount,
          });
        }
      },

      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),

      reset: () =>
        set({
          notifications: [],
          unreadCount: 0,
          lastFetchedAt: null,
          isLoading: false,
        }),
    }),
    {
      name: "ryos:notifications",
      partialize: (state) => ({
        notificationsEnabled: state.notificationsEnabled,
      }),
    }
  )
);
