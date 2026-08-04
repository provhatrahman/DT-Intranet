import {
  getControlPanelCategory,
  type ControlPanelPaneId,
} from "./controlPanelsCategories";

/**
 * A single searchable preference. Each entry maps a user-facing setting to the
 * pane that hosts it, mirroring the Mac OS X System Preferences search index.
 *
 * - `labelKey` is the i18n key shown as the result title.
 * - `keywords` are locale-independent fallbacks (brand names, synonyms) matched
 *   in addition to the localized label + pane name.
 */
export type ControlPanelSearchEntry = {
  paneId: ControlPanelPaneId;
  labelKey: string;
  keywords?: string[];
};

const CP = "apps.control-panels";

export const CONTROL_PANEL_SEARCH_ENTRIES: ControlPanelSearchEntry[] = [
  // Appearance
  {
    paneId: "appearance",
    labelKey: `${CP}.panes.appearance`,
    keywords: ["appearance", "look", "skin"],
  },
  {
    paneId: "appearance",
    labelKey: `${CP}.theme`,
    keywords: ["theme", "system 7", "aqua", "glass", "windows", "xp", "98"],
  },
  {
    paneId: "appearance",
    labelKey: `${CP}.darkMode`,
    keywords: ["dark", "light", "mode", "night", "appearance"],
  },
  {
    paneId: "appearance",
    labelKey: `${CP}.accent`,
    keywords: ["accent", "color", "colour", "tint", "highlight"],
  },

  // Desktop & Screen Saver
  {
    paneId: "desktop-screen-saver",
    labelKey: `${CP}.panes.desktopScreenSaver`,
    keywords: ["desktop", "wallpaper", "background", "screen saver", "screensaver"],
  },
  {
    paneId: "desktop-screen-saver",
    labelKey: `${CP}.desktopTab`,
    keywords: ["wallpaper", "background", "desktop", "pattern", "picture"],
  },
  {
    paneId: "desktop-screen-saver",
    labelKey: `${CP}.patterns`,
    keywords: ["pattern", "patterns", "tile", "background", "desktop"],
  },
  {
    paneId: "desktop-screen-saver",
    labelKey: `${CP}.screenSaverTab`,
    keywords: ["screensaver", "screen saver", "idle", "sleep"],
  },
  {
    paneId: "desktop-screen-saver",
    labelKey: `${CP}.screenSaverType`,
    keywords: ["screensaver", "screen saver", "type", "style", "module"],
  },
  {
    paneId: "desktop-screen-saver",
    labelKey: `${CP}.startAfter`,
    keywords: ["screensaver", "idle", "delay", "timeout", "minutes", "start after"],
  },
  {
    paneId: "desktop-screen-saver",
    labelKey: `${CP}.screenSaverOptions.starfield.name`,
    keywords: ["screensaver", "starfield", "stars", "warp", "space"],
  },
  {
    paneId: "desktop-screen-saver",
    labelKey: `${CP}.screenSaverOptions.flyingToasters.name`,
    keywords: ["screensaver", "flying toasters", "after dark", "toaster"],
  },
  {
    paneId: "desktop-screen-saver",
    labelKey: `${CP}.screenSaverOptions.matrix.name`,
    keywords: ["screensaver", "matrix", "digital rain", "code"],
  },
  {
    paneId: "desktop-screen-saver",
    labelKey: `${CP}.screenSaverOptions.bouncingLogo.name`,
    keywords: ["screensaver", "bouncing logo", "dvd", "logo"],
  },
  {
    paneId: "desktop-screen-saver",
    labelKey: `${CP}.screenSaverOptions.pipes.name`,
    keywords: ["screensaver", "pipes", "3d pipes", "windows"],
  },
  {
    paneId: "desktop-screen-saver",
    labelKey: `${CP}.screenSaverOptions.maze.name`,
    keywords: ["screensaver", "maze", "3d maze", "labyrinth"],
  },

  // International
  {
    paneId: "international",
    labelKey: `${CP}.panes.international`,
    keywords: ["language", "region", "locale", "international", "translation"],
  },
  {
    paneId: "international",
    labelKey: "settings.language.title",
    keywords: [
      "language",
      "locale",
      "region",
      "translation",
      "english",
    ],
  },
  {
    paneId: "international",
    labelKey: `${CP}.timeZone`,
    keywords: [
      "timezone",
      "time zone",
      "clock",
      "utc",
      "gmt",
      "globe",
      "region",
      "offset",
    ],
  },

  // Displays
  {
    paneId: "displays",
    labelKey: `${CP}.panes.displays`,
    keywords: ["display", "screen", "monitor"],
  },
  {
    paneId: "displays",
    labelKey: `${CP}.displayMode`,
    keywords: [
      "color filter",
      "mono",
      "monochrome",
      "crt",
      "sepia",
      "high contrast",
      "dream",
      "invert",
      "display mode",
    ],
  },
  {
    paneId: "displays",
    labelKey: `${CP}.shaderEffect`,
    keywords: ["shader", "crt", "galaxy", "aurora", "effect"],
  },

  // Sound
  {
    paneId: "sound",
    labelKey: `${CP}.panes.sound`,
    keywords: ["sound", "audio", "volume"],
  },
  {
    paneId: "sound",
    labelKey: `${CP}.uiSounds`,
    keywords: ["ui sounds", "clicks", "feedback"],
  },
  {
    paneId: "sound",
    labelKey: `${CP}.speech`,
    keywords: ["speech", "voice", "tts"],
  },
  {
    paneId: "sound",
    labelKey: `${CP}.browserTtsVoice`,
    keywords: [
      "tts",
      "voice",
      "tts voice",
      "text to speech",
      "read aloud",
      "speech voice",
    ],
  },
  {
    paneId: "sound",
    labelKey: `${CP}.terminalIeAmbientSynth`,
    keywords: [
      "synth",
      "ambient synth",
      "terminal",
      "ie",
      "internet explorer",
      "sound effects",
    ],
  },
  {
    paneId: "sound",
    labelKey: `${CP}.chatSynth`,
    keywords: ["chat synth", "synth", "typing", "preset", "chats"],
  },
  {
    paneId: "sound",
    labelKey: `${CP}.masterVolume`,
    keywords: ["volume", "master", "mute"],
  },
  {
    paneId: "sound",
    labelKey: `${CP}.uiVolume`,
    keywords: ["volume", "ui volume", "interface", "mute"],
  },
  {
    paneId: "sound",
    labelKey: `${CP}.speechVolume`,
    keywords: ["volume", "speech volume", "voice", "tts", "mute"],
  },
  {
    paneId: "sound",
    labelKey: `${CP}.chatSynthVolume`,
    keywords: ["volume", "chat synth volume", "synth", "mute"],
  },
  {
    paneId: "sound",
    labelKey: `${CP}.ipodVolume`,
    keywords: ["volume", "ipod volume", "music", "mute"],
  },

  // Software Update
  {
    paneId: "software-update",
    labelKey: `${CP}.panes.softwareUpdate`,
    keywords: ["update", "software", "version", "upgrade"],
  },
  {
    paneId: "software-update",
    labelKey: `${CP}.checkForUpdates`,
    keywords: ["update", "check", "version"],
  },

  // Notifications
  {
    paneId: "notifications",
    labelKey: `${CP}.panes.notifications`,
    keywords: ["notifications", "bell", "alerts", "push", "reminders"],
  },
  {
    paneId: "notifications",
    labelKey: `${CP}.notificationsEnabled`,
    keywords: ["notifications", "enable", "toggle", "on", "off"],
  },
  {
    paneId: "notifications",
    labelKey: `${CP}.notificationsDevice`,
    keywords: ["push", "device", "subscribe", "permission", "browser"],
  },
  {
    paneId: "notifications",
    labelKey: `${CP}.notificationsTestSection`,
    keywords: ["test", "admin", "send test notification"],
  },
];

