import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarLabel,
  MenubarSeparator,
  MenubarRadioGroup,
  MenubarRadioItem,
} from "@/components/ui/menubar";
import {
  useDevViewAsStore,
  type ViewAsRole,
} from "@/stores/useDevViewAsStore";

// Dev-only global menu in the top menu bar. Currently hosts the "View as"
// switch, which forces the effective Greenroom identity to an admin or a
// non-admin so role-gated UI can be previewed live. Rendered only in dev
// builds (import.meta.env.DEV) and only in the Mac-style top menu bar; it is
// intentionally absent from XP/98 taskbar chrome.
export function DevMenu() {
  const viewAs = useDevViewAsStore((s) => s.viewAs);
  const setViewAs = useDevViewAsStore((s) => s.setViewAs);

  if (!import.meta.env.DEV) return null;

  const value: string = viewAs ?? "off";

  return (
    <MenubarMenu>
      <MenubarTrigger className="text-md px-2 py-1 border-none focus-visible:ring-0">
        Dev
      </MenubarTrigger>
      <MenubarContent align="start" sideOffset={1} className="px-0">
        <MenubarLabel className="text-md px-3 py-1 opacity-60">
          View as
        </MenubarLabel>
        <MenubarRadioGroup
          value={value}
          onValueChange={(v) =>
            setViewAs(v === "off" ? null : (v as ViewAsRole))
          }
        >
          <MenubarRadioItem value="off" className="text-md h-6 pr-3">
            Real identity
          </MenubarRadioItem>
          <MenubarRadioItem value="admin" className="text-md h-6 pr-3">
            Admin
          </MenubarRadioItem>
          <MenubarRadioItem value="non-admin" className="text-md h-6 pr-3">
            Non-admin
          </MenubarRadioItem>
        </MenubarRadioGroup>
        <MenubarSeparator className="h-[2px] bg-black my-1" />
        <MenubarLabel className="text-[11px] px-3 py-1 opacity-50 font-normal max-w-[220px] whitespace-normal leading-tight">
          Dev-only. Overrides the Greenroom identity to preview admin-gated UI.
          Not enforced server-side.
        </MenubarLabel>
      </MenubarContent>
    </MenubarMenu>
  );
}
