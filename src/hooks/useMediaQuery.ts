import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  // Initialize from the actual match synchronously so the first render is
  // correct. A false-until-effect default makes mobile look like desktop on
  // mount, which e.g. lets list/detail apps auto-select the first row before
  // the query resolves. Guarded for non-DOM (SSR) environments.
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
