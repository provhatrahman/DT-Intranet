export type ControlPanelPaneId =
  | "appearance"
  | "desktop-screen-saver"
  | "international"
  | "displays"
  | "sound"
  | "software-update";

/** Legacy tab IDs used by Windows/System7 layout and deep links. */
export type ControlPanelLegacyTabId = "appearance" | "sound";

/** Deep-link-only aliases (Spotlight) that map differently per layout. */
export type ControlPanelDeepLinkAlias = "wallpaper" | "screensaver";

export type ControlPanelCategory = {
  id: ControlPanelPaneId;
  labelKey: string;
  icon: string;
};

export type ControlPanelSectionId =
  | "personal"
  | "hardware-system"
  | "internet-network";

export type ControlPanelSection = {
  id: ControlPanelSectionId;
  labelKey: string;
  paneIds: ControlPanelPaneId[];
};

export const CONTROL_PANEL_CATEGORIES: ControlPanelCategory[] = [
  {
    id: "appearance",
    labelKey: "apps.control-panels.panes.appearance",
    icon: "control-panels/appearance-pane.png",
  },
  {
    id: "desktop-screen-saver",
    labelKey: "apps.control-panels.panes.desktopScreenSaver",
    icon: "control-panels/desktop-screen-saver.png",
  },
  {
    id: "international",
    labelKey: "apps.control-panels.panes.international",
    icon: "control-panels/international.png",
  },
  {
    id: "displays",
    labelKey: "apps.control-panels.panes.displays",
    icon: "control-panels/displays.png",
  },
  {
    id: "sound",
    labelKey: "apps.control-panels.panes.sound",
    icon: "sound.png",
  },
  {
    id: "software-update",
    labelKey: "apps.control-panels.panes.softwareUpdate",
    icon: "software-update.png",
  },
];

/** Home grid — functional panes grouped like Mac OS X 10.3 System Preferences. */
export const CONTROL_PANEL_SECTIONS: ControlPanelSection[] = [
  {
    id: "personal",
    labelKey: "apps.control-panels.sections.personal",
    paneIds: ["appearance", "desktop-screen-saver", "international"],
  },
  {
    id: "hardware-system",
    labelKey: "apps.control-panels.sections.hardwareSystem",
    paneIds: ["displays", "sound"],
  },
  {
    id: "internet-network",
    labelKey: "apps.control-panels.sections.internetNetwork",
    paneIds: ["software-update"],
  },
];

/** Pinned quick-access icons (10.3-style toolbar). */
export const CONTROL_PANEL_PINNED_PANES: ControlPanelPaneId[] = [
  "appearance",
  "desktop-screen-saver",
];

// Greenroom dropped the Accounts/Security/Sharing/Assistant/.Mac panes (see
// CLAUDE.md — no ryOS account, backup/restore, cloud sync, or assistant
// subsystem in this fork). Legacy deep links / bookmarks that used to point at
// those panes fall back to "home" (the Show All grid) instead of a specific
// pane; "system" still resolves to International, mirroring MAIN (its target
// pane survives here).
const LEGACY_PANE_ALIASES: Record<string, ControlPanelPaneId | undefined> = {
  system: "international",
  wallpaper: "desktop-screen-saver",
  screensaver: "desktop-screen-saver",
};

/** Maps macOS-only deep-link aliases back to classic tab IDs. */
const CLASSIC_TAB_ALIASES: Record<ControlPanelDeepLinkAlias, ControlPanelLegacyTabId> = {
  wallpaper: "appearance",
  screensaver: "appearance",
};

function isControlPanelDeepLinkAlias(
  value: string
): value is ControlPanelDeepLinkAlias {
  return value === "wallpaper" || value === "screensaver";
}

export function normalizeControlPanelPaneId(
  value: string | undefined
): ControlPanelPaneId | undefined {
  if (!value) return undefined;
  if (isControlPanelPaneId(value)) return value;
  return LEGACY_PANE_ALIASES[value];
}

export function getControlPanelCategory(
  paneId: ControlPanelPaneId
): ControlPanelCategory | undefined {
  return CONTROL_PANEL_CATEGORIES.find((category) => category.id === paneId);
}

export type ControlPanelMacNavigationEntry = "home" | ControlPanelPaneId;

/** macOS System Preferences window title for Show All vs an open pane. */
export function getControlPanelsMacWindowTitle(
  current: ControlPanelMacNavigationEntry,
  t: (key: string) => string,
  defaultTitle: string
): string {
  if (current === "home") return defaultTitle;
  const category = getControlPanelCategory(current);
  return category ? t(category.labelKey) : defaultTitle;
}

export function isControlPanelPaneId(value: string): value is ControlPanelPaneId {
  return CONTROL_PANEL_CATEGORIES.some((category) => category.id === value);
}

export function normalizeControlPanelClassicTabId(
  value: string | undefined
): ControlPanelLegacyTabId {
  if (!value) return "appearance";
  if (isControlPanelDeepLinkAlias(value)) return CLASSIC_TAB_ALIASES[value];
  if (isControlPanelLegacyTabId(value)) return value;
  return "appearance";
}

export function isControlPanelLegacyTabId(
  value: string
): value is ControlPanelLegacyTabId {
  return value === "appearance" || value === "sound";
}
