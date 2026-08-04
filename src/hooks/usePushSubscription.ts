// Per-device Web Push subscription lifecycle. Ported from
// `C:\Projects\Budgeting` (lib/push/use-push-subscription.ts +
// lib/push/client.ts) and adapted to this repo's Greenroom API client and
// effective-account resolution. The service worker itself is auto-registered
// by vite-plugin-pwa (registerType: "autoUpdate") — this hook only waits for it
// (see `serviceWorkerReady`, which adds the timeout the platform API lacks) and
// drives PushManager + the subscribe/unsubscribe endpoints in
// src/lib/api/notifications.ts.
//
// Consumed by the Notifications Control Panels pane for the this-device push
// toggle. See NOTIFICATIONS_PLAN.md.
//
// subscribe/unsubscribe/resubscribe report their outcome as a structured
// `PushActionResult` instead of swallowing errors — callers need to be able
// to tell a user "notifications are blocked" apart from "iOS requires the
// installed app" apart from "our server rejected the subscription", each of
// which needs different on-screen guidance.

import { useCallback, useEffect, useState } from "react";
import { useEffectiveGreenroomAccount } from "@/hooks/useGreenroomAccount";
import { subscribePush, unsubscribePush } from "@/lib/api/notifications";

/**
 * Why subscribe/unsubscribe/resubscribe failed (or didn't run at all), so
 * the caller can show reason-specific guidance instead of one generic error.
 */
export type PushFailureReason =
  | "unsupported" // browser lacks SW/PushManager/Notification
  | "ios-not-installed" // iOS: web push only works from a Home-Screen-installed PWA
  | "dismissed" // requestPermission() === "default"
  | "denied" // requestPermission() === "denied" (or already denied)
  | "push-service" // pushManager.subscribe() rejected
  | "server" // our subscribe/unsubscribe API call failed
  | "unknown";

export interface PushActionResult {
  ok: boolean;
  reason?: PushFailureReason;
  /** Human-readable detail (error name/message) for surfacing to the user. */
  detail?: string;
}

export interface PushSubscriptionState {
  /** Current Notification API permission, or "loading" while initializing. */
  permission: NotificationPermission | "loading";
  /** Whether this device currently has an active push subscription. */
  isSubscribed: boolean;
  /** Whether the browser supports the APIs this hook needs. */
  isSupported: boolean;
  /**
   * True on iOS/iPadOS when the app is NOT running as an installed
   * (Home-Screen) PWA — iOS only allows web push from an installed app.
   * Exposed so the pane can show this guidance before the user even taps
   * the toggle, not just after a failed attempt.
   */
  isIOSNotInstalled: boolean;
  /** Request permission (if needed) and register a push subscription. */
  subscribe: () => Promise<PushActionResult>;
  /** Cancel the active push subscription, locally and server-side. */
  unsubscribe: () => Promise<PushActionResult>;
  /**
   * Self-heal: tear down any existing (possibly stale) subscription and mint
   * a fresh one. Needed after a platform invalidates a device's push
   * endpoint (most commonly an iOS update) — `getSubscription()` can keep
   * returning a locally-cached endpoint the push service no longer honors.
   */
  resubscribe: () => Promise<PushActionResult>;
  /**
   * Re-reads `Notification.permission` and the current subscription state.
   * Useful for a "Check again" button after the user changes the site's
   * notification permission in their browser settings.
   */
  refresh: () => Promise<void>;
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

// `navigator.serviceWorker.ready` NEVER rejects — if no service worker is
// registered for this scope it just hangs forever. Awaiting it bare would leave
// the toggle stuck in its busy state with no feedback (the exact failure mode
// that is hardest to diagnose on an installed iOS PWA, where there's no
// console). Race it against a timeout so a missing SW becomes a real, reported
// failure instead of silence.
const SERVICE_WORKER_READY_TIMEOUT_MS = 10_000;

class ServiceWorkerNotReadyError extends Error {
  constructor() {
    super(
      `No active service worker after ${
        SERVICE_WORKER_READY_TIMEOUT_MS / 1000
      }s — try reloading the app`
    );
    this.name = "ServiceWorkerNotReadyError";
  }
}

async function serviceWorkerReady(): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ServiceWorkerNotReadyError()),
          SERVICE_WORKER_READY_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iOS/iPadOS detection, including iPadOS masquerading as desktop Safari
 * ("MacIntel" platform but with touch points, unlike a real Mac). Exported
 * for the pane's admin-only diagnostics block. */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const iOSByUserAgent = /iP(hone|ad|od)/.test(navigator.userAgent);
  const iPadOSAsMac =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSByUserAgent || iPadOSAsMac;
}

/** Whether the app is currently running as an installed (Home-Screen /
 * standalone) PWA rather than a regular browser tab. Exported for the
 * pane's admin-only diagnostics block. */
