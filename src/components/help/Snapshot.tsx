import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A framed, non-interactive "snapshot" of an app screen for the help guides.
 *
 * The whole subtree is marked `inert` (React 19) so the fake buttons/inputs
 * inside it can be real, theme-correct components without ever entering the
 * tab order, taking pointer events, or appearing in the accessibility tree —
 * only the dialog's own Back/Next/Done controls are focusable. A slim faux
 * window title bar (three dots + optional label) makes each mockup read as a
 * captured screen rather than live UI.
 */
export function Snapshot({
  title,
  scrollable,
  className,
  bodyClassName,
  children,
}: {
  /** Optional label shown in the faux title bar. */
  title?: string;
  /** Allow the mockup to scroll horizontally (wide layouts on phones). */
  scrollable?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      inert
      aria-hidden
      className={cn(
        "relative select-none overflow-hidden rounded-lg border border-border bg-background shadow-sm",
        className
      )}
    >
      {/* Faux window title bar */}
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
        {title && (
          <span className="ml-2 truncate text-[11px] font-medium text-muted-foreground">
            {title}
          </span>
        )}
      </div>
      {/* Body — positioning context for absolute <Callout /> markers */}
      <div className={cn("relative", scrollable && "overflow-x-auto")}>
        <div className={cn("p-3", bodyClassName)}>{children}</div>
      </div>
    </div>
  );
}

/**
 * A numbered annotation pin (+ optional label pill) overlaid on a `Snapshot`,
 * positioned by percentage of the snapshot body. Purely decorative — it lives
 * inside the `inert` frame, so it never receives focus or pointer events.
 */
export function Callout({
  n,
  label,
  x,
  y,
  align = "right",
}: {
  /** Marker number. */
  n: number;
  /** Optional short label shown next to the marker. */
  label?: string;
  /** Horizontal position, 0–100 (% of the snapshot body). */
  x: number;
  /** Vertical position, 0–100 (% of the snapshot body). */
  y: number;
  /** Which side the label extends toward. Defaults to the right. */
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "absolute z-10 flex items-center gap-1.5",
        align === "left" && "flex-row-reverse"
      )}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background shadow ring-2 ring-background">
        {n}
      </span>
      {label && (
        <span className="whitespace-nowrap rounded-full bg-foreground/90 px-2 py-0.5 text-[10px] font-medium text-background shadow">
          {label}
        </span>
      )}
    </div>
  );
}
