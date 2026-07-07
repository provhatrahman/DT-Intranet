import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Centered empty/loading placeholder for lists and grids.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  className,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-4 text-muted-foreground",
        className
      )}
    >
      {Icon && <Icon className="h-8 w-8 mb-3 opacity-40" aria-hidden />}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs mt-1 opacity-80 max-w-xs">{hint}</p>}
      {children}
    </div>
  );
}
