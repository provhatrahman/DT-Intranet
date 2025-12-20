import { useThemeStore } from "@/stores/useThemeStore";
import { useDockStore } from "@/stores/useDockStore";

/**
 * Window utilities for managing window close with animations and sounds.
 *
 * This module provides a centralized way to request window close operations
 * that properly trigger the WindowFrame's close animation and sound effects.
 */

/**
 * Request a window to close with its standard animation and sound.
 * This dispatches an event that WindowFrame listens for, allowing it to
 * trigger the proper close animation before actually removing the window.
 *
 * @param instanceId - The instance ID of the window to close
 */
export function requestCloseWindow(instanceId: string): void {
  window.dispatchEvent(
    new CustomEvent(`requestCloseWindow-${instanceId}`)
  );
}

/**
 * Calculate window insets for mobile view
 * (menu bar height, dock/taskbar height, safe area)
 * This matches the behavior of the green maximize button.
 * 
 * @returns An object with topInset and bottomInset values
 */
function getMobileInsets(): { topInset: number; bottomInset: number } {
  if (typeof window === "undefined") {
    return { topInset: 0, bottomInset: 0 }; // Fallback for SSR
  }

  // Get safe area bottom inset
  const getSafeAreaBottomInset = () => {
    const safeAreaInset = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--sat-safe-area-bottom"
      )
    );
    const isMobile = window.innerWidth < 768;
    return !isNaN(safeAreaInset) ? safeAreaInset : isMobile ? 20 : 0;
  };

  // Access stores using getState() since this is a utility function (not a hook)
  const currentTheme = useThemeStore.getState().current;
  const dockScale = useDockStore.getState().scale;
  const dockHiding = useDockStore.getState().hiding;
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  const isTauriApp = typeof window !== "undefined" && "__TAURI__" in window;

  // Calculate menu bar height
  const needsTauriMenubar = isTauriApp && (currentTheme === "macosx" || currentTheme === "system7");
  const menuBarHeight = needsTauriMenubar
    ? 32
    : currentTheme === "system7" ? 30 : currentTheme === "macosx" ? 25 : 0;

  // Calculate taskbar height
  const taskbarHeight = isXpTheme ? 30 : 0;

  // Calculate dock height (0 if dock hiding is enabled)
  const dockHeight = currentTheme === "macosx" && !dockHiding ? Math.round(56 * dockScale) : 0;

  // Calculate insets
  const safe = getSafeAreaBottomInset();
  const topInset = menuBarHeight;
  const bottomInset = taskbarHeight + dockHeight + safe;

  return { topInset, bottomInset };
}

/**
 * Calculate the full height available for windows in mobile view
 * (between the top menu bar and the bottom dock/taskbar)
 * This matches the behavior of the green maximize button.
 * 
 * @returns The maximum height available for windows in mobile view
 */
export function getMobileFullHeight(): number {
  if (typeof window === "undefined") {
    return 600; // Fallback for SSR
  }

  const { topInset, bottomInset } = getMobileInsets();
  return window.innerHeight - topInset - bottomInset;
}

/**
 * Get the top inset (menu bar height) for mobile view
 * This is the Y position where windows should start when maximized.
 * 
 * @returns The top inset value (menu bar height)
 */
export function getMobileTopInset(): number {
  if (typeof window === "undefined") {
    return 0; // Fallback for SSR
  }

  const { topInset } = getMobileInsets();
  return topInset;
}
