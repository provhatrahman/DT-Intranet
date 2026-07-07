import { Badge } from "@/components/ui/badge";
import { useOsTheme } from "@/hooks/useOsTheme";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "green"
  | "blue"
  | "red"
  | "yellow"
  | "purple"
  | "gray";

// One status → tone map for the whole Greenroom domain: project statuses,
// pitch statuses, payment statuses. Replaces the per-app statusBadgeClasses
// helpers that had drifted apart.
const STATUS_TONES: Record<string, BadgeTone> = {
  // Projects
  active: "green",
  completed: "blue",
  on_hold: "yellow",
  cancelled: "red",
  archived: "purple",
  // Pitches
  draft: "gray",
  submitted: "yellow",
  under_review: "yellow",
  approved: "green",
  implemented: "green",
  rejected: "red",
  closed: "red",
  // Payments / bookings
  pending: "yellow",
  issued: "blue",
  paid: "green",
  overdue: "red",
  confirmed: "green",
  declined: "red",
};

// Non-macosx themes keep the flat tinted badge look the apps already used.
const TONE_CLASSES: Record<BadgeTone, string> = {
  green: "bg-green-100 text-green-800 border-green-200",
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  red: "bg-red-100 text-red-800 border-red-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
  purple: "bg-purple-100 text-purple-800 border-purple-200",
  gray: "bg-gray-100 text-gray-800 border-gray-200",
};

function prettifyStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export interface StatusBadgeProps {
  /** Backend status value; drives the tone unless `tone` is given. */
  status: string;
  /** Display text; defaults to a title-cased version of `status`. */
  label?: string;
  /** Explicit tone override (e.g. for source badges that aren't statuses). */
  tone?: BadgeTone;
  className?: string;
}

/**
 * Theme-adaptive status pill: a candy gel `.aqua-pill` under macosx, a flat
 * tinted outline Badge elsewhere.
 */
export function StatusBadge({
  status,
  label,
  tone,
  className,
}: StatusBadgeProps) {
  const { isMacTheme } = useOsTheme();
  const resolvedTone = tone ?? STATUS_TONES[status] ?? "gray";
  const text = label ?? prettifyStatus(status);

  if (isMacTheme) {
    return (
      <span className={cn("aqua-pill", resolvedTone, className)}>
        <span>{text}</span>
      </span>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn("text-xs", TONE_CLASSES[resolvedTone], className)}
    >
      {text}
    </Badge>
  );
}
