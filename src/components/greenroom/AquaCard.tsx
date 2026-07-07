import * as React from "react";
import { Card } from "@/components/ui/card";
import { useOsTheme } from "@/hooks/useOsTheme";
import { cn } from "@/lib/utils";

export interface AquaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds a hover lift (pointer devices only) for clickable/actionable cards. */
  interactive?: boolean;
}

/**
 * Theme-adaptive card: a glossy Aqua gel surface under the macosx theme
 * (see `.aqua-card` in themes.css), a plain shadcn Card elsewhere. Use the
 * regular CardHeader/CardContent/CardFooter building blocks inside.
 */
export const AquaCard = React.forwardRef<HTMLDivElement, AquaCardProps>(
  ({ interactive, className, ...props }, ref) => {
    const { isMacTheme } = useOsTheme();
    if (isMacTheme) {
      return (
        <div
          ref={ref}
          className={cn(
            "aqua-card",
            interactive && "aqua-card-interactive",
            className
          )}
          {...props}
        />
      );
    }
    return (
      <Card
        ref={ref}
        className={cn(
          interactive && "transition-shadow hover:shadow-md",
          className
        )}
        {...props}
      />
    );
  }
);
AquaCard.displayName = "AquaCard";
