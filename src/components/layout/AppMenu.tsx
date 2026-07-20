import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from "@/components/ui/menubar";
import { ShortcutHint } from "@/components/shared/menubar/ShortcutHint";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { ShareItemDialog } from "@/components/dialogs/ShareItemDialog";
import { generateAppShareUrl } from "@/utils/sharedUrl";
import { useAppStore } from "@/stores/useAppStore";
import { useAppStoreShallow } from "@/stores/helpers";
import { appRegistry, type AppId } from "@/config/appRegistry";
import { getTranslatedAppName } from "@/utils/i18n";

// Apps that support multiple windows
const MULTI_INSTANCE_APPS: AppId[] = ["textedit", "finder", "applet-viewer"];

// Greenroom domain apps that intentionally omit the "About <App>" item from
// their app menu (also removed from their Help menus).
const APPS_WITHOUT_ABOUT: AppId[] = [
  "incoming-offers",
  "active-projects",
  "pitch",
  "archive",
];

// Apps that support fullscreen mode
const FULLSCREEN_APPS: AppId[] = ["ipod", "videos", "pc"];

interface AppMenuProps {
  appId: AppId;
  appName: string;
  instanceId: string;
  onShowAbout?: () => void;
}

/**
 * Universal macOS-style leftmost "App" menu (About/Share/Hide/Quit) for the
 * foreground app's window, mirroring `FinderAppMenu`/real Mac OS X. Wired into
 * `MacTopMenuBar` for the foreground app on macOS/System7 themes, so the app's
 * name always shows as the leftmost menu (matching upstream ryOS). Each app
 * still supplies its own File/Edit/… menus via `children`, which render to the
 * right of this menu.
 */
export function AppMenu({ appId, appName, instanceId, onShowAbout }: AppMenuProps) {
  const { t } = useTranslation();
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  const { minimizeInstance, restoreInstance, closeAppInstance } = useAppStoreShallow(
    (s) => ({
      minimizeInstance: s.minimizeInstance,
      restoreInstance: s.restoreInstance,
      closeAppInstance: s.closeAppInstance,
    })
  );
  const hasMinimizedInstances = useAppStore((s) =>
    Object.values(s.instances).some(
      (inst) => inst.appId === appId && inst.isOpen && inst.isMinimized
    )
  );

  const app = appRegistry[appId];
  const helpItems = app?.helpItems || [];
  const metadata = app?.metadata;

  const translatedAppName = getTranslatedAppName(appId);
  const supportsMultiInstance = MULTI_INSTANCE_APPS.includes(appId);
  const supportsFullScreen = FULLSCREEN_APPS.includes(appId);

  const handleHide = () => {
    minimizeInstance(instanceId);
  };

  const handleHideOthers = () => {
    Object.values(useAppStore.getState().instances).forEach((inst) => {
      if (inst.isOpen && inst.instanceId !== instanceId && !inst.isMinimized) {
        minimizeInstance(inst.instanceId);
      }
    });
  };

  const handleShowAll = () => {
    Object.values(useAppStore.getState().instances).forEach((inst) => {
      if (inst.appId === appId && inst.isOpen && inst.isMinimized) {
        restoreInstance(inst.instanceId);
      }
    });
  };

  const handleFullScreen = () => {
    window.dispatchEvent(
      new CustomEvent("toggleAppFullScreen", { detail: { appId, instanceId } })
    );
  };

  const handleShowAbout = () => {
    if (onShowAbout) {
      onShowAbout();
    } else {
      setIsAboutDialogOpen(true);
    }
  };

  const handleQuit = () => {
    closeAppInstance(instanceId);
  };

  return (
    <>
      <MenubarMenu>
        <MenubarTrigger
          className="text-md px-2 py-1 border-none focus-visible:ring-0 app-menu-trigger"
          style={{ fontWeight: "bold" }}
        >
          {translatedAppName}
        </MenubarTrigger>
        <MenubarContent align="start" sideOffset={1} className="px-0">
          {!APPS_WITHOUT_ABOUT.includes(appId) && (
            <MenubarItem onClick={handleShowAbout} className="text-md h-6 px-3">
              {t("common.appMenu.aboutApp", { appName: translatedAppName })}
            </MenubarItem>
          )}

          <MenubarItem
            onSelect={() => setIsShareDialogOpen(true)}
            className="text-md h-6 px-3"
          >
            {t("common.menu.shareApp")}
          </MenubarItem>

          <MenubarSeparator className="h-[2px] bg-black my-1" />

          <MenubarItem onClick={handleHide} className="text-md h-6 px-3">
            {t("common.appMenu.hideApp", { appName: translatedAppName })}
            <ShortcutHint id="hide" />
          </MenubarItem>

          <MenubarItem onClick={handleHideOthers} className="text-md h-6 px-3">
            {t("common.appMenu.hideOthers")}
            <ShortcutHint id="hideOthers" />
          </MenubarItem>

          {supportsMultiInstance && hasMinimizedInstances && (
            <MenubarItem onClick={handleShowAll} className="text-md h-6 px-3">
              {t("common.appMenu.showAll")}
            </MenubarItem>
          )}

          {supportsFullScreen && (
            <MenubarItem onClick={handleFullScreen} className="text-md h-6 px-3">
              {t("common.appMenu.fullScreen")}
            </MenubarItem>
          )}

          <MenubarSeparator className="h-[2px] bg-black my-1" />

          <MenubarItem onClick={handleQuit} className="text-md h-6 px-3">
            {t("common.appMenu.quitApp", { appName: translatedAppName })}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <HelpDialog
        isOpen={isHelpDialogOpen}
        onOpenChange={setIsHelpDialogOpen}
        appId={appId}
        helpItems={helpItems}
      />

      {metadata && (
        <AboutDialog
          isOpen={isAboutDialogOpen}
          onOpenChange={setIsAboutDialogOpen}
          metadata={metadata}
          appId={appId}
        />
      )}

      <ShareItemDialog
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
        itemType="App"
        itemIdentifier={appId}
        title={appName}
        generateShareUrl={generateAppShareUrl}
      />
    </>
  );
}
