import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ControlPanelsPrefFormRow } from "./ControlPanelsPrefFormRow";
import { useNotificationsStore } from "@/stores/useNotificationsStore";
import {
  usePushSubscription,
  isIOSDevice,
  isInstalledPWA,
  getVapidPublicKeyDiagnostics,
  type PushActionResult,
  type PushFailureReason,
} from "@/hooks/usePushSubscription";
import {
  useEffectiveGreenroomAccount,
  useIsGreenroomAdmin,
} from "@/hooks/useGreenroomAccount";
import {
  sendTestNotification,
  type NotificationType,
} from "@/lib/api/notifications";

export type NotificationsPaneContentProps = {
  t: (key: string, opts?: Record<string, unknown>) => string;
};

const CP = "apps.control-panels";

// One test button per notification type (admin-only), per NOTIFICATIONS_PLAN.md.
const TEST_TYPES: { type: NotificationType; labelKey: string }[] = [
  { type: "offer_logged", labelKey: `${CP}.notificationsTestOfferLogged` },
  { type: "vote_reminder", labelKey: `${CP}.notificationsTestVoteReminder` },
  { type: "offer_activated", labelKey: `${CP}.notificationsTestOfferActivated` },
  { type: "curation_reminder", labelKey: `${CP}.notificationsTestCurationReminder` },
  { type: "test", labelKey: `${CP}.notificationsTestGeneric` },
];

/**
 * Maps a failed `PushActionResult` to the copy + severity the toggle/button
 * handlers should surface. `action` only matters for the "server" reason,
 * where subscribe vs. unsubscribe leaves the device in a different local
 * state ("on but unconfirmed" vs. "off but unconfirmed"). A "dismissed"
 * permission prompt is reported as a neutral (non-error) toast — the user
 * didn't do anything wrong, they just didn't decide yet.
 */
function getFailureToast(
  t: (key: string, opts?: Record<string, unknown>) => string,
  result: PushActionResult,
  action: "subscribe" | "unsubscribe" | "resubscribe"
): { message: string; isError: boolean } {
  const detailSuffix = result.detail ? ` (${result.detail})` : "";
  switch (result.reason) {
    case "dismissed":
      return {
        message: t(`${CP}.notificationsSubscribeDismissed`),
        isError: false,
      };
    case "denied":
      return {
        message: t(`${CP}.notificationsSubscribeErrorDenied`) + detailSuffix,
        isError: true,
      };
    case "ios-not-installed":
      return {
        message: t(`${CP}.notificationsIOSNotInstalledToast`),
        isError: true,
      };
    case "push-service":
      return {
        message:
          t(`${CP}.notificationsSubscribeErrorPushService`) + detailSuffix,
        isError: true,
      };
    case "server":
      return {
        message:
          (action === "unsubscribe"
            ? t(`${CP}.notificationsUnsubscribeErrorServer`)
            : t(`${CP}.notificationsSubscribeErrorServer`)) + detailSuffix,
        isError: true,
      };
    case "unsupported":
      return { message: t(`${CP}.notificationsUnsupported`), isError: true };
    default:
      return {
        message: t(`${CP}.notificationsSubscribeErrorUnknown`) + detailSuffix,
        isError: true,
      };
  }
}

type LastPushAttempt = {
  action: "subscribe" | "unsubscribe" | "resubscribe";
  ok: boolean;
  reason?: PushFailureReason;
  detail?: string;
};

/**
 * Admin-only troubleshooting snapshot. A user on an installed iOS PWA has
 * no developer console, so when they report "notifications don't work" the
 * only way to see *why* is a block like this they can screenshot or copy.
 * Every probe is independently try/caught — a failure in one (e.g. no
 * `serviceWorker.getRegistration`) must not blank out the others.
 */
