import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAppStoreShallow } from "@/stores/helpers";
import { useDisplaySettingsStore } from "@/stores/useDisplaySettingsStore";
import { useThemeFlags } from "@/hooks/useThemeFlags";
import { useIsMobile, useIsNarrowScreen } from "@/hooks/useIsMobile";
import { useIsPhone } from "@/hooks/useIsPhone";

import type { WindowFrameProps } from "./windowFrameTypes";
import { getSwipeStyle } from "./windowFrameUtils";
import {
  getAnimateState,
  getExitAnimation,
  getInitialAnimation,
} from "./windowFrameAnimations";
import { WindowFrameResizeHandles } from "./WindowFrameResizeHandles";
import { WindowFrameSnapZoneIndicator } from "./WindowFrameSnapZoneIndicator";
import { WindowFrameTitleBar } from "./WindowFrameTitleBar";
import { useWindowFrameConstraints } from "./hooks/useWindowFrameConstraints";
import { useWindowFrameTitlebarAutoHide } from "./hooks/useWindowFrameTitlebarAutoHide";
import { useWindowFrameCloseLifecycle } from "./hooks/useWindowFrameCloseLifecycle";
import { useWindowFrameMaximize } from "./hooks/useWindowFrameMaximize";
import { useWindowFrameDragResize } from "./hooks/useWindowFrameDragResize";
import { useWindowFrameExposeTransform } from "./hooks/useWindowFrameExposeTransform";
import { useWindowFrameDockOffsets } from "./hooks/useWindowFrameDockOffsets";
import { useWindowFramePhoneSwipe } from "./hooks/useWindowFramePhoneSwipe";
import { useWindowFrameNoTitlebarMouseHandlers } from "./hooks/useWindowFrameNoTitlebarMouseHandlers";

export type { WindowFrameProps } from "./windowFrameTypes";

