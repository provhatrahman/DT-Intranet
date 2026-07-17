import type { AppId } from "@/config/appIds";

export interface WindowFrameProps {
  children: React.ReactNode;
  title: string;
  onClose?: () => void;
  isForeground?: boolean;
  appId: AppId;
  isShaking?: boolean;
  /**
   * Window material style: "default" (opaque), "transparent" (translucent bg),
   * "notitlebar" (immersive, titlebar on hover), "brushedmetal" (macOS brushed
   * aluminum). Defaults to "default"; `transparentBackground` (legacy prop) is
   * still honored for back-compat and maps to "transparent" when `material`
   * isn't given.
   */
  material?: "default" | "transparent" | "notitlebar" | "brushedmetal";
  /** @deprecated Prefer `material="transparent"`. Still supported. */
  transparentBackground?: boolean;
  skipInitialSound?: boolean;
  windowConstraints?: {
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number | string;
    maxHeight?: number | string;
  };
  // Instance support
  instanceId?: string;
  onNavigateNext?: () => void;
  onNavigatePrevious?: () => void;
  // Close interception support
  interceptClose?: boolean;
  menuBar?: React.ReactNode; // Add menuBar prop
  // Keep content mounted when minimized (useful for audio/video apps)
  keepMountedWhenMinimized?: boolean;
  // Fullscreen toggle callback (for apps like iPod that support fullscreen)
  onFullscreenToggle?: () => void;
  /** Cover Flow toggle (shown left of fullscreen when set; iPod). */
  onCoverFlowToggle?: () => void;
  isCoverFlowActive?: boolean;
  // Disable auto-hide for notitlebar material (keeps titlebar always visible)
  disableTitlebarAutoHide?: boolean;
  // Custom content for the right side of the titlebar (replaces fullscreen button if provided)
  titleBarRightContent?: React.ReactNode;
}

/** Insets (menu bar / taskbar / dock / safe-area) used for window constraint math. */
export interface WindowFrameInsets {
  menuBarHeight: number;
  taskbarHeight: number;
  safeAreaBottom: number;
  topInset: number;
  bottomInset: number;
  dockHeight: number;
}