async function gatherPushDiagnostics(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  try {
    out.permission =
      typeof Notification !== "undefined" ? Notification.permission : "unavailable";
  } catch {
    out.permission = "error";
  }

  try {
    const missing: string[] = [];
    if (!("serviceWorker" in navigator)) missing.push("serviceWorker");
    if (typeof window === "undefined" || !("PushManager" in window)) {
      missing.push("PushManager");
    }
    if (typeof window === "undefined" || !("Notification" in window)) {
      missing.push("Notification");
    }
    out.supported =
      missing.length === 0 ? "yes" : `no (missing: ${missing.join(", ")})`;
  } catch {
    out.supported = "error";
  }

  try {
    out.iosDetected = isIOSDevice() ? "yes" : "no";
  } catch {
    out.iosDetected = "error";
  }

  try {
    out.installedPWA = isInstalledPWA() ? "yes" : "no";
  } catch {
    out.installedPWA = "error";
  }

  let registration: ServiceWorkerRegistration | null = null;
  try {
    registration =
      "serviceWorker" in navigator
        ? (await navigator.serviceWorker.getRegistration()) ?? null
        : null;
    out.swRegistered = registration ? "yes" : "no";
    out.swActive = registration?.active ? "yes" : "no";
    out.swScope = registration?.scope ?? "n/a";
  } catch {
    out.swRegistered = "error";
    out.swActive = "error";
    out.swScope = "error";
  }

  try {
    const sub = registration ? await registration.pushManager.getSubscription() : null;
    out.hasSubscription = sub ? "yes" : "no";
    if (sub) {
      try {
        out.subscriptionHost = new URL(sub.endpoint).host;
      } catch {
        out.subscriptionHost = "unknown";
      }
    } else {
      out.subscriptionHost = "n/a";
    }
  } catch {
    out.hasSubscription = "error";
    out.subscriptionHost = "error";
  }

  try {
    const info = getVapidPublicKeyDiagnostics();
    out.vapidKey = info.present
      ? `${info.prefix}… (len ${info.length})`
      : "missing";
  } catch {
    out.vapidKey = "error";
  }

  return out;
}

/** Plain-text rendering of the diagnostics block, for the "Copy Diagnostics"
 * button — a user on an installed iOS PWA has no console to screenshot, so
 * they need to be able to paste this into a message instead. */
function formatPushDiagnostics(
  diagnostics: Record<string, string> | null,
  lastAttempt: LastPushAttempt | null
): string {
  if (!diagnostics) return "Push diagnostics: not loaded yet";
  const lines = [
    `permission: ${diagnostics.permission}`,
    `push supported: ${diagnostics.supported}`,
    `iOS device: ${diagnostics.iosDetected}`,
    `installed as app: ${diagnostics.installedPWA}`,
    `service worker registered: ${diagnostics.swRegistered}`,
    `service worker active: ${diagnostics.swActive}`,
    `service worker scope: ${diagnostics.swScope}`,
    `push subscription: ${diagnostics.hasSubscription}`,
    `subscription endpoint: ${diagnostics.subscriptionHost}`,
    `VAPID public key: ${diagnostics.vapidKey}`,
  ];
  if (lastAttempt) {
    lines.push(
      `last ${lastAttempt.action} attempt: ${
        lastAttempt.ok
          ? "succeeded"
          : `failed (${lastAttempt.reason ?? "unknown"}${
              lastAttempt.detail ? ` — ${lastAttempt.detail}` : ""
            })`
      }`
    );
  }
  return lines.join("\n");
}

/**
 * Control Panels pane for the per-user notification center: the master
 * cross-device on/off toggle, this-device push subscription management, and
 * (admin-only) one test-send button per notification type. See
 * NOTIFICATIONS_PLAN.md for the full design — this pane is deliberately
 * simpler than SoundPaneContent's prop-drilled shape since it reads its
 * stores/hooks directly rather than through useControlPanelsLogic.
 */
