import React from "react";
import { resolveIconLegacyAware, useIconPath } from "@/utils/icons";
import { useThemeStore } from "@/stores/useThemeStore"; // assuming this exists
import { cn } from "@/lib/utils";

export interface ThemedIconProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  name: string; // file name or relative path within theme folder
  alt?: string;
  themeOverride?: string | null; // manual override theme id
  // Unread-style counter badge (e.g. Inbox app icon). undefined/0 renders
  // exactly as before this feature existed — no wrapper, no visual change.
  badge?: number;
  // "count": red circle with the number (or "9+"). "dot": small red dot, no
  // text — used for icon sites too small to legibly show a number.
  badgeVariant?: "count" | "dot";
}

// Shared badge visuals so every call site (dock, desktop, start menu, apple
// menu, taskbar) renders an identical red badge regardless of icon size.
const BadgeOverlay: React.FC<{ count: number; variant: "count" | "dot" }> = ({
  count,
  variant,
}) => {
  if (variant === "dot") {
    return (
      <span
        aria-hidden
        className="absolute -top-0.5 -right-0.5 rounded-full bg-red-500"
        style={{
          width: 8,
          height: 8,
          boxShadow: "0 0 0 1px white",
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-red-500 text-white font-bold px-1"
      style={{
        minWidth: 14,
        height: 14,
        fontSize: 10,
        lineHeight: "10px",
        boxShadow: "0 0 0 1px white",
      }}
    >
      {count > 9 ? "9+" : String(count)}
    </span>
  );
};

const SAFARI_TRANSLATE_FIX = "translateZ(0.00001px)";
const SAFARI_USER_AGENT =
  typeof navigator !== "undefined" ? navigator.userAgent : "";
const SAFARI_DETECTION_REGEX = /safari/i;
const SAFARI_EXCLUDES_REGEX = /chrome|crios|chromium|android|edge|opr|fxios/i;

const isSafariBrowser =
  typeof navigator !== "undefined" &&
  SAFARI_DETECTION_REGEX.test(SAFARI_USER_AGENT) &&
  !SAFARI_EXCLUDES_REGEX.test(SAFARI_USER_AGENT);

const appendTranslateLayer = (value?: string) => {
  if (!value || value.trim().length === 0) {
    return SAFARI_TRANSLATE_FIX;
  }
  if (/\btranslate(?:3d|Z)\(/i.test(value)) {
    return value;
  }
  return `${value} ${SAFARI_TRANSLATE_FIX}`;
};

const ensureWillChangeTransform = (
  value: React.CSSProperties["willChange"]
): React.CSSProperties["willChange"] => {
  if (!value) return "transform";
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.includes("transform")) {
    return value;
  }
  tokens.push("transform");
  return tokens.join(", ");
};

const applySafariImageStabilizer = (
  style?: React.CSSProperties
): React.CSSProperties => {
  const nextStyle: React.CSSProperties = { ...(style ?? {}) };
  nextStyle.transform = appendTranslateLayer(
    typeof nextStyle.transform === "string"
      ? nextStyle.transform
      : undefined
  );
  if (!nextStyle.WebkitTransform) {
    nextStyle.WebkitTransform = nextStyle.transform;
  }
  if (!nextStyle.backfaceVisibility) {
    nextStyle.backfaceVisibility = "hidden";
  }
  if (!nextStyle.WebkitBackfaceVisibility) {
    nextStyle.WebkitBackfaceVisibility = "hidden";
  }
  nextStyle.willChange = ensureWillChangeTransform(
    typeof nextStyle.willChange === "string"
      ? nextStyle.willChange
      : undefined
  );
  return nextStyle;
};

export const ThemedIcon: React.FC<ThemedIconProps> = ({
  name,
  alt,
  themeOverride,
  badge,
  badgeVariant = "count",
  ...imgProps
}) => {
  const currentTheme = useThemeStore?.((s: any) => s.current) || null;
  const { className, style, ...restImgProps } = imgProps;
  const composedClassName = cn("themed-icon", className);
  const showBadge = !!badge && badge > 0;

  // Simple passthrough for remote resources (avoid theming logic entirely)
  if (/^https?:\/\//i.test(name)) {
    const img = (
      <img
        src={name}
        alt={alt || name}
        className={composedClassName}
        style={style}
        {...restImgProps}
      />
    );
    if (!showBadge) return img;
    return (
      <span className="relative inline-flex">
        {img}
        <BadgeOverlay count={badge as number} variant={badgeVariant} />
      </span>
    );
  }

  // Legacy-aware initial resolution (may already be themed path or absolute /icons/...)
  const resolved = resolveIconLegacyAware(name, themeOverride ?? currentTheme);

  // If result is a remote URL (in case resolver passed one through) just use it.
  if (/^https?:\/\//i.test(resolved)) {
    const img = (
      <img
        src={resolved}
        alt={alt || name}
        className={composedClassName}
        style={style}
        {...restImgProps}
      />
    );
    if (!showBadge) return img;
    return (
      <span className="relative inline-flex">
        {img}
        <BadgeOverlay count={badge as number} variant={badgeVariant} />
      </span>
    );
  }

  // Derive logical name for async theming only if inside /icons/ path.
  // Strip any query string to avoid duplicating cache-busting params downstream.
  const withoutQuery = resolved.split("?")[0];
  const logical = withoutQuery.startsWith("/icons/")
    ? withoutQuery
        .replace("/icons/default/", "")
        .replace(/^(?:\/icons\/[^/]+\/)/, "")
    : withoutQuery;

  const themedPath = useIconPath(logical, themeOverride ?? currentTheme);

  // Keep it simple: if async path still pending, show resolved immediately. Avoid switching for remote URLs.
  const src = themedPath || resolved;
  const normalizedSrc = src.split("?")[0];
  const isThemedVariant =
    normalizedSrc.startsWith("/icons/") &&
    !normalizedSrc.startsWith("/icons/default/");
  const finalStyle =
    isSafariBrowser && isThemedVariant
      ? applySafariImageStabilizer(style)
      : style;

  const img = (
    <img
      src={src}
      data-initial-src={resolved}
      alt={alt || name}
      className={composedClassName}
      style={finalStyle}
      {...restImgProps}
    />
  );
  if (!showBadge) return img;
  return (
    <span className="relative inline-flex">
      {img}
      <BadgeOverlay count={badge as number} variant={badgeVariant} />
    </span>
  );
};
