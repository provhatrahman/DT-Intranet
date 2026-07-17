import { useState, useEffect } from "react";

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hasSmallScreen = window.innerWidth < breakpoint;
    return hasTouchScreen || hasSmallScreen;
  });

  useEffect(() => {
    const handleResize = () => {
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const hasSmallScreen = window.innerWidth < breakpoint;
      setIsMobile(hasTouchScreen || hasSmallScreen);
    };

    // Set initial value
    handleResize();

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [breakpoint]);

  return isMobile;
}

/**
 * Width-only variant of {@link useIsMobile} — ignores touch capability.
 *
 * Use this when the decision is purely about available screen real estate
 * (e.g. whether a window can be horizontally resized) rather than input type.
 * `useIsMobile` reports `true` on any touch-capable device, which wrongly flags
 * large touchscreen laptops as "mobile"; this hook only looks at viewport width,
 * matching the `window.innerWidth < 768` check used by the window resize logic.
 */
export function useIsNarrowScreen(breakpoint = 768) {
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsNarrow(window.innerWidth < breakpoint);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [breakpoint]);

  return isNarrow;
}
