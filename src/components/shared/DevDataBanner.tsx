import { cn } from "@/lib/utils";

const IS_DEV = import.meta.env.DEV;

export type SourceStatus = "live" | "dummy" | "broken" | "hidden";

export interface DevDataSource {
  label: string;
  status: SourceStatus;
  detail?: string;
}

const STATUS_CONFIG: Record<SourceStatus, { dot: string; text: string; bg: string; border: string }> = {
  live: {
    dot: "bg-green-500",
    text: "text-green-800",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  dummy: {
    dot: "bg-amber-500",
    text: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  broken: {
    dot: "bg-red-500",
    text: "text-red-800",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  hidden: {
    dot: "bg-gray-400",
    text: "text-gray-600",
    bg: "bg-gray-50",
    border: "border-gray-200",
  },
};

interface DevDataBannerProps {
  sources: DevDataSource[];
  className?: string;
}

export function DevDataBanner({ sources, className }: DevDataBannerProps) {
  if (!IS_DEV) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-b text-[10px] font-mono select-none",
        "bg-zinc-950/90 border-zinc-800",
        className
      )}
      title="Dev only — data source status"
    >
      <span className="text-zinc-500 mr-0.5 shrink-0">DEV</span>
      {sources.map((source) => {
        const cfg = STATUS_CONFIG[source.status];
        return (
          <span
            key={source.label}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono",
              cfg.bg,
              cfg.border,
              cfg.text
            )}
            title={`${source.label}: ${source.status}${source.detail ? ` — ${source.detail}` : ""}`}
          >
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
            {source.label}
            {source.detail && (
              <span className="opacity-60">{source.detail}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

interface DevDataChipProps {
  status: SourceStatus;
  label: string;
  detail?: string;
  className?: string;
}

/**
 * Inline per-card variant of DevDataBanner. Only renders in DEV.
 */
export function DevDataChip({ status, label, detail, className }: DevDataChipProps) {
  if (!IS_DEV) return null;
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono select-none",
        cfg.bg,
        cfg.border,
        cfg.text,
        className
      )}
      title={`${label}: ${status}${detail ? ` — ${detail}` : ""}`}
    >
      <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {label}
      {detail && <span className="opacity-60">{detail}</span>}
    </span>
  );
}
