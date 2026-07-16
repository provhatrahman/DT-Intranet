import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/stores/useThemeStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface FeedbackDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (feedback: string) => void;
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  submitLabel?: string;
  showCancel?: boolean;
  // When true the comment is optional: Submit stays enabled with an empty
  // textarea and an empty string is passed to onSubmit.
  allowEmpty?: boolean;
}

export function FeedbackDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  title,
  description,
  value,
  onChange,
  isLoading = false,
  errorMessage = null,
  submitLabel,
  showCancel = true,
  allowEmpty = false,
}: FeedbackDialogProps) {
  const { t } = useTranslation();
  const currentTheme = useThemeStore((state) => state.current);
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  const isMacTheme = currentTheme === "macosx";
  // Use actual viewport width (not touch capability) to decide the mobile
  // layout — a touch-enabled desktop should still get the compact desktop
  // dialog rather than a full-width, full-width-button layout.
  const isMobile = useMediaQuery("(max-width: 768px)");
  const defaultSubmitLabel = submitLabel || t("common.dialog.save");
  const canSubmit = allowEmpty || value.trim().length > 0;

  const handleSubmit = () => {
    if (!isLoading && canSubmit) {
      onSubmit(value.trim());
    }
  };

  const dialogContent = (
    <div className={isXpTheme ? "p-2 px-4" : isMobile ? "p-4" : "p-4 px-6"}>
      <p
        className={cn(
          "text-gray-500 mb-2",
          isXpTheme
            ? "font-['Pixelated_MS_Sans_Serif',Arial] text-[11px]"
            : isMobile
            ? "font-geneva-12 text-sm"
            : "font-geneva-12 text-[12px]"
        )}
        style={{
          fontFamily: isXpTheme
            ? '"Pixelated MS Sans Serif", "ArkPixel", Arial'
            : undefined,
          fontSize: isXpTheme ? "11px" : undefined,
        }}
        id="dialog-description"
      >
        {description}
      </p>
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Provide feedback..."
        className={cn(
          "shadow-none",
          isMobile ? "min-h-[120px]" : "min-h-[100px]",
          isXpTheme
            ? "font-['Pixelated_MS_Sans_Serif',Arial] text-[11px]"
            : isMobile
            ? "font-geneva-12 text-sm"
            : "font-geneva-12 text-[12px]"
        )}
        style={{
          fontFamily: isXpTheme
            ? '"Pixelated MS Sans Serif", "ArkPixel", Arial'
            : undefined,
          fontSize: isXpTheme ? "11px" : undefined,
        }}
        disabled={isLoading}
      />
      {errorMessage && (
        <p className={cn(
          "text-red-600 mt-1",
          isMobile ? "text-sm" : "text-sm"
        )}>{errorMessage}</p>
      )}
      <DialogFooter className={cn(
        "mt-4 gap-1",
        isMobile ? "flex-col" : "sm:justify-end"
      )}>
        <div className={cn(
          "flex gap-2 w-full",
          isMobile ? "flex-col-reverse" : "flex-col-reverse sm:flex-row sm:w-auto"
        )}>
          {showCancel && (
            <Button
              variant={isMacTheme ? "secondary" : "retro"}
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className={cn(
                "w-full touch-manipulation",
                isMobile ? "min-h-[44px]" : "sm:w-auto",
                !isMacTheme && !isMobile && "h-7",
                isXpTheme
                  ? "font-['Pixelated_MS_Sans_Serif',Arial] text-[11px]"
                  : isMobile
                  ? "font-geneva-12 text-sm"
                  : "font-geneva-12 text-[12px]"
              )}
              style={{
                fontFamily: isXpTheme
                  ? '"Pixelated MS Sans Serif", "ArkPixel", Arial'
                  : undefined,
                fontSize: isXpTheme ? "11px" : undefined,
              }}
            >
              {t("common.dialog.cancel")}
            </Button>
          )}
          <Button
            variant={isMacTheme ? "default" : "retro"}
            onClick={handleSubmit}
            disabled={isLoading || !canSubmit}
            className={cn(
              "w-full touch-manipulation",
              isMobile ? "min-h-[44px]" : "sm:w-auto",
              !isMacTheme && !isMobile && "h-7",
              isXpTheme
                ? "font-['Pixelated_MS_Sans_Serif',Arial] text-[11px]"
                : isMobile
                ? "font-geneva-12 text-sm"
                : "font-geneva-12 text-[12px]"
            )}
            style={{
              fontFamily: isXpTheme
                ? '"Pixelated MS Sans Serif", "ArkPixel", Arial'
                : undefined,
              fontSize: isXpTheme ? "11px" : undefined,
            }}
          >
            {isLoading ? t("common.dialog.adding") : defaultSubmitLabel}
          </Button>
        </div>
      </DialogFooter>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          isMobile ? "max-w-[calc(100vw-2rem)]" : "max-w-[500px]",
          isXpTheme && "p-0 overflow-hidden"
        )}
        style={isXpTheme ? { fontSize: "11px" } : undefined}
        onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
      >
        {isXpTheme ? (
          <>
            <DialogHeader>{title}</DialogHeader>
            <div className="window-body">{dialogContent}</div>
          </>
        ) : currentTheme === "macosx" ? (
          <>
            <DialogHeader>{title}</DialogHeader>
            {dialogContent}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-normal text-[16px]">
                {title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {description}
              </DialogDescription>
            </DialogHeader>
            {dialogContent}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
