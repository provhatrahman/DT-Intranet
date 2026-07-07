import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { useOsTheme } from "@/hooks/useOsTheme";
import { cn } from "@/lib/utils";

/**
 * Small labeled read-only fact tile (icon + caption + value), used in the
 * Archive summary grid and similar places. Renders as an inset `.aqua-well`
 * under macosx, a muted rounded tile elsewhere.
 */
export function InfoTile({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { isMacTheme } = useOsTheme();
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        isMacTheme ? "aqua-well" : "bg-muted/30",
        className
      )}
    >
      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium break-words">{children}</div>
      </div>
    </div>
  );
}
