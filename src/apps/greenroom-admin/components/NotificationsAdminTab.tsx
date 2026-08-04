// Admin Portal → Notifications tab: send a [Test] notification to specific
// users, and see per-user whether a push can actually reach them.
//
// Why the device count is here and not just a Send button: notify_users drops
// users who switched notifications off, and a user with 0 registered
// subscriptions only ever gets the in-app bell (most commonly an iOS user who
// never installed the PWA — iOS refuses web push to uninstalled sites). Without
// that shown up front, "I sent a test and nothing arrived" is undiagnosable
// from this screen.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { AquaCard, EmptyState, StatusBadge } from "@/components/greenroom";
import { CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BellRing, Loader2, RefreshCw, Send, Smartphone } from "lucide-react";
import type { GreenroomUser } from "@/lib/api/users";
import {
  fetchPushStatus,
  sendTestNotificationToUsers,
  type NotificationType,
  type SendTestNotificationResult,
  type UserPushStatus,
} from "@/lib/api/notifications";

// Mirrors TEST_NOTIFICATION_TYPES in backend api/views/notifications.py. The
// four event types build their sample from the most recent real pitch/project,
// so they exercise the same title/body/link shape users see in production.
const TYPE_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: "test", label: "Generic test" },
  { value: "offer_logged", label: "New offer logged" },
  { value: "vote_reminder", label: "Vote reminder" },
  { value: "offer_activated", label: "Offer activated" },
  { value: "curation_reminder", label: "Curation reminder" },
];

// Matches MAX_TEST_RECIPIENTS server-side; enforced here too so a too-large
// selection is refused before the round trip.
const MAX_RECIPIENTS = 50;

export function NotificationsAdminTab({ users }: { users: GreenroomUser[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [notifType, setNotifType] = useState<NotificationType>("test");
  const [statuses, setStatuses] = useState<UserPushStatus[] | null>(null);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastResult, setLastResult] = useState<SendTestNotificationResult | null>(
    null
  );

  const loadStatuses = useCallback(async () => {
    setIsLoadingStatuses(true);
    try {
      setStatuses(await fetchPushStatus());
    } catch (error) {
      // Non-fatal: sending still works, the tab just can't annotate rows.
      console.error("[NotificationsAdminTab] push status failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load push status"
      );
    } finally {
      setIsLoadingStatuses(false);
    }
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const statusByUser = useMemo(() => {
    const map = new Map<number, UserPushStatus>();
    for (const status of statuses ?? []) map.set(status.user_id, status);
    return map;
  }, [statuses]);

  // Disabled accounts can't sign in, so a notification to them is dead weight;
  // they're excluded from the picker rather than shown as unselectable noise.
  const sortedUsers = useMemo(
    () =>
      [...users]
        .filter((u) => u.is_active)
        .sort((a, b) => a.username.localeCompare(b.username)),
    [users]
  );

  const selectedUsers = sortedUsers.filter((u) => selectedIds.has(u.id));
  const usernameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const user of users) map.set(user.id, user.username);
    return map;
  }, [users]);

  const toggleUser = (userId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const allSelected =
    sortedUsers.length > 0 && selectedIds.size === sortedUsers.length;

  const toggleAll = () => {
    setSelectedIds(
      allSelected ? new Set() : new Set(sortedUsers.map((u) => u.id))
    );
  };

  const handleSend = async () => {
    setConfirmOpen(false);
    setIsSending(true);
    try {
      const result = await sendTestNotificationToUsers(
        [...selectedIds],
        notifType
      );
      setLastResult(result);
      const names = result.notified
        .map((id) => usernameById.get(id) ?? `#${id}`)
        .join(", ");
      if (result.notified.length === 0) {
        toast.error("Nobody was notified — every recipient has them switched off");
      } else if (result.push_targets === 0) {
        // The distinction that matters: rows were written, but there was no
        // device to push to, so no phone will buzz.
        toast(`Notified ${names} in-app — no registered devices to push to`);
      } else {
        toast.success(
          `Sent to ${names} (${result.push_targets} device${
            result.push_targets === 1 ? "" : "s"
          })`
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send test notification"
      );
    } finally {
      setIsSending(false);
    }
  };

  const tooMany = selectedIds.size > MAX_RECIPIENTS;
  const typeLabel =
    TYPE_OPTIONS.find((o) => o.value === notifType)?.label ?? notifType;

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={notifType}
          onValueChange={(value) => setNotifType(value as NotificationType)}
        >
          <SelectTrigger className="w-[190px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="text-xs"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="default"
          size="sm"
          className="min-h-[32px] touch-manipulation"
          disabled={selectedIds.size === 0 || isSending || tooMany}
          onClick={() => setConfirmOpen(true)}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-1" />
          )}
          Send test
          {selectedIds.size > 0 ? ` to ${selectedIds.size}` : ""}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="min-h-[32px] touch-manipulation"
          onClick={loadStatuses}
          disabled={isLoadingStatuses}
        >
          <RefreshCw
            className={cn("h-4 w-4 mr-1", isLoadingStatuses && "animate-spin")}
          />
          Refresh devices
        </Button>

        {sortedUsers.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[32px] touch-manipulation"
            onClick={toggleAll}
          >
            {allSelected ? "Clear selection" : "Select all"}
          </Button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Sends a real notification titled “[Test] …” to the selected users — an
        in-app bell entry plus a push to every device they've registered. Users
        with 0 devices only get the bell.
      </p>

      {tooMany && (
        <p className="text-[11px] text-destructive">
          At most {MAX_RECIPIENTS} recipients per send — deselect{" "}
          {selectedIds.size - MAX_RECIPIENTS} more.
        </p>
      )}

      {lastResult && lastResult.skipped.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Skipped (notifications switched off):{" "}
          {lastResult.skipped
            .map((id) => usernameById.get(id) ?? `#${id}`)
            .join(", ")}
        </p>
      )}

      <ScrollArea className="flex-1 min-h-0 [&_[data-radix-scroll-area-viewport]>div]:block!">
        {sortedUsers.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="No active users"
            hint="Add or enable a user before sending test notifications."
            className="py-10"
          />
        ) : (
          <div className="space-y-2">
            {sortedUsers.map((user) => {
              const status = statusByUser.get(user.id);
              const devices = status?.devices ?? 0;
              const notificationsOff = status ? !status.enabled : false;
              const isSelected = selectedIds.has(user.id);
              return (
                <AquaCard
                  key={user.id}
                  interactive
                  className={cn(isSelected && "ring-2 ring-blue-500")}
                >
                  <CardContent
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => toggleUser(user.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleUser(user.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${user.username}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">
                        {user.username}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {user.email}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {notificationsOff && (
                        <StatusBadge
                          status="notifications_off"
                          tone="gray"
                          label="Notifications off"
                        />
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[11px]",
                          devices === 0
                            ? "text-muted-foreground"
                            : "text-foreground"
                        )}
                        title={
                          devices === 0
                            ? "No push subscriptions — this user will only get the in-app bell"
                            : `${devices} registered device(s)`
                        }
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        {isLoadingStatuses && statuses === null ? "…" : devices}
                      </span>
                    </div>
                  </CardContent>
                </AquaCard>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleSend}
        confirmDisabled={isSending}
        title="Send test notification?"
        description={`This sends a “${typeLabel}” test notification to ${
          selectedUsers.length
        } user${selectedUsers.length === 1 ? "" : "s"} (${selectedUsers
          .map((u) => u.username)
          .join(", ")}). It will appear on their devices.`}
      />
    </div>
  );
}
