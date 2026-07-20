import { MenuBar } from "@/components/layout/MenuBar";
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from "@/components/ui/menubar";
import { useThemeStore } from "@/stores/useThemeStore";

interface GreenroomAdminMenuBarProps {
  onClose: () => void;
  onShowHelp: () => void;
  // Management actions are only wired up for admins; when absent the items are
  // hidden (non-admins see the Access Denied screen).
  onNewUser?: () => void;
  onRefresh?: () => void;
  canManage?: boolean;
}

export function GreenroomAdminMenuBar({
  onClose,
  onShowHelp,
  onNewUser,
  onRefresh,
  canManage = false,
}: GreenroomAdminMenuBarProps) {
  const currentTheme = useThemeStore((state) => state.current);
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";

  return (
    <MenuBar inWindowFrame={isXpTheme}>
      <MenubarMenu>
        <MenubarTrigger className="text-md px-2 py-1 border-none focus-visible:ring-0">
          File
        </MenubarTrigger>
        <MenubarContent align="start" sideOffset={1} className="px-0">
          {canManage && (
            <>
              <MenubarItem
                onClick={onNewUser}
                className="text-md h-6 px-3"
              >
                New User…
              </MenubarItem>
              <MenubarItem
                onClick={onRefresh}
                className="text-md h-6 px-3"
              >
                Refresh
              </MenubarItem>
              <MenubarSeparator />
            </>
          )}
          <MenubarItem onClick={onClose} className="text-md h-6 px-3">
            Close
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="px-2 py-1 text-md focus-visible:ring-0">
          Help
        </MenubarTrigger>
        <MenubarContent align="start" sideOffset={1} className="px-0">
          <MenubarItem onClick={onShowHelp} className="text-md h-6 px-3">
            Help
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </MenuBar>
  );
}
