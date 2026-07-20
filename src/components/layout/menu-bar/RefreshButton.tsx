import { useTranslation } from "react-i18next";
import { ArrowClockwise } from "@phosphor-icons/react";
import { useThemeFlags } from "@/hooks/useThemeFlags";

export function RefreshButton() {
  const { t } = useTranslation();
  const { isWindowsTheme } = useThemeFlags();

  // Don't show on Windows themes (they have their own taskbar)
  if (isWindowsTheme) return null;

  const handleClick = () => {
    // Full page reload — reloads the desktop shell so every app refetches its
    // data from the API on mount. Simplest equivalent of a browser refresh,
    // which is otherwise awkward to trigger in an installed PWA.
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center justify-center px-1.5 py-0.5"
      style={{ marginRight: "4px" }}
      title={t("common.menuBar.refresh", "Refresh")}
      aria-label={t("common.menuBar.refresh", "Refresh")}
    >
      <ArrowClockwise aria-hidden="true" className="h-4 w-4" weight="bold" />
    </button>
  );
}