export function NotificationsPaneContent({ t }: NotificationsPaneContentProps) {
  const { userId } = useEffectiveGreenroomAccount();
  const isAdmin = useIsGreenroomAdmin();
  const notificationsEnabled = useNotificationsStore(
    (s) => s.notificationsEnabled
  );
  const setNotificationsEnabled = useNotificationsStore(
    (s) => s.setNotificationsEnabled
  );
  const fetchNotifications = useNotificationsStore((s) => s.fetch);

  const {
    permission,
    isSubscribed,
    isSupported,
    isIOSNotInstalled,
    subscribe,
    unsubscribe,
    resubscribe,
    refresh,
    isBusy,
  } = usePushSubscription();

  const [pendingTestType, setPendingTestType] = useState<NotificationType | null>(
    null
  );

  // Admin-only troubleshooting aid (see gatherPushDiagnostics above): a user
  // on an installed iOS PWA has no dev console, so this is the only way to
  // see why their subscribe attempt actually failed.
  const [diagnostics, setDiagnostics] = useState<Record<string, string> | null>(
    null
  );
  const [lastAttempt, setLastAttempt] = useState<LastPushAttempt | null>(null);

  const refreshDiagnostics = useCallback(async () => {
    if (!isAdmin) return;
    const result = await gatherPushDiagnostics();
    setDiagnostics(result);
  }, [isAdmin]);

  useEffect(() => {
    refreshDiagnostics();
  }, [refreshDiagnostics]);

  const handleDeviceToggle = async (checked: boolean) => {
    if (checked) {
      const result = await subscribe();
      setLastAttempt({ action: "subscribe", ok: result.ok, reason: result.reason, detail: result.detail });
      if (result.ok) {
        toast.success(t(`${CP}.notificationsSubscribeSuccess`));
      } else {
        const { message, isError } = getFailureToast(t, result, "subscribe");
        if (isError) toast.error(message);
        else toast(message);
      }
    } else {
      const result = await unsubscribe();
      setLastAttempt({ action: "unsubscribe", ok: result.ok, reason: result.reason, detail: result.detail });
      if (result.ok) {
        toast.success(t(`${CP}.notificationsUnsubscribeSuccess`));
      } else {
        const { message, isError } = getFailureToast(t, result, "unsubscribe");
        if (isError) toast.error(message);
        else toast(message);
      }
    }
    refreshDiagnostics();
  };

  const handleResubscribe = async () => {
    const result = await resubscribe();
    setLastAttempt({ action: "resubscribe", ok: result.ok, reason: result.reason, detail: result.detail });
    if (result.ok) {
      toast.success(t(`${CP}.notificationsResubscribeSuccess`));
    } else {
      const { message, isError } = getFailureToast(t, result, "resubscribe");
      if (isError) toast.error(message);
      else toast(message);
    }
    refreshDiagnostics();
  };

  const handleCheckAgain = async () => {
    await refresh();
    await refreshDiagnostics();
  };

  const handleCopyDiagnostics = async () => {
    const text = formatPushDiagnostics(diagnostics, lastAttempt);
    if (!navigator.clipboard?.writeText) {
      toast.error(t(`${CP}.notificationsDiagnosticsCopyUnavailable`));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t(`${CP}.notificationsDiagnosticsCopySuccess`));
    } catch (e) {
      console.error("[NotificationsPaneContent] copy diagnostics failed:", e);
      toast.error(t(`${CP}.notificationsDiagnosticsCopyUnavailable`));
    }
  };

  const handleTestSend = async (type: NotificationType) => {
    setPendingTestType(type);
    try {
      await sendTestNotification(type, userId);
      toast.success(t(`${CP}.notificationsTestSuccess`));
      // Best-effort immediate refresh so the bell badge doesn't wait for the
      // background poller — failures here are non-fatal (poller catches up).
      fetchNotifications(userId).catch(() => {});
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t(`${CP}.notificationsTestError`)
      );
    } finally {
      setPendingTestType(null);
    }
  };

  const isDenied = permission === "denied";
  const deviceControlsDisabled = isBusy || !notificationsEnabled;

  const diagnosticsRows: { label: string; value: string }[] = diagnostics
    ? [
        { label: t(`${CP}.notificationsDiagPermission`), value: diagnostics.permission },
        { label: t(`${CP}.notificationsDiagSupported`), value: diagnostics.supported },
        { label: t(`${CP}.notificationsDiagIOS`), value: diagnostics.iosDetected },
        { label: t(`${CP}.notificationsDiagInstalled`), value: diagnostics.installedPWA },
        {
          label: t(`${CP}.notificationsDiagSwRegistered`),
          value: diagnostics.swRegistered,
        },
        { label: t(`${CP}.notificationsDiagSwActive`), value: diagnostics.swActive },
        { label: t(`${CP}.notificationsDiagSwScope`), value: diagnostics.swScope },
        {
          label: t(`${CP}.notificationsDiagSubscription`),
          value: diagnostics.hasSubscription,
        },
        {
          label: t(`${CP}.notificationsDiagSubscriptionHost`),
          value: diagnostics.subscriptionHost,
        },
        { label: t(`${CP}.notificationsDiagVapid`), value: diagnostics.vapidKey },
        ...(lastAttempt
          ? [
              {
                label: t(`${CP}.notificationsDiagLastAttempt`),
                value: lastAttempt.ok
                  ? t(`${CP}.notificationsDiagLastAttemptOk`)
                  : `${lastAttempt.reason ?? "unknown"}${
                      lastAttempt.detail ? ` — ${lastAttempt.detail}` : ""
                    }`,
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="control-panels-pref-form space-y-0 h-full overflow-y-auto">
      <div className="control-panels-pref-form-section">
        <ControlPanelsPrefFormRow
          label={t(`${CP}.notificationsEnabled`)}
          description={t(`${CP}.notificationsEnabledDescription`)}
        >
          <Switch
            checked={notificationsEnabled}
            onCheckedChange={setNotificationsEnabled}
            className="data-[state=checked]:bg-[#000000]"
          />
        </ControlPanelsPrefFormRow>
      </div>

      <hr className="control-panels-pref-divider" />

      <div
        className={cn(
          "control-panels-pref-form-section",
          !notificationsEnabled && "opacity-50 pointer-events-none"
        )}
      >
        {!isSupported ? (
          <ControlPanelsPrefFormRow label={t(`${CP}.notificationsDevice`)}>
            <span className="control-panels-pref-form-label-desc">
              {t(`${CP}.notificationsUnsupported`)}
            </span>
          </ControlPanelsPrefFormRow>
        ) : isIOSNotInstalled ? (
          <ControlPanelsPrefFormRow label={t(`${CP}.notificationsDevice`)}>
            <span className="control-panels-pref-form-label-desc">
              {t(`${CP}.notificationsIOSNotInstalled`)}
            </span>
          </ControlPanelsPrefFormRow>
        ) : isDenied ? (
          <ControlPanelsPrefFormRow
            label={t(`${CP}.notificationsDevice`)}
            description={t(`${CP}.notificationsDenied`)}
          >
            <Button variant="retro" size="sm" onClick={handleCheckAgain}>
              {t(`${CP}.notificationsCheckAgain`)}
            </Button>
          </ControlPanelsPrefFormRow>
        ) : (
          <>
            <ControlPanelsPrefFormRow
              label={t(`${CP}.notificationsDevice`)}
              description={t(`${CP}.notificationsDeviceDescription`)}
            >
              <Switch
                checked={isSubscribed}
                onCheckedChange={handleDeviceToggle}
                disabled={deviceControlsDisabled}
                className="data-[state=checked]:bg-[#000000]"
              />
            </ControlPanelsPrefFormRow>

            <ControlPanelsPrefFormRow
              label={t(`${CP}.notificationsResubscribe`)}
              description={t(`${CP}.notificationsResubscribeDescription`)}
            >
              <Button
                variant="retro"
                size="sm"
                disabled={deviceControlsDisabled || !isSubscribed}
                onClick={handleResubscribe}
              >
                {t(`${CP}.notificationsResubscribe`)}
              </Button>
            </ControlPanelsPrefFormRow>
          </>
        )}
      </div>

      {isAdmin && (
        <>
          <hr className="control-panels-pref-divider" />
          <div className="control-panels-pref-form-section">
            <ControlPanelsPrefFormRow
              label={t(`${CP}.notificationsTestSection`)}
              description={t(`${CP}.notificationsTestDescription`)}
            >
              <span />
            </ControlPanelsPrefFormRow>
            {TEST_TYPES.map(({ type, labelKey }) => (
              <ControlPanelsPrefFormRow key={type} label={t(labelKey)}>
                <Button
                  variant="retro"
                  size="sm"
                  disabled={pendingTestType !== null}
                  onClick={() => handleTestSend(type)}
                >
                  {pendingTestType === type
                    ? t(`${CP}.notificationsTestSending`)
                    : t(`${CP}.notificationsTestSend`)}
                </Button>
              </ControlPanelsPrefFormRow>
            ))}
          </div>

          <hr className="control-panels-pref-divider" />
          <div className="control-panels-pref-form-section">
            <ControlPanelsPrefFormRow
              label={t(`${CP}.notificationsDiagnostics`)}
              description={t(`${CP}.notificationsDiagnosticsDescription`)}
            >
              <Button variant="retro" size="sm" onClick={handleCopyDiagnostics}>
                {t(`${CP}.notificationsDiagnosticsCopy`)}
              </Button>
            </ControlPanelsPrefFormRow>
            {diagnostics ? (
              diagnosticsRows.map((row) => (
                <ControlPanelsPrefFormRow key={row.label} label={row.label}>
                  <span className="control-panels-pref-form-label-desc break-all text-right">
                    {row.value}
                  </span>
                </ControlPanelsPrefFormRow>
              ))
            ) : (
              <ControlPanelsPrefFormRow label={t(`${CP}.notificationsDiagnostics`)}>
                <span className="control-panels-pref-form-label-desc">
                  {t(`${CP}.notificationsDiagnosticsLoading`)}
                </span>
              </ControlPanelsPrefFormRow>
            )}
          </div>
        </>
      )}
    </div>
  );
}
