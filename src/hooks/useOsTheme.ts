import { useThemeStore } from "@/stores/useThemeStore";
import type { OsThemeId } from "@/themes/types";

export interface OsThemeFlags {
  themeId: OsThemeId;
  isMacTheme: boolean;
  isXpTheme: boolean;
  isSystem7Theme: boolean;
  /**
   * Whether dark mode is currently active. Dark mode only exists on the
   * macosx theme today (see `docs/3.3.1-theme-architecture.md`), so this is
   * effectively `isMacTheme && <dark preference in effect>`, but callers
   * should still gate any dark-specific styling on this flag rather than
   * assuming `isMacTheme` implies light.
   */
  isDarkMode: boolean;
}

// Consolidates the theme-detection boilerplate repeated across app components
// (`currentTheme === "xp" || currentTheme === "win98"`, etc.).
export function useOsTheme(): OsThemeFlags {
  const themeId = useThemeStore((state) => state.current);
  const isDarkMode = useThemeStore((state) => state.isDark);
  return {
    themeId,
    isMacTheme: themeId === "macosx",
    isXpTheme: themeId === "xp" || themeId === "win98",
    isSystem7Theme: themeId === "system7",
    isDarkMode,
  };
}
