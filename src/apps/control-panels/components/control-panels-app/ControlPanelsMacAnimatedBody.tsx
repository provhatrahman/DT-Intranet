import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion } from "motion/react";
import { useResizeObserverWithRef } from "@/hooks/useResizeObserver";
import { useAppStore } from "@/stores/useAppStore";
import { cn } from "@/lib/utils";
import {
  CONTROL_PANELS_MAC_MAX_WINDOW_HEIGHT,
  CONTROL_PANELS_MAC_MIN_WINDOW_HEIGHT,
  CONTROL_PANELS_MACOSX_TITLEBAR_HEIGHT,
  CONTROL_PANELS_MAC_SIZE_TRANSITION,
} from "./controlPanelsMacMotion";

export type ControlPanelsMacAnimatedBodyProps = {
  instanceId?: string;
  toolbarHeight: number;
  /**
   * Title-bar height for the current theme (Aqua's 24px notitlebar spacer by
   * default). Used to convert the measured content height into a total window
   * height when auto-resizing.
   */
  titlebarHeight?: number;
  /** In-window menu-bar height, present on Windows themes. */
  menubarHeight?: number;
  /** Changes when Show All ↔ pane navigation occurs (drives re-measure). */
  navKey: string;
  children: ReactNode;
  className?: string;
};

