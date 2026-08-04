import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ControlPanelsPrefFormRow } from "./ControlPanelsPrefFormRow";
import { useNotificationsStore } from "@/stores/useNotificationsStore";
import { usePushSubscription } from "@/hooks/usePushSubscription";
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
    subscribe,
    unsubscribe,
    resubscribe,
    isBusy,
  } = usePushSubscription();

  // usePushSubscription's subscribe/unsubscribe/resubscribe swallow their own
  // errors (console.error only) and report success purely through the state
  // they update. The closure created for a click handler captures this
  // render's `isSubscribed`, which won't reflect updates made by the hook
  // mid-await — so mirror it into a ref (mutated every render) and read that
  // after the await instead, per the plumbing's documented contract in
  // src/hooks/usePushSubscription.ts.
  const isSubscribedRef = useRef(isSubscribed);
  isSubscribedRef.current = isSubscribed;

  const [pendingTestType, setPendingTestType] = useState<NotificationType | null>(
    null
  );

  const handleDeviceToggle = async (checked: boolean) => {
    if (checked) {
      await subscribe();
      if (isSubscribedRef.current) {
        toast.success(t(`${CP}.notificationsSubscribeSuccess`));
      } else {
        toast.error(t(`${CP}.notificationsSubscribeError`));
      }
    } else {
      await unsubscribe();
      if (!isSubscribedRef.current) {
        toast.success(t(`${CP}.notificationsUnsubscribeSuccess`));
      }
    }
  };

  const handleResubscribe = async () => {
    await resubscribe();
    if (isSubscribedRef.current) {
      toast.success(t(`${CP}.notificationsResubscribeSuccess`));
    } else {
      toast.error(t(`${CP}.notificationsSubscribeError`));
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
        ) : isDenied ? (
          <ControlPanelsPrefFormRow label={t(`${CP}.notificationsDevice`)}>
            <span className="control-panels-pref-form-label-desc">
              {t(`${CP}.notificationsDenied`)}
            </span>
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
        </>
      )}
    </div>
  );
}
