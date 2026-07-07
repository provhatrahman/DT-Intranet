import { useThemeStore } from "@/stores/useThemeStore";
import type { OsThemeId } from "@/themes/types";

export interface OsThemeFlags {
  themeId: OsThemeId;
  isMacTheme: boolean;
  isXpTheme: boolean;
  isSystem7Theme: boolean;
}

// Consolidates the theme-detection boilerplate repeated across app components
// (`currentTheme === "xp" || currentTheme === "win98"`, etc.).
export function useOsTheme(): OsThemeFlags {
  const themeId = useThemeStore((state) => state.current);
  return {
    themeId,
    isMacTheme: themeId === "macosx",
    isXpTheme: themeId === "xp" || themeId === "win98",
    isSystem7Theme: themeId === "system7",
  };
}
