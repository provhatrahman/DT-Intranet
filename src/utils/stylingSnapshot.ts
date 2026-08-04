// A serializable snapshot of a user's UI customization ("styling"), collected
// from the three stores that hold it and applied back through the channels that
// actually re-paint the DOM. This is the payload the sync layer round-trips to
// the account backend (src/lib/api/settings.ts).
//
// Scope (v1): styling only. Custom-uploaded wallpapers live as blobs in
// IndexedDB and are device-local — only the built-in wallpaper *choice* syncs; a
// custom `indexeddb://` reference that can't be resolved on this device is
// skipped on apply. Excluded entirely: `wallpaperAccentColor` (device-local,
// re-derived) and `isDark` (derived at runtime).

import { useThemeStore, type DarkModePreference } from "@/stores/useThemeStore";
import { useDockStore, type DockItem } from "@/stores/useDockStore";
import {
  useDisplaySettingsStore,
  INDEXEDDB_PREFIX,
} from "@/stores/useDisplaySettingsStore";
import { useNotificationsStore } from "@/stores/useNotificationsStore";
import type { OsThemeId, AquaMaterial } from "@/themes/types";
import type { AccentId } from "@/themes/accents";
import type { SystemFontId } from "@/themes/systemFonts";
import type { DisplayMode } from "@/utils/displayMode";
import type { ShaderType } from "@/types/shader";

export const SNAPSHOT_VERSION = 1;

export interface StylingSnapshot {
  version: number;
  /** ISO write-time; telemetry + optional last-write-wins. Ignored by the echo diff. */
  updatedAt: string;
  theme: {
    current: OsThemeId;
    darkModeByTheme: Partial<Record<OsThemeId, DarkModePreference>>;
    accentByTheme: Partial<Record<OsThemeId, AccentId>>;
    aquaMaterial: AquaMaterial;
    systemFont: SystemFontId;
  };
  dock: {
    pinnedItems: DockItem[];
    scale: number;
    hiding: boolean;
    magnification: boolean;
  };
  display: {
    displayMode: DisplayMode;
    shaderEffectEnabled: boolean;
    selectedShaderType: ShaderType;
    currentWallpaper: string;
    wallpaperSource: string;
    screenSaverEnabled: boolean;
    screenSaverType: string;
    screenSaverIdleTime: number;
    debugMode: boolean;
    htmlPreviewSplit: boolean;
  };
  /**
   * Optional so older snapshots (written before this field existed) still
   * apply cleanly — absent means notifications stay enabled (the default).
   */
  notifications?: {
    enabled: boolean;
  };
}

/** Structural deep-clone for the JSON-serializable maps/arrays we snapshot. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Read the three stores into one plain, JSON-serializable snapshot. */
export function collectStylingSettings(): StylingSnapshot {
  const theme = useThemeStore.getState();
  const dock = useDockStore.getState();
  const display = useDisplaySettingsStore.getState();

  // Never persist a resolved `blob:` object URL (device-local, unique per
  // session) — the built-in path / IndexedDB reference in `currentWallpaper` is
  // the source of truth.
  const currentWallpaper = display.currentWallpaper;

  return {
    version: SNAPSHOT_VERSION,
    updatedAt: new Date().toISOString(),
    theme: {
      current: theme.current,
      darkModeByTheme: clone(theme.darkModeByTheme),
      accentByTheme: clone(theme.accentByTheme),
      aquaMaterial: theme.aquaMaterial,
      systemFont: theme.systemFont,
    },
    dock: {
      pinnedItems: clone(dock.pinnedItems),
      scale: dock.scale,
      hiding: dock.hiding,
      magnification: dock.magnification,
    },
    display: {
      displayMode: display.displayMode,
      shaderEffectEnabled: display.shaderEffectEnabled,
      selectedShaderType: display.selectedShaderType,
      currentWallpaper,
      wallpaperSource: currentWallpaper,
      screenSaverEnabled: display.screenSaverEnabled,
      screenSaverType: display.screenSaverType,
      screenSaverIdleTime: display.screenSaverIdleTime,
      debugMode: display.debugMode,
      htmlPreviewSplit: display.htmlPreviewSplit,
    },
    notifications: {
      enabled: useNotificationsStore.getState().notificationsEnabled,
    },
  };
}

