import * as React from "react"

import { cn } from "@/lib/utils"
import { useThemeStore } from "@/stores/useThemeStore"

// Inline style palettes for the macosx theme, keyed by color scheme.
// These are inline styles (not CSS classes), so dark mode must be
// handled here explicitly — dark-aqua.css cannot override them.
const MAC_TEXTAREA_PALETTES = {
  light: {
    bg: "rgba(255, 255, 255, 1)",
    hoverBg: "rgba(0, 0, 0, 0.08)",
    border: "rgba(0, 0, 0, 0.2)",
    shadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)",
    focusBg: "#ffffff",
    focusBorder: "rgba(52, 106, 227, 0.6)",
    focusRing: "0 0 0 3px rgba(52, 106, 227, 0.25)",
    text: undefined as string | undefined,
  },
  dark: {
    bg: "rgba(0, 0, 0, 0.25)",
    hoverBg: "rgba(255, 255, 255, 0.08)",
    border: "rgba(255, 255, 255, 0.15)",
    shadow: "inset 0 1px 2px rgba(0, 0, 0, 0.4)",
    focusBg: "rgba(0, 0, 0, 0.3)",
    focusBorder: "rgba(96, 146, 227, 0.7)",
    focusRing: "0 0 0 3px rgba(96, 146, 227, 0.3)",
    text: "rgba(255, 255, 255, 0.9)" as string | undefined,
  },
};

function Textarea({ className, unstyled = false, style, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }: React.ComponentProps<"textarea"> & { unstyled?: boolean }) {
  const currentTheme = useThemeStore((state) => state.current);
  const isDark = useThemeStore((state) => state.isDark);
  const isMacOSTheme = currentTheme === "macosx";
  const isSystem7Theme = currentTheme === "system7";
  const pal = MAC_TEXTAREA_PALETTES[isMacOSTheme && isDark ? "dark" : "light"];

  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      style={{
        ...(isMacOSTheme &&
          !unstyled && {
            border: `1px solid ${pal.border}`,
            fontSize: "12px",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
            WebkitFontSmoothing: "antialiased",
            backgroundColor: pal.bg,
            boxShadow: pal.shadow,
            ...(pal.text ? { color: pal.text } : {}),
            transition: "all 0.2s ease",
          }),
        ...(isSystem7Theme &&
          !unstyled && {
            borderColor: "#000000",
            borderWidth: "1px",
            borderRadius: "0",
          }),
        ...style,
      }}
      onMouseEnter={(e) => {
        if (isMacOSTheme && !unstyled && e.currentTarget) {
          e.currentTarget.style.backgroundColor = pal.hoverBg;
        }
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (
          isMacOSTheme &&
          !unstyled &&
          e.currentTarget &&
          !e.currentTarget.matches(":focus")
        ) {
          e.currentTarget.style.backgroundColor = pal.bg;
          e.currentTarget.style.borderColor = pal.border;
          e.currentTarget.style.boxShadow = pal.shadow;
        }
        onMouseLeave?.(e);
      }}
      onFocus={(e) => {
        if (isMacOSTheme && !unstyled && e.currentTarget) {
          e.currentTarget.style.backgroundColor = pal.focusBg;
          e.currentTarget.style.borderColor = pal.focusBorder;
          e.currentTarget.style.boxShadow = pal.focusRing;
        }
        onFocus?.(e);
      }}
      onBlur={(e) => {
        if (isMacOSTheme && !unstyled && e.currentTarget) {
          e.currentTarget.style.backgroundColor = pal.bg;
          e.currentTarget.style.borderColor = pal.border;
          e.currentTarget.style.boxShadow = pal.shadow;
        }
        onBlur?.(e);
      }}
      {...props}
    />
  )
}

export { Textarea }