export function ControlPanelsMacAnimatedBody({
  instanceId,
  toolbarHeight,
  titlebarHeight = CONTROL_PANELS_MACOSX_TITLEBAR_HEIGHT,
  menubarHeight = 0,
  navKey,
  children,
  className,
}: ControlPanelsMacAnimatedBodyProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const naturalHeightRef = useRef<number | null>(null);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(true);
  const lastWindowHeightRef = useRef<number | null>(null);
  const fixedChromeHeight = titlebarHeight + menubarHeight + toolbarHeight;

  const maxBodyHeight = Math.max(
    0,
    CONTROL_PANELS_MAC_MAX_WINDOW_HEIGHT - fixedChromeHeight
  );

  // The ACTUAL height the window currently offers (the h-full wrapper above
  // .control-panels-mac — its height comes from the window frame only, never
  // from our content, so observing it cannot feed back into the auto-height
  // measure loop). The animated body height below is clamped to this: the
  // constant window cap alone is not enough, because the real window can be
  // shorter than the cap (user drag-resize within min/max constraints, or a
  // small viewport clamping the frame). Without the clamp the body keeps its
  // capped height, overflows the frame (it's shrink-0), and its scrollbar is
  // clipped by the window edge with the bottom of the pane unreachable.
  const [wrapperHeight, setWrapperHeight] = useState<number | null>(null);
  useEffect(() => {
    // measure div → body (motion.div) → .control-panels-mac → h-full wrapper.
    const wrapper =
      measureRef.current?.parentElement?.parentElement?.parentElement;
    if (!wrapper || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect?.height;
      if (typeof height === "number" && height > 0) {
        setWrapperHeight(height);
      }
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // Space genuinely available to the body right now. The wrapper contains the
  // toolbar + body (the titlebar/menubar sit outside it in the window frame).
  const liveBodyCap =
    wrapperHeight === null
      ? maxBodyHeight
      : Math.max(0, Math.min(maxBodyHeight, wrapperHeight - toolbarHeight));

  const readNaturalHeight = useCallback(() => {
    const root = measureRef.current;
    if (!root) return;

    // The FIRST measure always runs unconstrained: data-scrollable is only set
    // once naturalHeight is known (and isMeasuring is false), so the initial
    // layout-effect measure (and the per-pane re-measure on navKey) reads the
    // true natural content height — the well auto-sizes to the tallest tab.
    //
    // Tabbed panes then scroll INSIDE the active tab panel (pinned tab bar) once
    // capped, which constrains this measure subtree. That can't reopen the old
    // Safari auto-size feedback loop: the high-water guard below freezes the
    // captured natural height, and we never try to recover it from the collapsed
    // inner scroller (the recovery math was what bounced on Safari). Simple panes
    // stay unconstrained — the body itself scrolls — so they measure naturally
    // on every pass.
    //
    // Use offsetHeight (the layout border-box height). A visual rect would also
    // include ancestor transforms, so the window's open/scale animation would
    // corrupt the first measurement (locking in a too-short Show All on initial
    // load, since a transform end fires no ResizeObserver to correct it).
    const next = root.offsetHeight;
    if (next <= 0) return;

    const prev = naturalHeightRef.current;
    // Within a single pane (same navKey) grow to fit, but don't shrink on content
    // swaps like switching tabs — the inactive tab panel is display:none, so the
    // stacked well reports only the active tab's height. Holding the high-water
    // mark keeps the window sized to the tallest tab so swaps don't jitter. The
    // navKey reset (below) re-baselines when navigating to a different pane.
    // Shrinks above the cap are allowed (the window is already maxed there).
    if (prev !== null && next < prev - 1 && next <= maxBodyHeight) return;
    if (prev === next) return;
    naturalHeightRef.current = next;
    setNaturalHeight(next);
  }, [maxBodyHeight]);

  const updateHeight = useCallback(() => {
    readNaturalHeight();
  }, [readNaturalHeight]);

  useResizeObserverWithRef(measureRef, updateHeight);

  useLayoutEffect(() => {
    naturalHeightRef.current = null;
    setNaturalHeight(null);
    setIsMeasuring(true);
    lastWindowHeightRef.current = null;
  }, [navKey]);

  useLayoutEffect(() => {
    if (!isMeasuring) return;
    readNaturalHeight();
    setIsMeasuring(false);
  }, [isMeasuring, readNaturalHeight, navKey]);

  // Belt-and-suspenders re-measure after navigating to a pane. The synchronous
  // layout-effect measure above can run before the pane's layout has fully
  // settled — theme CSS applied on the first paint, the toolbar height still
  // resolving, the async live theme preview / wallpaper thumbnails mounting, or
  // web fonts swapping in — any of which yields a first read that's too short and
  // leaves the window sized below the pane so its bottom is clipped with no way to
  // reach it. Re-read across the next couple of frames, once more shortly after,
  // and when fonts finish loading. readNaturalHeight only ever grows within a pane
  // (the high-water guard), so these follow-up reads can only correct an
  // under-measure upward — they never shrink the window or oscillate.
  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (!cancelled) readNaturalHeight();
    };
    const raf = requestAnimationFrame(() => requestAnimationFrame(measure));
    const timer = setTimeout(measure, 150);
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [navKey, readNaturalHeight]);

  // What the window auto-resize AIMS for (constant cap — navigation to a tall
  // pane must still grow the window even if it is currently small)…
  const desiredBodyHeight =
    naturalHeight === null ? undefined : Math.min(naturalHeight, maxBodyHeight);
  // …versus what the body may actually occupy on screen right now.
  const animatedHeight =
    naturalHeight === null ? undefined : Math.min(naturalHeight, liveBodyCap);
  const needsScroll =
    !isMeasuring &&
    naturalHeight !== null &&
    naturalHeight > liveBodyCap;

  // The minimum content area below the toolbar (window floor minus titlebar and
  // toolbar). The window auto-sizes to content but never shrinks below this floor,
  // so when content is short the window keeps the floored height and the body must
  // still fill it — otherwise a bare pinstripe band shows below the grid/pane (and,
  // while searching, below the spotlight scrim). CSS applies this as a `min-height`
  // on the BODY (so the light-mode content tint fills the full floored window) and,
  // while searching, as the floor on the grid so the scrim stretches to cover the
  // same area. Derived from the *constant* window floor + measured toolbar height
  // (never the measured content height), so it can't feed back into the auto-height
  // measure loop — the floor lives on the body, the parent of the measured node.
  const bodyFillMinHeight = Math.max(
    0,
    CONTROL_PANELS_MAC_MIN_WINDOW_HEIGHT - fixedChromeHeight
  );

  useLayoutEffect(() => {
    if (!instanceId || desiredBodyHeight === undefined) return;

    // Respect the window's min/max height: never auto-shrink below the configured
    // minimum (matches windowConstraints.minHeight) even when content is short.
    // Sized from desiredBodyHeight (constant cap), NOT the live-clamped render
    // height — otherwise a manually-shrunk window would stop auto-growing for
    // taller panes on navigation.
    const totalWindowHeight = Math.max(
      CONTROL_PANELS_MAC_MIN_WINDOW_HEIGHT,
      Math.min(
        CONTROL_PANELS_MAC_MAX_WINDOW_HEIGHT,
        fixedChromeHeight + desiredBodyHeight
      )
    );

    if (lastWindowHeightRef.current === totalWindowHeight) return;
    lastWindowHeightRef.current = totalWindowHeight;

    const { instances, updateInstanceWindowState } = useAppStore.getState();
    const instance = instances[instanceId];
    if (!instance) return;

    updateInstanceWindowState(
      instanceId,
      instance.position ?? { x: 100, y: 100 },
      {
        width: instance.size?.width ?? 440,
        height: totalWindowHeight,
      }
    );
  }, [instanceId, desiredBodyHeight, fixedChromeHeight]);

  return (
    <motion.div
      className={cn("control-panels-mac-body shrink-0 overflow-hidden", className)}
      data-scrollable={needsScroll ? true : undefined}
      style={
        {
          "--control-panels-mac-body-fill-min-height": bodyFillMinHeight
            ? `${bodyFillMinHeight}px`
            : undefined,
        } as CSSProperties
      }
      initial={false}
      animate={
        animatedHeight === undefined ? undefined : { height: animatedHeight }
      }
      transition={CONTROL_PANELS_MAC_SIZE_TRANSITION}
    >
      <div ref={measureRef} className="control-panels-mac-body-measure">
        <div className="control-panels-mac-body-layout">{children}</div>
      </div>
    </motion.div>
  );
}
