import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOsTheme } from "@/hooks/useOsTheme";
import { cn } from "@/lib/utils";

/**
 * Theme-aware dialog shell for the Greenroom field-capture forms.
 *
 * Under macosx and xp/win98 the DialogHeader IS the window title bar, so the
 * title must be passed as plain text and the description/body rendered below
 * it (the pattern the built-in ryOS dialogs use); the system7 branch keeps
 * the in-flow header. The body scrolls inside a dvh-capped area so forms stay
 * usable with the on-screen keyboard open on phones, and the dialog width
 * leaves a margin on small screens.
 */
export function FormDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  footer,
  children,
  contentClassName,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  const { isMacTheme, isXpTheme } = useOsTheme();
  const isTitleBarTheme = isMacTheme || isXpTheme;

  const body = (
    <div
      className={cn(
        "flex flex-col min-h-0",
        isXpTheme ? "p-2 px-4" : isMacTheme ? "px-4 pb-4 pt-3" : "px-6 pb-6"
      )}
    >
      {description && (
        <p className="text-sm text-muted-foreground mb-3">{description}</p>
      )}
      <ScrollArea className="max-h-[60dvh] pr-3 overscroll-contain">
        {/* px-1 keeps outset control shadows (e.g. the aqua Select ring/glow,
            which sit outside the element box) from being clipped by the
            ScrollArea viewport's horizontal overflow. */}
        <div className="px-1">{children}</div>
      </ScrollArea>
      {footer && <DialogFooter className="mt-4 gap-1.5">{footer}</DialogFooter>}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("w-[calc(100vw-2rem)] max-w-lg", contentClassName)}
      >
        {isTitleBarTheme ? (
          <>
            <DialogTitle className="sr-only">{title}</DialogTitle>
            {description && (
              <DialogDescription className="sr-only">
                {description}
              </DialogDescription>
            )}
            <DialogHeader>{title}</DialogHeader>
            {isXpTheme ? <div className="window-body">{body}</div> : body}
          </>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6 pb-0">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="sr-only">
                {description ?? title}
              </DialogDescription>
            </DialogHeader>
            {body}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
