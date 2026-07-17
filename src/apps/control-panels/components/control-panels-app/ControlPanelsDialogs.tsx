import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { appMetadata } from "../..";

/**
 * Trimmed vs. MAIN's ControlPanelsDialogs: this fork has no ryOS
 * account/login/password/logout, cloud-sync force-upload/download, or
 * Telegram-link dialogs (those panes don't exist here — see CLAUDE.md).
 * Help + About are the only dialogs the six surviving panes need.
 */
export type ControlPanelsDialogsProps = {
  translatedHelpItems: { icon: string; title: string; description: string }[];
  isHelpDialogOpen: boolean;
  setIsHelpDialogOpen: (open: boolean) => void;
  isAboutDialogOpen: boolean;
  setIsAboutDialogOpen: (open: boolean) => void;
};

export function ControlPanelsDialogs({
  translatedHelpItems,
  isHelpDialogOpen,
  setIsHelpDialogOpen,
  isAboutDialogOpen,
  setIsAboutDialogOpen,
}: ControlPanelsDialogsProps) {
  return (
    <>
      <HelpDialog
        isOpen={isHelpDialogOpen}
        onOpenChange={setIsHelpDialogOpen}
        helpItems={translatedHelpItems}
        appId="control-panels"
      />
      <AboutDialog
        isOpen={isAboutDialogOpen}
        onOpenChange={setIsAboutDialogOpen}
        metadata={appMetadata}
        appId="control-panels"
      />
    </>
  );
}