export type ControlPanelSearchResult = {
  paneId: ControlPanelPaneId;
  /** Localized setting label (result title). */
  label: string;
  /** Localized pane name (result subtitle). */
  paneLabel: string;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns matching preference entries for the given query, in index order, with
 * duplicate labels removed. The matcher is a case-insensitive substring match
 * against the localized label, the pane name, and the entry keywords.
 */
export function searchControlPanels(
  query: string,
  t: (key: string) => string
): ControlPanelSearchResult[] {
  const q = normalize(query);
  if (!q) return [];

  const results: ControlPanelSearchResult[] = [];
  const seen = new Set<string>();

  for (const entry of CONTROL_PANEL_SEARCH_ENTRIES) {
    const category = getControlPanelCategory(entry.paneId);
    if (!category) continue;

    const label = t(entry.labelKey);
    const paneLabel = t(category.labelKey);
    const haystack = [
      label,
      paneLabel,
      ...(entry.keywords ?? []),
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(q)) continue;

    const dedupeKey = `${entry.paneId}:${label}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    results.push({ paneId: entry.paneId, label, paneLabel });
  }

  return results;
}

/** Union of pane IDs that match the query — used to drive the spotlight. */
export function getSpotlightPaneIds(
  results: ControlPanelSearchResult[]
): Set<ControlPanelPaneId> {
  return new Set(results.map((result) => result.paneId));
}
