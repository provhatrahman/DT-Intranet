// Per-device Web Push subscription lifecycle. Ported from
// `C:\Projects\Budgeting` (lib/push/use-push-subscription.ts +
// lib/push/client.ts) and adapted to this repo's Greenroom API client and
// effective-account resolution. The service worker itself is auto-registered
// by vite-plugin-pwa (registerType: "autoUpdate") — this hook only waits on
// `navigator.serviceWorker.ready` and drives PushManager + the
// subscribe/unsubscribe endpoints in src/lib/api/notifications.ts.
//
// Consumed by the (future) Notifications Control Panels pane for the
// this-device push toggle. See NOTIFICATIONS_PLAN.md.

import { useCallback, useEffect, useState } from "react";
import { useEffectiveGreenroomAccount } from "@/hooks/useGreenroomAccount";
import { subscribePush, unsubscribePush } from "@/lib/api/notifications";

export interface PushSubscriptionState {
  /** Current Notification API permission, or "loading" while initializing. */
  permission: NotificationPermission | "loading";
  /** Whether this device currently has an active push subscription. */
  isSubscribed: boolean;
  /** Whether the browser supports the APIs this hook needs. */
  isSupported: boolean;
  /** Request permission (if needed) and register a push subscription. */
  subscribe: () => Promise<void>;
  /** Cancel the active push subscription, locally and server-side. */
  unsubscribe: () => Promise<void>;
  /**
   * Self-heal: tear down any existing (possibly stale) subscription and mint
   * a fresh one. Needed after a platform invalidates a device's push
   * endpoint (most commonly an iOS update) — `getSubscription()` can keep
   * returning a locally-cached endpoint the push service no longer honors.
   */
  resubscribe: () => Promise<void>;
  /** True while subscribe/unsubscribe/resubscribe is in flight. */
  isBusy: boolean;
}

/** Converts a URL-safe base64 string to a Uint8Array for applicationServerKey. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function subscriptionToPayload(sub: PushSubscription) {
  const { endpoint, keys } = sub.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  return {
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    user_agent:
      typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };
}

function getVapidPublicKey(): string {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!key) throw new Error("VITE_VAPID_PUBLIC_KEY is not set");
  return key;
}

export function usePushSubscription(): PushSubscriptionState {
  const { userId } = useEffectiveGreenroomAccount();
  const isSupported = isPushSupported();

  const [permission, setPermission] = useState<
    NotificationPermission | "loading"
  >(isSupported ? "loading" : "denied");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Initial state + silent backfill: if this device already has a
  // subscription and we know who the effective user is, re-upsert it so the
  // server row always has the current user_id (handles a device that
  // subscribed before sign-in, or a stale user_id after switching accounts).
  useEffect(() => {
    if (!isSupported) return;
    setPermission(Notification.permission);
    if (!userId) return;

    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (cancelled) return;
        setIsSubscribed(sub !== null);
        if (!sub) return undefined;
        return subscribePush(subscriptionToPayload(sub), userId).catch((e) => {
          console.error("[usePushSubscription] backfill upsert failed:", e);
        });
      })
      .catch(() => {
        if (!cancelled) setIsSubscribed(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSupported, userId]);

  const subscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) return;
    setIsBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(getVapidPublicKey()),
      });

      await subscribePush(subscriptionToPayload(sub), userId);
      setIsSubscribed(true);
    } catch (e) {
      console.error("[usePushSubscription] subscribe failed:", e);
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, userId]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) return;
    setIsBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setIsSubscribed(false);
        return;
      }
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await unsubscribePush(endpoint, userId);
      setIsSubscribed(false);
    } catch (e) {
      console.error("[usePushSubscription] unsubscribe failed:", e);
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, userId]);

  const resubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) return;
    setIsBusy(true);
    try {
      const vapidKey = getVapidPublicKey();
      const reg = await navigator.serviceWorker.ready;

      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        try {
          await existing.unsubscribe();
        } catch {
          // Non-fatal — subscribe() below still attempts to replace it.
        }
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await subscribePush(subscriptionToPayload(sub), userId);
      setIsSubscribed(true);
      setPermission("granted");
    } catch (e) {
      console.error("[usePushSubscription] resubscribe failed:", e);
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, userId]);

  return {
    permission,
    isSubscribed,
    isSupported,
    subscribe,
    unsubscribe,
    resubscribe,
    isBusy,
  };
}
