// Constants + helpers for the iPod app's "modern" (iOS-style color) screen skin.
// The CSS for this skin already lives in src/index.css (.ipod-modern-*) and
// src/styles/themes/aqua.css (.ipod-modern-screen .aqua-progress*); these values
// mirror the geometry ryOS main uses so the React layer lines up with that CSS.

import type { Track } from "@/stores/useIpodStore";

export type IpodUiVariant = "classic" | "modern";

export function isModernIpodUiVariant(variant: IpodUiVariant | undefined | null) {
  return variant === "modern";
}

// --- Modern screen geometry -------------------------------------------------
export const IPOD_MODERN_SCREEN_HEIGHT_PX = 152; // outer, includes border-2
export const MODERN_TITLEBAR_HEIGHT = 16;
export const IPOD_MODERN_MENU_BODY_HEIGHT_PX = 132; // 148 drawable - 16 titlebar
export const MENU_ITEM_HEIGHT_MODERN = 22;

// --- Modern now-playing artwork --------------------------------------------
export const MODERN_NOW_PLAYING_ART_PX = 60;
export const MODERN_NOW_PLAYING_REFLECT_RATIO = 0.3;
export const NP_CROSSFADE_MS = 320;
export const COVER_FADE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
export const COVER_FADE_TRANSITION = `opacity ${NP_CROSSFADE_MS}ms ${COVER_FADE_EASING}`;

// --- Cover art --------------------------------------------------------------

/** Extract the 11-char YouTube video id from a URL (watch / youtu.be / embed). */
export function getYouTubeVideoId(url: string | undefined | null): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Resolve album art for a track. This fork's tracks are YouTube-only, so we
 * derive the thumbnail from the video id. `hqdefault` is used deliberately —
 * `maxresdefault` 404s for many videos, which would flash the placeholder.
 */
export function resolveTrackCoverUrl(
  track: Pick<Track, "url"> | null | undefined
): string | null {
  const videoId = getYouTubeVideoId(track?.url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
}
