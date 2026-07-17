import { useState, useEffect } from "react";
import { isTauri } from "@/utils/platform";

let cachedDesktopFullscreen: boolean | null = null;

/**
 * Tracks Tauri window fullscreen state (adapted from upstream's Electron
 * `window.ryosDesktop` bridge — this app ships as a Tauri desktop build, not
 * Electron, so this talks to `@tauri-apps/api/window` directly).
 */
export function useDesktopFullscreen(): boolean {
  const isDesktopApp = isTauri();
  const [isFullscreen, setIsFullscreen] = useState(
    () => cachedDesktopFullscreen ?? false
  );

  useEffect(() => {
    if (!isDesktopApp) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();

        const fullscreen = await win.isFullscreen();
        if (cancelled) return;
        cachedDesktopFullscreen = fullscreen;
        setIsFullscreen(fullscreen);

        unlisten = await win.onResized(async () => {
          const fs = await win.isFullscreen();
          cachedDesktopFullscreen = fs;
          setIsFullscreen(fs);
        });
      } catch (error) {
        console.error("Error setting desktop fullscreen state:", error);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [isDesktopApp]);

  return isFullscreen;
}
