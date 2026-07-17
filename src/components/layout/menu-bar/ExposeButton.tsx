import { useTranslation } from "react-i18next";
import { DotsThree } from "@phosphor-icons/react";
import { useThemeFlags } from "@/hooks/useThemeFlags";

export function ExposeButton() {
  const { t } = useTranslation();
  const { isWindowsTheme } = useThemeFlags();

  // Don't show on Windows themes (they have their own taskbar)
  if (isWindowsTheme) return null;

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("toggleExposeView"));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center justify-center px-1.5 py-0.5"
      style={{ marginRight: "4px" }}
      title={t("common.menuBar.missionControl", "Mission Control (F3)")}
      aria-label={t("common.menuBar.missionControl", "Mission Control (F3)")}
    >
      <DotsThree aria-hidden="true" className="h-4 w-4" weight="bold" />
    </button>
  );
}
