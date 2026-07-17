import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { useOsTheme } from "@/hooks/useOsTheme";
import { cn } from "@/lib/utils";

export type NoticeTone = "info" | "warning" | "error" | "neutral";

const MAC_TONE: Record<NoticeTone, string> = {
  info: "aqua-well blue",
  warning: "aqua-well yellow",
  error: "aqua-well red",
  neutral: "aqua-well",
};

const FLAT_TONE: Record<NoticeTone, string> = {
  info: "bg-blue-50 border border-blue-200",
  warning: "bg-yellow-50 border border-yellow-200",
  error: "bg-red-50 border border-red-200",
  neutral: "bg-gray-50 border border-gray-200",
};

const ICON_TONE: Record<NoticeTone, string> = {
  // The dark-mode aqua-well tints (see src/styles/greenroom.css) are dark
  // washes rather than the light theme's pale tints, so the icon needs a
  // lighter shade of the same hue to stay legible; `neutral` is covered by
  // dark-aqua.css's generic `.text-gray-500` remap already.
  info: "text-blue-700 dark:text-blue-300",
  warning: "text-yellow-700 dark:text-yellow-300",
  error: "text-red-700 dark:text-red-300",
  neutral: "text-gray-500",
};

/**
 * Inline notice/alert panel (account-required prompts, dev-mode banners,
 * inline errors). Tinted inset well under macosx, flat tinted panel elsewhere.
 */
export function NoticePanel({
  tone = "neutral",
  icon: Icon,
  title,
  className,
  children,
}: {
  tone?: NoticeTone;
  icon?: LucideIcon;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const { isMacTheme } = useOsTheme();
  return (
    <div
      className={cn(
        "p-4 rounded-lg",
        isMacTheme ? MAC_TONE[tone] : FLAT_TONE[tone],
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <Icon
            className={cn("h-4 w-4 mt-0.5 shrink-0", ICON_TONE[tone])}
            aria-hidden
          />
        )}
        <div className="flex-1 min-w-0 text-sm">
          {title && <p className="font-medium mb-1">{title}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