export function WindowFrame({
  children,
  title,
  onClose,
  isForeground = true,
  isShaking = false,
  appId,
  material,
  transparentBackground = false,
  skipInitialSound = false,
  windowConstraints = {},
  instanceId,
  onNavigateNext,
  onNavigatePrevious,
  interceptClose = false,
  menuBar,
  keepMountedWhenMinimized = false,
  onFullscreenToggle,
  onCoverFlowToggle,
  isCoverFlowActive = false,
  disableTitlebarAutoHide = false,
  titleBarRightContent,
}: WindowFrameProps) {
  const { mergedConstraints } = useWindowFrameConstraints(
    appId,
    windowConstraints
  );

  const {
    bringInstanceToForeground,
    updateInstanceWindowState,
    minimizeInstance,
    instances,
    closeAppInstance,
    updateInstanceTitle,
    exposeMode,
  } = useAppStoreShallow((state) => ({
    bringInstanceToForeground: state.bringInstanceToForeground,
    updateInstanceWindowState: state.updateInstanceWindowState,
    minimizeInstance: state.minimizeInstance,
    instances: state.instances,
    closeAppInstance: state.closeAppInstance,
    updateInstanceTitle: state.updateInstanceTitle,
    exposeMode: state.exposeMode,
  }));
  const debugMode = useDisplaySettingsStore((state) => state.debugMode);

  const isMinimized = instanceId
    ? instances[instanceId]?.isMinimized ?? false
    : false;

  const {
    isOpen,
    isClosing,
    isInitialMount,
    isClosingRef,
    shouldAnimateRestore,
    handleClose,
    handleCloseAnimationComplete,
    handleMinimize,
  } = useWindowFrameCloseLifecycle({
    appId,
    instanceId,
    title,
    interceptClose,
    skipInitialSound,
    onClose,
    updateInstanceTitle,
    minimizeInstance,
    closeAppInstance,
    isMinimized,
  });

  const { isWindowsTheme, isMacOSTheme, isSystem7Theme, isWinXp, isAquaGlass } =
    useThemeFlags();

  // Resolve the material: the explicit `material` prop wins; otherwise the
  // legacy `transparentBackground` boolean (still used by iPod/Terminal) maps
  // to "transparent" for back-compat.
  const resolvedMaterial =
    material ?? (transparentBackground ? "transparent" : "default");
  const isTransparent =
    resolvedMaterial === "transparent" || resolvedMaterial === "notitlebar";
  const isNoTitlebar = resolvedMaterial === "notitlebar";
  const isBrushedMetal = resolvedMaterial === "brushedmetal";
  // Regular (default-material) windows under Aqua Glass use the single frosted
  // glass pane. Brushed-metal windows keep their `window-material-brushedmetal`
  // class and are converted to glass purely via CSS overrides (so apps can
  // still opt into the metal material). Transparent / notitlebar materials keep
  // their own treatment.
  const isGlassRegular = isAquaGlass && !isTransparent && !isBrushedMetal;
  const effectiveTransparentBackground = isMacOSTheme ? true : isTransparent;

  const effectiveDisableTitlebarAutoHide = disableTitlebarAutoHide;

  const { isTitlebarHovered, showTitlebarWithAutoHide, hideTitlebar } =
    useWindowFrameTitlebarAutoHide(isNoTitlebar, effectiveDisableTitlebarAutoHide);

  const noTitlebarMouseHandlers = useWindowFrameNoTitlebarMouseHandlers(
    isNoTitlebar,
    effectiveDisableTitlebarAutoHide,
    showTitlebarWithAutoHide,
    hideTitlebar
  );

  const isMobile = useIsMobile();
  const isNarrowScreen = useIsNarrowScreen();
  const isPhone = useIsPhone();

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    isSwiping,
    swipeDirection,
  } = useWindowFramePhoneSwipe({
    appId,
    isPhone,
    isForeground,
    onNavigateNext,
    onNavigatePrevious,
  });

  const {
    windowPosition,
    windowSize,
    resizeType,
    setWindowSize,
    setWindowPosition,
    snapZone,
    computeWindowInsets,
    shouldAnimateWindowTransition,
    resizerZIndexClass,
    handleMouseDownWithForeground,
    handleResizeStartWithForeground,
  } = useWindowFrameDragResize({
    appId,
    instanceId,
    isForeground,
    isMacOSTheme,
    isWindowsTheme,
    bringInstanceToForeground,
  });

  const { handleHeightOnlyMaximize, handleFullMaximize, handleTitleBarTap } =
    useWindowFrameMaximize({
      mergedConstraints,
      windowSize,
      windowPosition,
      instanceId,
      isClosingRef,
      computeWindowInsets,
      setWindowSize,
      setWindowPosition,
      updateInstanceWindowState,
    });

  const { dockIconOffset, getDockIconOffset } = useWindowFrameDockOffsets({
    appId,
    instanceId,
    windowPosition,
    windowSize,
  });

  const exposeTransform = useWindowFrameExposeTransform({
    exposeMode,
    instanceId,
    windowPosition,
    windowSize,
    isMobile,
  });

  const snapZoneStyle = useMemo(() => {
    if (!snapZone) return null;
    const { topInset, bottomInset } = computeWindowInsets();
    const height = window.innerHeight - topInset - bottomInset;
    const width = Math.floor(window.innerWidth / 2);
    return {
      top: topInset,
      height,
      width,
      left: snapZone === "left" ? 0 : width,
    };
  }, [snapZone, computeWindowInsets]);

  const shouldShow = keepMountedWhenMinimized
    ? isOpen
    : !isMinimized && isOpen;

  return (
    <>
      <WindowFrameSnapZoneIndicator
        snapZone={snapZone}
        snapZoneStyle={snapZoneStyle}
        isForeground={isForeground}
        isMacOSTheme={isMacOSTheme}
      />
      <AnimatePresence>
        {shouldShow && (
          <motion.div
            key={`pos-${instanceId || appId}`}
            data-window-instance-id={instanceId}
            className={cn(
              "absolute p-2 md:p-0",
              keepMountedWhenMinimized && isMinimized && "pointer-events-none"
            )}
            initial={false}
            animate={{
              left: windowPosition.x,
              top: Math.max(0, windowPosition.y),
              width: window.innerWidth >= 768 ? windowSize.width : "100%",
              height: Math.max(
                windowSize.height,
                mergedConstraints.minHeight || 0
              ),
              x: exposeTransform?.translateX ?? 0,
              y: exposeTransform?.translateY ?? 0,
              scale: exposeTransform?.scale ?? 1,
            }}
            transition={
              exposeMode
                ? { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
                : shouldAnimateWindowTransition
                  ? { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }
                  : { duration: 0 }
            }
            style={{
              minWidth:
                window.innerWidth >= 768 ? mergedConstraints.minWidth : "100%",
              minHeight: mergedConstraints.minHeight,
              maxWidth: mergedConstraints.maxWidth || undefined,
              maxHeight: mergedConstraints.maxHeight || undefined,
              zIndex: exposeTransform ? 10000 + exposeTransform.index : undefined,
              cursor: exposeMode ? "pointer" : undefined,
              transformOrigin: "center center",
            }}
            whileHover={
              exposeMode && exposeTransform
                ? { scale: exposeTransform.scale * 1.05, transition: { duration: 0.2 } }
                : undefined
            }
            onClick={(e) => {
              if (exposeMode && instanceId) {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent("exposeWindowSelect", { detail: { instanceId } })
                );
              }
            }}
          >
            <motion.div
              key={instanceId || appId}
              initial={getInitialAnimation({
                shouldAnimateRestore,
                dockIconOffset,
                isInitialMount,
              })}
              animate={getAnimateState({
                isClosing,
                keepMountedWhenMinimized,
                isMinimized,
                dockIconOffset,
                isShaking,
                shouldAnimateRestore,
              })}
              onAnimationComplete={() => {
                if (isClosing) {
                  handleCloseAnimationComplete();
                }
              }}
              exit={getExitAnimation({ keepMountedWhenMinimized, getDockIconOffset })}
              className={cn(
                "size-full select-none",
                isClosing && "pointer-events-none",
                keepMountedWhenMinimized && isMinimized && "pointer-events-none",
                exposeMode && "pointer-events-none"
              )}
              onClick={() => {
                if (!isForeground && instanceId) {
                  bringInstanceToForeground(instanceId);
                }
              }}
              style={{ transformOrigin: "center" }}
            >
              <div className="relative size-full">
                <WindowFrameResizeHandles
                  resizerZIndexClass={resizerZIndexClass}
                  showResizers={debugMode}
                  resizeType={resizeType}
                  isMobile={isMobile}
                  isNarrowScreen={isNarrowScreen}
                  isWindowsTheme={isWindowsTheme}
                  isMacOSTheme={isMacOSTheme}
                  handleResizeStartWithForeground={handleResizeStartWithForeground}
                  handleHeightOnlyMaximize={handleHeightOnlyMaximize}
                />

                <div
                  className={cn(
                    isWindowsTheme
                      ? "window flex flex-col h-full"
                      : isNoTitlebar && isMacOSTheme
                        ? "window size-full flex flex-col rounded-os overflow-hidden relative"
                        : "window size-full flex flex-col border-[length:var(--os-metrics-border-width)] border-os-window rounded-os overflow-hidden relative",
                    !effectiveTransparentBackground &&
                      !isWindowsTheme &&
                      "bg-os-window-bg",
                    !isWindowsTheme && (!isSystem7Theme || isForeground)
                      ? "shadow-os-window"
                      : "",
                    isForeground ? "is-foreground" : "",
                    isBrushedMetal && isMacOSTheme && "window-material-brushedmetal",
                    isNoTitlebar && isMacOSTheme && "window-material-notitlebar",
                    isGlassRegular && "window-material-glass"
                  )}
                  style={{
                    ...(!isWindowsTheme
                      ? getSwipeStyle(isPhone, isSwiping, swipeDirection)
                      : undefined),
                  }}
                  onMouseEnter={noTitlebarMouseHandlers.onMouseEnter}
                  onMouseMove={noTitlebarMouseHandlers.onMouseMove}
                  onMouseLeave={noTitlebarMouseHandlers.onMouseLeave}
                >
                  <WindowFrameTitleBar
                    isWindowsTheme={isWindowsTheme}
                    isMacOSTheme={isMacOSTheme}
                    isWinXp={isWinXp}
                    isForeground={isForeground}
                    isNoTitlebar={isNoTitlebar}
                    disableTitlebarAutoHide={effectiveDisableTitlebarAutoHide}
                    isTitlebarHovered={isTitlebarHovered}
                    effectiveTransparentBackground={effectiveTransparentBackground}
                    isBrushedMetal={isBrushedMetal}
                    isGlassSurface={isGlassRegular}
                    isTransparent={isTransparent}
                    showResizers={debugMode}
                    appId={appId}
                    title={title}
                    isPhone={isPhone}
                    titleBarRightContent={titleBarRightContent}
                    onCoverFlowToggle={onCoverFlowToggle}
                    isCoverFlowActive={isCoverFlowActive}
                    onFullscreenToggle={onFullscreenToggle}
                    handleMouseDownWithForeground={handleMouseDownWithForeground}
                    handleFullMaximize={handleFullMaximize}
                    handleTitleBarTap={handleTitleBarTap}
                    handleTouchStart={handleTouchStart}
                    handleTouchMove={handleTouchMove}
                    handleTouchEnd={handleTouchEnd}
                    handleClose={handleClose}
                    handleMinimize={handleMinimize}
                    showTitlebarWithAutoHide={showTitlebarWithAutoHide}
                  />

                  {isWindowsTheme && menuBar && (
                    <div
                      className="menubar-container"
                      style={{
                        background: "var(--button-face)",
                        borderBottom: "1px solid var(--button-shadow)",
                      }}
                    >
                      {menuBar}
                    </div>
                  )}

                  <div
                    className={cn(
                      "window-body flex flex-1 min-h-0 flex-col md:flex-row relative",
                      isBrushedMetal &&
                        isMacOSTheme &&
                        "ml-[8px] mr-[8px] mb-[8px] rounded-none overflow-hidden"
                    )}
                    style={
                      isWindowsTheme
                        ? { margin: isWinXp ? "0px 3px" : "0" }
                        : isMacOSTheme
                          ? isTransparent || isBrushedMetal || isAquaGlass
                            ? // Aqua Glass: let the single frosted `.window`
                              // surface show through so the titlebar + body read
                              // as one continuous pane (like brushed metal).
                              undefined
                            : isForeground
                              ? {
                                  backgroundColor: "var(--os-color-window-bg)",
                                  backgroundImage: "var(--os-pinstripe-window)",
                                }
                              : {
                                  backgroundColor: "rgba(255,255,255,0.6)",
                                  backgroundImage: "var(--os-pinstripe-window)",
                                }
                          : undefined
                    }
                  >
                    {children}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
