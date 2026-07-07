import * as React from "react";
import { useOsTheme } from "@/hooks/useOsTheme";
import { cn } from "@/lib/utils";

/**
 * Toolbar strip under the title bar: pinstriped with a hairline border under
 * macosx (matching Finder's toolbar treatment), muted background elsewhere.
 * Contents wrap on narrow windows/phones.
 */
export function AppToolbar({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isMacTheme } = useOsTheme();
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 px-3 py-2",
        isMacTheme ? "aqua-toolbar" : "border-b bg-muted/30",
        className
      )}
      {...props}
    />
  );
}