/** Forward-migration hook for older snapshots (no-op at v1). */
export function migrateSnapshot(snapshot: StylingSnapshot): StylingSnapshot {
  return snapshot;
}

/**
 * Fields to ignore when comparing two snapshots for equality (echo detection):
 * `updatedAt` always differs, and `wallpaperSource` is device-derived.
 */
export function stripVolatile(snapshot: StylingSnapshot): unknown {
  const copy = clone(snapshot);
  copy.updatedAt = "";
  copy.display.wallpaperSource = "";
  return copy;
}

/**
 * Apply a snapshot back to the live stores using the correct re-paint channel
 * per store. MUST be awaited (wallpaper resolution is async). Callers hold the
 * sync store's `isApplyingRemote` flag across this so the resulting store writes
 * don't bounce back as a push.
 */
export async function applyStylingSettings(
  snapshot: StylingSnapshot
): Promise<void> {
  const snap = migrateSnapshot(snapshot);

  // Theme → hydrate(): the single path that re-applies <html> attributes/CSS
  // vars exactly as at boot (derives isDark, reloads XP/98 CSS, re-arms the
  // system-dark listener) and fires no analytics. See useThemeStore.
  if (snap.theme) {
    useThemeStore.getState().applyThemeSettings(snap.theme);
  }

  // Dock → bulk setter (sanitizes) + scalar setters (setScale keeps its clamp).
  if (snap.dock) {
    const dock = useDockStore.getState();
    if (Array.isArray(snap.dock.pinnedItems)) {
      dock.setPinnedItems(snap.dock.pinnedItems);
    }
    if (typeof snap.dock.scale === "number") dock.setScale(snap.dock.scale);
    if (typeof snap.dock.hiding === "boolean") dock.setHiding(snap.dock.hiding);
    if (typeof snap.dock.magnification === "boolean") {
      dock.setMagnification(snap.dock.magnification);
    }
  }

  // Display → one bulk setState for the scalars (avoids firing per-setter
  // analytics on a remote apply; displayMode still repaints via App.tsx).
  if (snap.display) {
    const d = snap.display;
    useDisplaySettingsStore.setState({
      displayMode: d.displayMode,
      shaderEffectEnabled: d.shaderEffectEnabled,
      selectedShaderType: d.selectedShaderType,
      screenSaverEnabled: d.screenSaverEnabled,
      screenSaverType: d.screenSaverType,
      screenSaverIdleTime: d.screenSaverIdleTime,
      debugMode: d.debugMode,
      htmlPreviewSplit: d.htmlPreviewSplit,
    });

    await applyWallpaper(d.currentWallpaper);
  }

  // Notifications → master toggle only; absent (older snapshot) leaves the
  // local default (enabled) untouched.
  if (snap.notifications && typeof snap.notifications.enabled === "boolean") {
    useNotificationsStore
      .getState()
      .setNotificationsEnabled(snap.notifications.enabled);
  }
}

/**
 * Wallpaper is special-cased: built-in/URL paths apply directly; a custom
 * `indexeddb://` reference is applied only if the blob exists on this device
 * (otherwise the local wallpaper is kept — never write an unresolvable source).
 */
async function applyWallpaper(currentWallpaper: string): Promise<void> {
  if (!currentWallpaper) return;
  const display = useDisplaySettingsStore.getState();

  if (currentWallpaper.startsWith(INDEXEDDB_PREFIX)) {
    try {
      const available = await display.loadCustomWallpapers();
      if (available.includes(currentWallpaper)) {
        // Resolves the IndexedDB blob to an object URL + dispatches wallpaperChange.
        await display.setWallpaper(currentWallpaper);
      }
      // Not on this device → keep the local wallpaper.
    } catch {
      // Ignore IndexedDB errors and keep the local wallpaper.
    }
    return;
  }

  // Built-in / URL wallpaper: set both fields and notify non-store listeners.
  useDisplaySettingsStore.setState({
    currentWallpaper,
    wallpaperSource: currentWallpaper,
  });
  window.dispatchEvent(
    new CustomEvent("wallpaperChange", { detail: currentWallpaper })
  );
}
