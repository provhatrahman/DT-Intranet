import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/stores/useThemeStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export interface IpodAddTrackInput {
  url: string;
  title: string;
  artist: string;
}

interface IpodAddDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: IpodAddTrackInput) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

/**
 * Add Song dialog for the iPod. Collects the YouTube link plus the song title
 * and artist so the shared library stores exactly what the user typed (no
 * reliance on auto-detected metadata). URL and title are required; artist is
 * optional.
 */
export function IpodAddDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  isLoading = false,
  errorMessage = null,
}: IpodAddDialogProps) {
  const { t } = useTranslation();
  const currentTheme = useThemeStore((state) => state.current);
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  const isMacTheme = currentTheme === "macosx";

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Reset the form whenever the dialog is (re)opened.
  useEffect(() => {
    if (isOpen) {
      setUrl("");
      setTitle("");
      setArtist("");
      // Focus after the dialog mounts.
      const id = setTimeout(() => firstFieldRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  const canSubmit = url.trim().length > 0 && title.trim().length > 0;

  const handleSubmit = () => {
    if (!isLoading && canSubmit) {
      onSubmit({ url: url.trim(), title: title.trim(), artist: artist.trim() });
    }
  };

  const fontClass = isXpTheme
    ? "font-['Pixelated_MS_Sans_Serif',Arial] text-[11px]"
    : "font-geneva-12 text-[12px]";
  const fontStyle = isXpTheme
    ? {
        fontFamily: '"Pixelated MS Sans Serif", "ArkPixel", Arial',
        fontSize: "11px",
      }
    : undefined;

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    opts?: { ref?: React.RefObject<HTMLInputElement | null>; required?: boolean }
  ) => (
    <div className="mb-2">
      <label className={cn("block text-gray-500 mb-1", fontClass)} style={fontStyle}>
        {label}
      </label>
      <Input
        ref={opts?.ref as React.RefObject<HTMLInputElement>}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && !isLoading && canSubmit) {
            handleSubmit();
          }
        }}
        className={cn("shadow-none", fontClass)}
        style={fontStyle}
        disabled={isLoading}
      />
    </div>
  );

  const dialogContent = (
    <div className={isXpTheme ? "p-2 px-4" : "p-4 px-6"}>
      {field(
        t("apps.ipod.dialogs.addSongUrlLabel"),
        url,
        setUrl,
        t("apps.ipod.dialogs.addSongUrlPlaceholder"),
        { ref: firstFieldRef, required: true }
      )}
      {field(
        t("apps.ipod.dialogs.addSongTitleLabel"),
        title,
        setTitle,
        t("apps.ipod.dialogs.addSongTitlePlaceholder"),
        { required: true }
      )}
      {field(
        t("apps.ipod.dialogs.addSongArtistLabel"),
        artist,
        setArtist,
        t("apps.ipod.dialogs.addSongArtistPlaceholder")
      )}
      {errorMessage && (
        <p className="text-red-600 text-sm mt-1">{errorMessage}</p>
      )}
      <DialogFooter className="mt-4 gap-1 sm:justify-end">
        <div className="flex flex-col-reverse gap-2 w-full sm:w-auto sm:flex-row">
          <Button
            variant={isMacTheme ? "secondary" : "retro"}
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className={cn("w-full sm:w-auto", !isMacTheme && "h-7", fontClass)}
            style={fontStyle}
          >
            {t("common.dialog.cancel")}
          </Button>
          <Button
            variant={isMacTheme ? "default" : "retro"}
            onClick={handleSubmit}
            disabled={isLoading || !canSubmit}
            className={cn("w-full sm:w-auto", !isMacTheme && "h-7", fontClass)}
            style={fontStyle}
          >
            {isLoading
              ? t("common.dialog.adding")
              : t("apps.ipod.dialogs.addSongSubmit")}
          </Button>
        </div>
      </DialogFooter>
    </div>
  );

  const dialogTitle = t("apps.ipod.dialogs.addSongTitle");
  const dialogDescription = t("apps.ipod.dialogs.addSongDescription");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-w-[500px]", isXpTheme && "p-0 overflow-hidden")}
        style={isXpTheme ? { fontSize: "11px" } : undefined}
        onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
      >
        {isXpTheme ? (
          <>
            <DialogHeader>{dialogTitle}</DialogHeader>
            <div className="window-body">{dialogContent}</div>
          </>
        ) : isMacTheme ? (
          <>
            <DialogHeader>{dialogTitle}</DialogHeader>
            {dialogContent}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-normal text-[16px]">
                {dialogTitle}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {dialogDescription}
              </DialogDescription>
            </DialogHeader>
            {dialogContent}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
