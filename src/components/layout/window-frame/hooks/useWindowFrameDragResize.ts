import { useWindowManager } from "@/hooks/useWindowManager";
import type { AppId } from "@/config/appIds";
import { ResizeType } from "@/types/types";
import { useCallback } from "react";

type DragResizeParams = {
  appId: AppId;
  instanceId?: string;
  isForeground: boolean;
  isMacOSTheme: boolean;
  isWindowsTheme: boolean;
  bringInstanceToForeground: (instanceId: string) => void;
};

/**
 * Wraps our `useWindowManager` (plain React state, not Motion values — that
 * perf rewrite lives only upstream) with the same surface MAIN's window-frame
 * hooks expect: theme-aware resizer z-index and foreground-bringing wrappers
 * around mouse-down / resize-start.
 */
export function useWindowFrameDragResize({
  appId,
  instanceId,
  isForeground,
  isMacOSTheme,
  isWindowsTheme,
  bringInstanceToForeground,
}: DragResizeParams) {
  const {
    windowPosition,
    windowSize,
    isDragging,
    resizeType,
    handleMouseDown,
    handleResizeStart,
    setWindowSize,
    setWindowPosition,
    snapZone,
    computeInsets: computeWindowInsets,
  } = useWindowManager({ appId, instanceId });

  const shouldAnimateWindowTransition = !isDragging && !resizeType;

  const resizerZIndexClass = isMacOSTheme
    ? "z-[60]"
    : isWindowsTheme
      ? "z-40"
      : "z-50";

  const bringToForegroundIfNeeded = useCallback(() => {
    if (!isForeground && instanceId) {
      bringInstanceToForeground(instanceId);
    }
  }, [isForeground, instanceId, bringInstanceToForeground]);

  const handleMouseDownWithForeground = useCallback(
    (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
      handleMouseDown(e);
      bringToForegroundIfNeeded();
    },
    [handleMouseDown, bringToForegroundIfNeeded]
  );

  const handleResizeStartWithForeground = useCallback(
    (e: React.MouseEvent | React.TouchEvent, type: ResizeType) => {
      handleResizeStart(e, type);
      bringToForegroundIfNeeded();
    },
    [handleResizeStart, bringToForegroundIfNeeded]
  );

  return {
    windowPosition,
    windowSize,
    isDragging,
    resizeType,
    setWindowSize,
    setWindowPosition,
    snapZone,
    computeWindowInsets,
    shouldAnimateWindowTransition,
    resizerZIndexClass,
    handleMouseDownWithForeground,
    handleResizeStartWithForeground,
  };
}
