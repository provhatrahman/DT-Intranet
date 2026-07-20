import { useState, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from "@/components/ui/menubar";
import { ShortcutHint } from "@/components/shared/menubar/ShortcutHint";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { useLaunchApp } from "@/hooks/useLaunchApp";
import { ThemedIcon } from "@/components/shared/ThemedIcon";
import { appMetadata as finderMetadata } from "@/apps/finder";
import { getTranslatedAppName, type AppId } from "@/utils/i18n";
import { HELP_GUIDE_APP_IDS } from "@/config/helpGuides";

// Lazily loaded so the (eager) desktop menu bar doesn't pull the help-guide
// mockups + greenroom UI kit into the initial bundle.
const HelpGuideDialog = lazy(() => import("@/components/help/HelpGuideDialog"));

/**
 * Placeholder Finder-style menu bar shown when no app window is in the
 * foreground. Undo/Redo are always disabled here (no cross-app undo stack in
 * this build); apps with real undo/redo supply their own menu bar.
 */
export function DefaultMenuItems() {
  const { t } = useTranslation();
  const launchApp = useLaunchApp();
  const [activeHelp, setActiveHelp] = useState<AppId | "general" | null>(null);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);

  const handleLaunchFinder = (path: string) => {
    launchApp("finder", { initialPath: path });
  };

  return (
    <>
      {/* File Menu */}
      <MenubarMenu>
        <MenubarTrigger className="text-md px-2 py-1 border-none focus-visible:ring-0">
          {t("common.menu.file")}
        </MenubarTrigger>
        <MenubarContent align="start" sideOffset={1} className="px-0">
          <MenubarItem
            onClick={() => handleLaunchFinder("/")}
            className="text-md h-6 px-3"
          >
            {t("apps.finder.menu.newFinderWindow")}
          </MenubarItem>
          <MenubarItem disabled className="text-md h-6 px-3">
            {t("apps.finder.menu.newFolder")}
          </MenubarItem>
          <MenubarSeparator className="h-[2px] bg-black my-1" />
          <MenubarItem
            disabled
            className="text-md h-6 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("apps.finder.menu.moveToTrash")}
          </MenubarItem>
          <MenubarItem
            disabled
            className="text-md h-6 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("apps.finder.menu.emptyTrash")}
          </MenubarItem>
          <MenubarSeparator className="h-[2px] bg-black my-1" />
          <MenubarItem disabled className="text-md h-6 px-3">
            {t("common.menu.close")}
            <ShortcutHint id="close" />
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Go Menu */}
      <MenubarMenu>
        <MenubarTrigger className="text-md px-2 py-1 border-none focus-visible:ring-0">
          {t("common.menu.go")}
        </MenubarTrigger>
        <MenubarContent align="start" sideOffset={1} className="px-0">
          <MenubarItem
            disabled
            className="text-md h-6 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("apps.finder.menu.back")}
          </MenubarItem>
          <MenubarItem
            disabled
            className="text-md h-6 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("apps.finder.menu.forward")}
          </MenubarItem>
          <MenubarSeparator className="h-[2px] bg-black my-1" />
          <MenubarItem
            onClick={() => handleLaunchFinder("/Applications")}
            className="text-md h-6 px-3 flex items-center gap-2"
          >
            <ThemedIcon
              name="applications.png"
              alt={t("common.menu.applications")}
              className="w-4 h-4 [image-rendering:pixelated]"
            />
            {t("common.menu.applications")}
          </MenubarItem>
          <MenubarItem
            onClick={() => handleLaunchFinder("/Documents")}
            className="text-md h-6 px-3 flex items-center gap-2"
          >
            <ThemedIcon
              name="documents.png"
              alt={t("common.menu.documents")}
              className="w-4 h-4 [image-rendering:pixelated]"
            />
            {t("common.menu.documents")}
          </MenubarItem>
          <MenubarItem
            onClick={() => handleLaunchFinder("/Images")}
            className="text-md h-6 px-3 flex items-center gap-2"
          >
            <ThemedIcon
              name="images.png"
              alt={t("common.menu.images")}
              className="w-4 h-4 [image-rendering:pixelated]"
            />
            {t("common.menu.images")}
          </MenubarItem>
          <MenubarItem
            onClick={() => handleLaunchFinder("/Music")}
            className="text-md h-6 px-3 flex items-center gap-2"
          >
            <ThemedIcon
              name="sounds.png"
              alt={t("common.menu.music")}
              className="w-4 h-4 [image-rendering:pixelated]"
            />
            {t("common.menu.music")}
          </MenubarItem>
          <MenubarItem
            onClick={() => handleLaunchFinder("/Trash")}
            className="text-md h-6 px-3 flex items-center gap-2"
          >
            <ThemedIcon
              name="trash-empty.png"
              alt={t("common.menu.trash")}
              className="w-4 h-4 [image-rendering:pixelated]"
            />
            {t("common.menu.trash")}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* Help Menu */}
      <MenubarMenu>
        <MenubarTrigger className="text-md px-2 py-1 border-none focus-visible:ring-0">
          {t("common.menu.help")}
        </MenubarTrigger>
        <MenubarContent align="start" sideOffset={1} className="px-0">
          <MenubarItem
            onClick={() => setActiveHelp("general")}
            className="text-md h-6 px-3"
          >
            {t("common.menu.howToUseGreenroom", "How to use Greenroom")}
          </MenubarItem>
          <MenubarSeparator className="h-[2px] bg-black my-1" />
          {HELP_GUIDE_APP_IDS.map((id) => (
            <MenubarItem
              key={id}
              onClick={() => setActiveHelp(id)}
              className="text-md h-6 px-3"
            >
              {getTranslatedAppName(id)}
            </MenubarItem>
          ))}
          <MenubarSeparator className="h-[2px] bg-black my-1" />
          <MenubarItem
            onClick={() => setIsAboutDialogOpen(true)}
            className="text-md h-6 px-3"
          >
            {t("apps.finder.menu.aboutFinder")}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {activeHelp !== null && (
        <Suspense fallback={null}>
          <HelpGuideDialog
            isOpen
            onOpenChange={(open) => {
              if (!open) setActiveHelp(null);
            }}
            guideId={activeHelp === "general" ? "overview" : activeHelp}
          />
        </Suspense>
      )}
      <AboutDialog
        isOpen={isAboutDialogOpen}
        onOpenChange={setIsAboutDialogOpen}
        metadata={finderMetadata}
        appId="finder"
      />
    </>
  );
}
