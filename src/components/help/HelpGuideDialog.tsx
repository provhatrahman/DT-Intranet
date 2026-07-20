import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useOsTheme } from "@/hooks/useOsTheme";
import { cn } from "@/lib/utils";
import { getTranslatedAppName, type AppId } from "@/utils/i18n";
import { GENERAL_HELP_APP_NAME } from "@/config/helpGuides";
import { HELP_GUIDES } from "./registry";
import type { HelpGuideId } from "./types";

export interface HelpGuideDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which guide to show; the dialog no-ops if it's missing/unknown. */
  guideId?: HelpGuideId;
}

/**
 * A multi-page, theme-aware help guide dialog. Each page pairs a short
 * explanation with a hand-built mockup "snapshot" of the app. Paging is pure
 * internal state so Back/Next never re-toggle the underlying Dialog (no
 * spurious open/close sounds). The theme structure mirrors `FormDialog`:
 * under macosx/xp the DialogHeader IS the window title bar, so an `sr-only`
 * DialogTitle is always rendered to satisfy Radix a11y.
 */
export default function HelpGuideDialog({
  isOpen,
  onOpenChange,
  guideId,
}: HelpGuideDialogProps) {
  const { t } = useTranslation();
  const { isMacTheme, isXpTheme } = useOsTheme();
  const isTitleBarTheme = isMacTheme || isXpTheme;
  const [pageIndex, setPageIndex] = useState(0);

  // Reset to the first page whenever the dialog opens or switches guide
  // (the desktop Help menu reuses one dialog across apps). Guarded on
  // `isOpen` so we don't flash page 0 during the close animation.
  useEffect(() => {
    if (isOpen) setPageIndex(0);
  }, [isOpen, guideId]);

  const guide = guideId ? HELP_GUIDES[guideId] : undefined;
  if (!guide || guide.pages.length === 0) {
    // Nothing to show — keep the Dialog closed but wired for onOpenChange.
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }

  const safeIndex = Math.min(pageIndex, guide.pages.length - 1);
  const page = guide.pages[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === guide.pages.length - 1;

  const displayAppName =
    guideId === "overview"
      ? GENERAL_HELP_APP_NAME
      : getTranslatedAppName(guideId as AppId);

  const goBack = () => setPageIndex((i) => Math.max(0, i - 1));
  const goNext = () => {
    if (isLast) onOpenChange(false);
    else setPageIndex((i) => Math.min(guide.pages.length - 1, i + 1));
  };

  const navFont = isXpTheme
    ? "font-['Pixelated_MS_Sans_Serif',Arial] text-[11px]"
    : "font-geneva-12 text-[12px]";
  const navFontStyle = isXpTheme
    ? {
        fontFamily: '"Pixelated MS Sans Serif", "ArkPixel", Arial',
        fontSize: "11px",
      }
    : undefined;

  const nav = (
    <div className="mt-4 flex items-center justify-between gap-2">
      <Button
        variant="retro"
        onClick={goBack}
        disabled={isFirst}
        className={cn("h-7", navFont)}
        style={navFontStyle}
      >
        {t("common.dialog.back", "Back")}
      </Button>

      <div
        className="flex items-center gap-1.5"
        role="status"
        aria-live="polite"
      >
        {guide.pages.map((p, i) => (
          <span
            key={p.id}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              i === safeIndex ? "bg-foreground" : "bg-foreground/25"
            )}
          />
        ))}
        <span className="sr-only">
          {t("common.dialog.pageXofY", "Page {{current}} of {{total}}", {
            current: safeIndex + 1,
            total: guide.pages.length,
          })}
        </span>
      </div>

      <Button
        variant={isMacTheme ? "default" : "retro"}
        onClick={goNext}
        className={cn(!isMacTheme && "h-7", navFont)}
        style={navFontStyle}
      >
        {isLast
          ? t("common.dialog.done", "Done")
          : t("common.dialog.next", "Next")}
      </Button>
    </div>
  );

  const body = (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        isXpTheme ? "p-2 px-4" : isMacTheme ? "px-4 pb-4 pt-3" : "px-6 pb-6"
      )}
    >
      <p
        className={cn(
          "mb-3 text-2xl",
          isXpTheme
            ? "font-['Pixelated_MS_Sans_Serif',Arial]"
            : "font-apple-garamond"
        )}
        style={{
          fontFamily: isXpTheme
            ? '"Pixelated MS Sans Serif", "ArkPixel", Arial'
            : undefined,
          fontSize: isXpTheme ? "18px" : undefined,
        }}
      >
        {t("common.dialog.welcomeTo", { appName: displayAppName })}
      </p>

      <ScrollArea className="max-h-[70dvh] overscroll-contain pr-3">
        <div className="space-y-3 px-1">
          <div>
            <h3
              className={cn(
                "text-base font-semibold",
                isXpTheme && "font-['Pixelated_MS_Sans_Serif',Arial] text-[13px]"
              )}
              style={
                isXpTheme
                  ? {
                      fontFamily:
                        '"Pixelated MS Sans Serif", "ArkPixel", Arial',
                      fontSize: "13px",
                    }
                  : undefined
              }
            >
              {page.title}
            </h3>
            <p
              className={cn(
                "mt-1 text-sm text-muted-foreground",
                isXpTheme && "font-['Pixelated_MS_Sans_Serif',Arial] text-[11px]"
              )}
              style={
                isXpTheme
                  ? {
                      fontFamily:
                        '"Pixelated MS Sans Serif", "ArkPixel", Arial',
                      fontSize: "11px",
                    }
                  : undefined
              }
            >
              {page.body}
            </p>
          </div>
          {page.snapshot}
        </div>
      </ScrollArea>

      {nav}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-[calc(100vw-2rem)] max-w-[720px]",
          isXpTheme && "overflow-hidden p-0"
        )}
        style={isXpTheme ? { fontSize: "11px" } : undefined}
      >
        {isTitleBarTheme ? (
          <>
            <DialogTitle className="sr-only">
              {t("common.dialog.welcomeTo", { appName: displayAppName })}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("common.dialog.informationAboutApp")}
            </DialogDescription>
            <DialogHeader>{t("common.dialog.help")}</DialogHeader>
            {isXpTheme ? <div className="window-body">{body}</div> : body}
          </>
        ) : (
          <>
            <DialogHeader className="px-6 pb-0 pt-6">
              <DialogTitle className="text-[16px] font-normal">
                {t("common.dialog.help")}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {t("common.dialog.informationAboutApp")}
              </DialogDescription>
            </DialogHeader>
            {body}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