export function isInstalledPWA(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneMedia = window.matchMedia?.(
    "(display-mode: standalone)"
  ).matches;
  const iosStandalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(standaloneMedia || iosStandalone);
}

/** iOS only permits web push from a Home-Screen-installed PWA (iOS 16.4+) —
 * this is the single most likely cause of a silent failure on iPhone. */
function isIOSNotInstalledPWA(): boolean {
  return isIOSDevice() && !isInstalledPWA();
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

/** Returns the VAPID public key, or null if VITE_VAPID_PUBLIC_KEY isn't set
 * — callers turn that into a structured `PushActionResult` rather than
 * letting an unexplained throw surface to the user. */
function getVapidPublicKey(): string | null {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  return key || null;
}

/** Non-sensitive summary of the baked-in VAPID public key, for display in
 * the admin diagnostics block — never the full key. */
export function getVapidPublicKeyDiagnostics(): {
  present: boolean;
  prefix: string;
  length: number;
} {
  const key = getVapidPublicKey();
  if (!key) return { present: false, prefix: "", length: 0 };
  return { present: true, prefix: key.slice(0, 12), length: key.length };
}

function describeError(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

/** True if a pushManager.subscribe() rejection indicates the existing
 * subscription (if any) was created with a different applicationServerKey
 * than the one we're using now — the caller should tear it down and retry. */
function isApplicationServerKeyMismatch(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === "InvalidStateError" || /applicationServerKey/i.test(e.message);
}

export function usePushSubscription(): PushSubscriptionState {
  const { userId } = useEffectiveGreenroomAccount();
  const isSupported = isPushSupported();

  const [permission, setPermission] = useState<
    NotificationPermission | "loading"
  >(isSupported ? "loading" : "denied");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isIOSNotInstalled, setIsIOSNotInstalled] = useState(
    isIOSNotInstalledPWA()
  );

  // Initial state + silent backfill: if this device already has a
  // subscription and we know who the effective user is, re-upsert it so the
  // server row always has the current user_id (handles a device that
  // subscribed before sign-in, or a stale user_id after switching accounts).
  useEffect(() => {
    if (!isSupported) return;
    setPermission(Notification.permission);

    // Self-healing registration, mirroring the reference implementation in the
    // Budgeting project (lib/push/use-push-subscription.ts), which registers on
    // every mount rather than trusting the PWA plugin alone. We otherwise rely
    // entirely on vite-plugin-pwa's injected registerSW.js, which fires ONCE per
    // full page load — and index.html's stale-bundle recovery path calls
    // `reg.unregister()` (its detector matches WebKit-specific module-load
    // errors, so iOS is the most likely place it trips). If that happens and the
    // follow-up reload doesn't cleanly re-register, nothing ever does, and
    // `serviceWorker.ready` hangs forever — push could never be set up again on
    // that device. Re-registering here is idempotent: the same URL + scope
    // resolves to the existing registration. Dev is skipped because
    // vite-plugin-pwa serves its dev worker under a different path.
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => {
        console.error("[usePushSubscription] SW re-registration failed:", e);
      });
    }

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

  // Live permission tracking: keep `permission` fresh if the user flips the
  // site's notification permission in their browser settings while this
  // pane is mounted, without requiring a reload. `permissions.query` isn't
  // available in every browser (notably some Safari versions), so this is
  // best-effort — `refresh()` below covers the rest.
  useEffect(() => {
    if (!isSupported) return;
    if (!navigator.permissions?.query) return;

    let cancelled = false;
    let status: PermissionStatus | null = null;
    const handleChange = () => {
      if (!cancelled) setPermission(Notification.permission);
    };

    navigator.permissions
      .query({ name: "notifications" as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        status.addEventListener("change", handleChange);
      })
      .catch(() => {
        // Unsupported here — permission state still works, it just won't
        // live-update on external site-settings changes.
      });

    return () => {
      cancelled = true;
      status?.removeEventListener("change", handleChange);
    };
  }, [isSupported]);

  // Track display-mode in case the user installs the PWA (or launches it
  // from the Home Screen) while this pane happens to be open.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(display-mode: standalone)");
    const handleChange = () => setIsIOSNotInstalled(isIOSNotInstalledPWA());
    mq.addEventListener?.("change", handleChange);
    return () => mq.removeEventListener?.("change", handleChange);
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (!isSupported) return;
    setPermission(Notification.permission);
    setIsIOSNotInstalled(isIOSNotInstalledPWA());
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(sub !== null);
    } catch (e) {
      console.error("[usePushSubscription] refresh failed:", e);
      setIsSubscribed(false);
    }
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<PushActionResult> => {
    if (!isSupported) return { ok: false, reason: "unsupported" };
    if (isIOSNotInstalledPWA()) {
      return { ok: false, reason: "ios-not-installed" };
    }

    setIsBusy(true);
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult === "denied") {
        return { ok: false, reason: "denied" };
      }
      if (permissionResult === "default") {
        return { ok: false, reason: "dismissed" };
      }

      const vapidKey = getVapidPublicKey();
      if (!vapidKey) {
        const detail = "VITE_VAPID_PUBLIC_KEY is not set";
        console.error("[usePushSubscription] subscribe failed:", detail);
        return { ok: false, reason: "unknown", detail };
      }

      const reg = await serviceWorkerReady();
      let sub: PushSubscription;
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      } catch (e) {
        console.error("[usePushSubscription] subscribe failed:", e);
        if (!isApplicationServerKeyMismatch(e)) {
          return { ok: false, reason: "push-service", detail: describeError(e) };
        }
        // Auto self-heal: an existing subscription was created with a
        // different applicationServerKey — tear it down and retry once.
        try {
          const existing = await reg.pushManager.getSubscription();
          if (existing) await existing.unsubscribe();
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        } catch (retryError) {
          console.error(
            "[usePushSubscription] subscribe retry after key mismatch failed:",
            retryError
          );
          return {
            ok: false,
            reason: "push-service",
            detail: describeError(retryError),
          };
        }
      }

      try {
        await subscribePush(subscriptionToPayload(sub), userId);
      } catch (e) {
        console.error("[usePushSubscription] subscribe (server) failed:", e);
        // The browser subscription exists even though the server doesn't
        // know about it yet — leave it in place (the mount-time backfill
        // effect will re-upsert it on a future load) but still report the
        // failure so the user knows something's wrong now.
        setIsSubscribed(true);
        return { ok: false, reason: "server", detail: describeError(e) };
      }

      setIsSubscribed(true);
      return { ok: true };
    } catch (e) {
      // Contract: these actions REPORT failure, never throw — the caller
      // renders the reason and has no catch of its own.
      console.error("[usePushSubscription] unexpected failure:", e);
      return { ok: false, reason: "unknown", detail: describeError(e) };
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, userId]);

  const unsubscribe = useCallback(async (): Promise<PushActionResult> => {
    if (!isSupported) return { ok: false, reason: "unsupported" };
    setIsBusy(true);
    try {
      const reg = await serviceWorkerReady();
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setIsSubscribed(false);
        return { ok: true };
      }

      const endpoint = sub.endpoint;
      try {
        await sub.unsubscribe();
      } catch (e) {
        console.error("[usePushSubscription] unsubscribe failed:", e);
        return { ok: false, reason: "push-service", detail: describeError(e) };
      }

      try {
        await unsubscribePush(endpoint, userId);
      } catch (e) {
        console.error("[usePushSubscription] unsubscribe (server) failed:", e);
        // The browser-side unsubscribe succeeded even though telling the
        // server about it failed — reflect the local (now unsubscribed)
        // state but still report the failure.
        setIsSubscribed(false);
        return { ok: false, reason: "server", detail: describeError(e) };
      }

      setIsSubscribed(false);
      return { ok: true };
    } catch (e) {
      // Contract: these actions REPORT failure, never throw — the caller
      // renders the reason and has no catch of its own.
      console.error("[usePushSubscription] unexpected failure:", e);
      return { ok: false, reason: "unknown", detail: describeError(e) };
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, userId]);

  const resubscribe = useCallback(async (): Promise<PushActionResult> => {
    if (!isSupported) return { ok: false, reason: "unsupported" };
    if (isIOSNotInstalledPWA()) {
      return { ok: false, reason: "ios-not-installed" };
    }

    setIsBusy(true);
    try {
      const vapidKey = getVapidPublicKey();
      if (!vapidKey) {
        const detail = "VITE_VAPID_PUBLIC_KEY is not set";
        console.error("[usePushSubscription] resubscribe failed:", detail);
        return { ok: false, reason: "unknown", detail };
      }

      const reg = await serviceWorkerReady();

      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        try {
          await existing.unsubscribe();
        } catch {
          // Non-fatal — subscribe() below still attempts to replace it.
        }
      }

      let sub: PushSubscription;
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      } catch (e) {
        console.error("[usePushSubscription] resubscribe failed:", e);
        return { ok: false, reason: "push-service", detail: describeError(e) };
      }

      try {
        await subscribePush(subscriptionToPayload(sub), userId);
      } catch (e) {
        console.error("[usePushSubscription] resubscribe (server) failed:", e);
        setIsSubscribed(true);
        setPermission("granted");
        return { ok: false, reason: "server", detail: describeError(e) };
      }

      setIsSubscribed(true);
      setPermission("granted");
      return { ok: true };
    } catch (e) {
      // Contract: these actions REPORT failure, never throw — the caller
      // renders the reason and has no catch of its own.
      console.error("[usePushSubscription] unexpected failure:", e);
      return { ok: false, reason: "unknown", detail: describeError(e) };
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, userId]);

  return {
    permission,
    isSubscribed,
    isSupported,
    isIOSNotInstalled,
    subscribe,
    unsubscribe,
    resubscribe,
    refresh,
    isBusy,
  };
}
