import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell } from "@phosphor-icons/react";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarSeparator,
} from "@/components/ui/menubar";
import { useThemeFlags } from "@/hooks/useThemeFlags";
import { useEffectiveGreenroomAccount } from "@/hooks/useGreenroomAccount";
import { useNotificationsStore } from "@/stores/useNotificationsStore";
import { openNotificationLink } from "@/hooks/useNotificationsSync";
import type { GreenroomNotification } from "@/lib/api/notifications";

const MENU_VALUE = "notifications";

/** Formats an ISO timestamp as a short relative age ("3m ago", "2d ago", …).
 * No shared helper exists for this in the repo — the closest precedent
 * (src/apps/admin/components/UserProfilePanel.tsx / AdminAppComponent.tsx)
 * duplicates the same small closure locally rather than exporting one, so
 * this follows the same established (if imperfect) convention. */
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/**
 * Menu-bar / taskbar notification bell: unread-count badge + a popover panel
 * listing the current user's notification center. Mounted in both
 * MacTopMenuBar.tsx (menubar-status-controls) and WindowsTaskbar.tsx (system
 * tray), mirroring VolumeControl's per-theme popover pattern (each instance
 * hosts its own single-item Menubar so it drops into either chrome). Hidden
 * entirely when there's no effective Greenroom account or the user has
 * turned notifications off (Control Panels > Notifications), matching
 * MenuBarAccount's "hidden when nothing to show" convention. See
 * NOTIFICATIONS_PLAN.md.
 */
export function MenuBarNotifications() {
  const { t } = useTranslation();
  const { isWindowsTheme, isWin98 } = useThemeFlags();
  const { userId } = useEffectiveGreenroomAccount();

  const notifications = useNotificationsStore((s) => s.notifications);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const isLoading = useNotificationsStore((s) => s.isLoading);
  const notificationsEnabled = useNotificationsStore(
    (s) => s.notificationsEnabled
  );
  const fetchNotifications = useNotificationsStore((s) => s.fetch);
  const markRead = useNotificationsStore((s) => s.markRead);

  const [menuValue, setMenuValue] = useState("");

  // Refresh the moment the panel opens — the background poller
  // (NotificationsSync) keeps things fresh generally, but a fresh fetch on
  // open avoids showing a stale list right after a new item lands.
  useEffect(() => {
    if (menuValue === MENU_VALUE && userId != null) {
      fetchNotifications(userId);
    }
  }, [menuValue, userId, fetchNotifications]);

  if (userId == null || !notificationsEnabled) return null;

  const bellLabel = t("common.menuBar.notifications", "Notifications");

  const handleSelectNotification = (notification: GreenroomNotification) => {
    if (!notification.read_at) {
      markRead([notification.id], userId);
    }
    if (notification.link) {
      openNotificationLink(notification.link);
    }
    setMenuValue("");
  };

  const handleMarkAllRead = (event: Event) => {
    // Keep the panel open so the read-state change is visible in place.
    event.preventDefault();
    markRead("all", userId);
  };

  return (
    <Menubar
      value={menuValue}
      onValueChange={setMenuValue}
      className={`hidden sm:flex items-stretch self-stretch border-none bg-transparent p-0 space-x-0 rounded-none h-full ${
        isWindowsTheme ? "" : "mr-2"
      }`}
    >
      <MenubarMenu value={MENU_VALUE}>
        <MenubarTrigger
          className="flex items-center justify-center px-2 border-none focus-visible:ring-0"
          title={bellLabel}
          aria-label={bellLabel}
          style={{ color: isWindowsTheme && isWin98 ? "#000000" : undefined }}
        >
          <span className="relative inline-flex items-center justify-center">
            <Bell size={12} weight="fill" />
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full bg-red-500 text-white font-bold px-1"
                style={{
                  minWidth: 12,
                  height: 12,
                  fontSize: 8,
                  lineHeight: "8px",
                  boxShadow: "0 0 0 1px white",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </span>
        </MenubarTrigger>
        <MenubarContent
          align="end"
          side={isWindowsTheme ? "top" : "bottom"}
          sideOffset={isWindowsTheme ? 8 : 1}
          className="w-72 p-0 py-1"
        >
          <div className="flex items-center justify-between gap-2 pr-1">
            <MenubarLabel className="text-md opacity-70">
              {bellLabel}
            </MenubarLabel>
            {unreadCount > 0 && (
              <MenubarItem
                onSelect={handleMarkAllRead}
                className="text-xs justify-end shrink-0 opacity-80"
              >
                {t("common.menuBar.notificationsMarkAllRead", "Mark all read")}
              </MenubarItem>
            )}
          </div>
          <MenubarSeparator />
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs opacity-60">
                {isLoading
                  ? "…"
                  : t(
                      "common.menuBar.notificationsEmpty",
                      "No notifications yet"
                    )}
              </div>
            ) : (
              notifications.map((notification) => {
                const isUnread = !notification.read_at;
                return (
                  <MenubarItem
                    key={notification.id}
                    onSelect={() => handleSelectNotification(notification)}
                    className="flex-col items-start gap-0.5 py-2"
                  >
                    <span
                      className={`w-full truncate text-sm ${
                        isUnread ? "font-semibold" : "opacity-80"
                      }`}
                    >
                      {notification.title}
                    </span>
                    {notification.body && (
                      <span className="w-full truncate text-xs opacity-70">
                        {notification.body}
                      </span>
                    )}
                    <span className="text-[11px] opacity-50">
                      {formatRelativeTime(notification.created_at)}
                    </span>
                  </MenubarItem>
                );
              })
            )}
          </div>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
