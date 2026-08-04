// Keeps the per-user notification center fresh in the background — poll +
// focus refetch, mirroring InboxBadgeSync's cadence
// (src/apps/incoming-offers/hooks/useInboxBadge.ts) — and surfaces newly
// arrived unread notifications as toasts while the app is open. Also listens
// for `greenroom:notification-click` postMessages from the push service
// worker (public/push-sw.js) and routes them through the same deep-link
// resolver AppManager uses for `/open/...` URLs at boot.
//
// Mount exactly once in the always-rendered app shell (AppManager.tsx),
// alongside <InboxBadgeSync />. See NOTIFICATIONS_PLAN.md.

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useEffectiveGreenroomAccount } from "@/hooks/useGreenroomAccount";
import { useNotificationsStore } from "@/stores/useNotificationsStore";
import { parseOpenPath, resolveOpenLink } from "@/utils/deepLinks";
import type { GreenroomNotification } from "@/lib/api/notifications";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const FOCUS_REFETCH_THROTTLE_MS = 30 * 1000;
const MAX_TOASTS_PER_FETCH = 3;

/**
 * Resolves a notification's `link` (an `/open/{kind}/{id}` app path, possibly
 * absolute) the same way AppManager resolves a shared deep link on boot, then
 * dispatches the standard `launchApp` CustomEvent every app listens for.
 * Exported so the menu-bar/taskbar notification bell panel
 * (MenuBarNotifications.tsx) can reuse the exact same resolution logic
 * instead of duplicating it.
 */
export function openNotificationLink(link: string): void {
  const path = (() => {
    try {
      return new URL(link, window.location.origin).pathname;
    } catch {
      return link;
    }
  })();

  const parsed = parseOpenPath(path);
  if (!parsed) return;

  resolveOpenLink(parsed.kind, parsed.id)
    .then(({ appId, initialData }) => {
      window.dispatchEvent(
        new CustomEvent("launchApp", { detail: { appId, initialData } })
      );
    })
    .catch((error) => {
      toast.error(
        error instanceof Error ? error.message : "Couldn't open the link"
      );
    });
}

function toastForNotification(n: GreenroomNotification): void {
  toast(n.title, {
    description: n.body || undefined,
    action: n.link
      ? { label: "Open", onClick: () => openNotificationLink(n.link!) }
      : undefined,
  });
}

export function NotificationsSync(): null {
  const { userId } = useEffectiveGreenroomAccount();
  const notificationsEnabled = useNotificationsStore(
    (s) => s.notificationsEnabled
  );
  const fetchNotificationsAction = useNotificationsStore((s) => s.fetch);

  const lastFetchRef = useRef<number>(0);
  // Newest `created_at` we've already considered — a poll only toasts
  // arrivals strictly newer than this, and it's never populated until after
  // the first fetch, so the existing unread backlog is never toasted in bulk
  // on mount.
  const lastSeenCreatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !notificationsEnabled) return;

    const load = async () => {
      lastFetchRef.current = Date.now();
      const watermark = lastSeenCreatedAtRef.current;

      await fetchNotificationsAction(userId).catch((err) => {
        console.error("[NotificationsSync] Failed to fetch notifications:", err);
      });

      const notifications = useNotificationsStore.getState().notifications;
      if (watermark) {
        const fresh = notifications.filter(
          (n) => !n.read_at && n.created_at > watermark
        );
        fresh.slice(0, MAX_TOASTS_PER_FETCH).forEach(toastForNotification);
      }

      const newest = notifications[0]?.created_at;
      if (newest && (!watermark || newest > watermark)) {
        lastSeenCreatedAtRef.current = newest;
      } else if (!newest && !watermark) {
        // Empty list on first fetch: there IS no backlog, so anything that
        // arrives later deserves a toast. Without this, the watermark stays
        // null (it's only ever set from an item's created_at) and the user's
        // very first notification would slip through silently.
        lastSeenCreatedAtRef.current = "1970-01-01T00:00:00Z";
      }
    };

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);

    const handleFocus = () => {
      if (Date.now() - lastFetchRef.current < FOCUS_REFETCH_THROTTLE_MS) return;
      load();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [userId, notificationsEnabled, fetchNotificationsAction]);

  // SW -> page bridge: notificationclick posts {type, url}; route it through
  // the same resolver AppManager uses for `/open/...` deep links on boot.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | undefined;
      if (data?.type === "greenroom:notification-click" && data.url) {
        openNotificationLink(data.url);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);

  return null;
}
