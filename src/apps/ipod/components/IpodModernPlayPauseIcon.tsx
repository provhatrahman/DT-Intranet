import { useMemo } from "react";

/**
 * Inline SVG play/pause indicator for the modern iPod titlebar.
 *
 * Uses an embedded `<radialGradient>` so the glyph reads as a small glossy 3D
 * button (highlight biased upper-left, falling off to deeper blue). Each
 * instance gets a unique gradient id since SVG defs are document-scoped and
 * multiple icons may render at once.
 */
export function IpodModernPlayPauseIcon({
  playing,
  size = 10,
}: {
  playing: boolean;
  size?: number;
}) {
  const gradientId = useMemo(
    () => `ipod-modern-titlebar-grad-${Math.random().toString(36).slice(2)}`,
    []
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-label={playing ? "playing" : "paused"}
      role="img"
    >
      <defs>
        <radialGradient
          id={gradientId}
          cx="35%"
          cy="25%"
          r="85%"
          fx="35%"
          fy="20%"
        >
          <stop offset="0%" stopColor="rgb(170, 224, 255)" />
          <stop offset="45%" stopColor="rgb(60, 162, 230)" />
          <stop offset="100%" stopColor="rgb(36, 92, 148)" />
        </radialGradient>
      </defs>
      {playing ? (
        <path d="M8 5v14l11-7z" fill={`url(#${gradientId})`} />
      ) : (
        <g fill={`url(#${gradientId})`}>
          <rect x="6" y="5" width="4" height="14" rx="0.5" />
          <rect x="14" y="5" width="4" height="14" rx="0.5" />
        </g>
      )}
    </svg>
  );
}
