import * as React from "react"

import { cn } from "@/lib/utils"
import { useThemeStore } from "@/stores/useThemeStore"

function Textarea({ className, unstyled = false, style, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }: React.ComponentProps<"textarea"> & { unstyled?: boolean }) {
  const currentTheme = useThemeStore((state) => state.current);
  const isMacOSTheme = currentTheme === "macosx";
  const isSystem7Theme = currentTheme === "system7";

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
            border: "1px solid rgba(0, 0, 0, 0.2)",
            fontSize: "12px",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
            WebkitFontSmoothing: "antialiased",
            backgroundColor: "rgba(255, 255, 255, 1)",
            boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)",
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
          e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.08)";
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
          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 1)";
          e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.2)";
          e.currentTarget.style.boxShadow =
            "inset 0 1px 2px rgba(0, 0, 0, 0.1)";
        }
        onMouseLeave?.(e);
      }}
      onFocus={(e) => {
        if (isMacOSTheme && !unstyled && e.currentTarget) {
          e.currentTarget.style.backgroundColor = "#ffffff";
          e.currentTarget.style.borderColor = "rgba(52, 106, 227, 0.6)";
          e.currentTarget.style.boxShadow =
            "0 0 0 3px rgba(52, 106, 227, 0.25)";
        }
        onFocus?.(e);
      }}
      onBlur={(e) => {
        if (isMacOSTheme && !unstyled && e.currentTarget) {
          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 1)";
          e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.2)";
          e.currentTarget.style.boxShadow =
            "inset 0 1px 2px rgba(0, 0, 0, 0.1)";
        }
        onBlur?.(e);
      }}
      {...props}
    />
  )
}

export { Textarea }
