import { useState, useEffect } from "react";
import { useThemeFlags } from "@/hooks/useThemeFlags";
import { useTranslation } from "react-i18next";
import type { ClockProps } from "./menuBarTypes";

/**
 * NOTE: trimmed from upstream — no `enableCalendarOpen` (this build has no
 * Calendar app) and no timezone-config integration; uses the browser's local
 * time, matching the pre-refactor Clock exactly.
 */
export function Clock({ enableExposeToggle = false }: ClockProps) {
  const [time, setTime] = useState(() => new Date());
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const { isWindowsTheme, isMacOSTheme } = useThemeFlags();
  const { t, i18n: i18nInstance } = useTranslation();

  // Get current locale from i18n (reactive to language changes)
  const currentLocale = i18nInstance.language || "en";

  // Determine if locale prefers 24-hour format
  const prefers24Hour = ["zh-CN", "zh-TW", "ja", "de", "fr", "ko"].includes(
    currentLocale
  );

  // Handle click to toggle expose view
  const handleClick = () => {
    if (enableExposeToggle) {
      window.dispatchEvent(new CustomEvent("toggleExposeView"));
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Helper function to format time without leading zeros for 24h format
  const formatTime24h = (date: Date): string => {
    const hour = date.getHours();
    const minute = date.getMinutes().toString().padStart(2, "0");
    return `${hour}:${minute}`;
  };

  // Use "numeric" for hour to avoid leading zeros (e.g., "0:08" instead of "00:08")
  const hourFormat = "numeric" as const;

  const formatTime12h = () =>
    time.toLocaleTimeString(currentLocale, {
      hour: hourFormat,
      minute: "2-digit",
      hour12: true,
    });

  let displayTime: string;

  if (isWindowsTheme) {
    displayTime = prefers24Hour ? formatTime24h(time) : formatTime12h();
  } else if (viewportWidth < 420) {
    displayTime = prefers24Hour ? formatTime24h(time) : formatTime12h();
  } else if (viewportWidth >= 420 && viewportWidth <= 768) {
    displayTime = prefers24Hour ? formatTime24h(time) : formatTime12h();
  } else {
    const timeString = prefers24Hour ? formatTime24h(time) : formatTime12h();

    if (currentLocale === "zh-CN" || currentLocale === "zh-TW") {
      const month = time.getMonth() + 1;
      const day = time.getDate();
      const weekday = time.toLocaleDateString(currentLocale, { weekday: "short" });
      displayTime = `${month}月${day}日 ${weekday} ${timeString}`;
    } else if (currentLocale === "ja") {
      const month = time.getMonth() + 1;
      const day = time.getDate();
      const weekday = time.toLocaleDateString(currentLocale, { weekday: "short" });
      displayTime = `${month}月${day}日 (${weekday}) ${timeString}`;
    } else if (currentLocale === "ko") {
      const month = time.getMonth() + 1;
      const day = time.getDate();
      const weekday = time.toLocaleDateString(currentLocale, { weekday: "short" });
      displayTime = `${month}월${day}일 (${weekday}) ${timeString}`;
    } else {
      const shortWeekday = time.toLocaleDateString(currentLocale, { weekday: "short" });
      const month = time.toLocaleDateString(currentLocale, { month: "short" });
      const day = time.getDate();
      displayTime = `${shortWeekday} ${month} ${day} ${timeString}`;
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Window drag handle for Tauri
    <div
      role="presentation"
      className={`${isWindowsTheme ? "" : "ml-auto mr-1 sm:mr-2"} whitespace-nowrap`}
      style={{
        textShadow: isMacOSTheme ? "0 2px 3px rgba(0, 0, 0, 0.25)" : undefined,
      }}
      onClick={handleClick}
      title={
        enableExposeToggle
          ? t("common.menuBar.showAllWindows", "Click to show all windows (F3)")
          : undefined
      }
    >
      {displayTime}
    </div>
  );
}
