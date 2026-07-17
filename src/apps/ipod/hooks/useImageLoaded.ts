import { useLayoutEffect, useRef, useState } from "react";

/**
 * Tracks whether the `<img>` referenced by `ref` has finished loading `src`.
 * Resets on `src` change. Catches browser-cached images that may already be
 * `complete` by the time the ref is attached (where `onLoad` won't fire).
 *
 * Uses `useLayoutEffect` so the cached-image check runs before paint, avoiding
 * a one-frame opacity-0 flicker on already-cached covers.
 *
 * `failed` turns true after `onError`, or when a cached/decoded `<img>` reports
 * `complete` but `naturalWidth === 0` (broken bitmap).
 */
export function useImageLoaded(src: string | null | undefined) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    setLoaded(false);
    setFailed(false);
    if (src == null || src === "") {
      return;
    }
    const img = ref.current;
    if (img && img.complete) {
      if (img.naturalWidth > 0) {
        setLoaded(true);
      } else {
        setFailed(true);
      }
    }
  }, [src]);

  return {
    ref,
    loaded,
    failed,
    onLoad: () => {
      setFailed(false);
      setLoaded(true);
    },
    onError: () => {
      setLoaded(false);
      setFailed(true);
    },
  };
}
