import * as React from "react";
import { useOsTheme } from "@/hooks/useOsTheme";
import { cn } from "@/lib/utils";

export interface SidebarRowProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/**
 * Master-detail sidebar list row. Under macosx the selected row gets the Aqua
 * selection gradient (`.aqua-row-selected`); other themes keep the muted
 * highlight the apps already used. Row padding keeps a ≥44px touch target.
 */
export const SidebarRow = React.forwardRef<
  HTMLButtonElement,
  SidebarRowProps
>(({ selected, className, ...props }, ref) => {
  const { isMacTheme } = useOsTheme();
  return (
    <button
      ref={ref}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "w-full text-left p-3 rounded-md transition-all touch-manipulation",
        isMacTheme
          ? cn("aqua-row", selected && "aqua-row-selected")
          : cn(
              "border",
              selected
                ? "bg-muted border-primary/40"
                : "hover:bg-muted/50 border-transparent"
            ),
        className
      )}
      {...props}
    />
  );
});
SidebarRow.displayName = "SidebarRow";
