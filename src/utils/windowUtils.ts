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
 * Calculate the window insets for the current theme
 * (menu bar height on top; dock / taskbar / safe area on the bottom).
 * This matches the behavior of the green maximize button and applies to both
 * desktop and mobile (the only mobile-specific bit is the safe-area fallback).
 *
 * @returns An object with topInset and bottomInset values
 */
export function getWindowInsets(): { topInset: number; bottomInset: number } {
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

  const { topInset, bottomInset } = getWindowInsets();
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

  const { topInset } = getWindowInsets();
  return topInset;
}

/**
 * Clamp a window's desired position + size so it opens fully inside the usable
 * area of the screen: below the menu bar (topInset) and above the dock /
 * taskbar / safe-area (bottomInset), and within the horizontal viewport.
 *
 * This guarantees a freshly placed window is never covered by the Dock and is
 * always sized to fit the current screen (desktop + mobile). It is intended for
 * window *placement* (creation / default fallback) only — user-moved or
 * user-resized windows keep their saved geometry and are not routed through it.
 *
 * A window that already fits is returned unchanged.
 *
 * @param position - The desired top-left position
 * @param size - The desired size
 * @param minSize - The smallest the window is allowed to be
 * @returns The constrained { position, size }
 */
export function constrainWindowToUsableArea(
  position: { x: number; y: number },
  size: { width: number; height: number },
  minSize: { width: number; height: number } = { width: 300, height: 200 }
): {
  position: { x: number; y: number };
  size: { width: number; height: number };
} {
  if (typeof window === "undefined") {
    return { position, size };
  }

  const { topInset, bottomInset } = getWindowInsets();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  // Height available between the menu bar and the dock/taskbar.
  const usableH = Math.max(0, viewportH - topInset - bottomInset);

  // Size: never wider than the viewport, never taller than the usable area
  // (so the window can't extend behind the dock), but never below the minimum.
  const width = Math.min(size.width, Math.max(minSize.width, viewportW));
  const maxUsableHeight = Math.max(minSize.height, usableH || size.height);
  const height = Math.min(size.height, maxUsableHeight);

  // Position: keep the window fully inside the usable rectangle.
  let x = position.x;
  let y = Math.max(topInset, position.y);

  const maxX = Math.max(0, viewportW - width);
  x = Math.min(Math.max(0, x), maxX);

  const maxY = Math.max(topInset, viewportH - bottomInset - height);
  y = Math.min(y, maxY);

  return { position: { x, y }, size: { width, height } };
}
