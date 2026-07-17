import { CaretDown, CaretUp } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  useEffectiveGreenroomAccount,
  useIsRealGreenroomAdmin,
} from "@/hooks/useGreenroomAccount";
import { useThemeFlags } from "@/hooks/useThemeFlags";
import {
  useDevViewAsStore,
  type ViewAsRole,
} from "@/stores/useDevViewAsStore";

/**
 * Menu-bar / taskbar indicator confirming which Greenroom account the OS is
 * acting as. Reads the same effective account the domain apps use, so the name
 * shown here always matches who pitches/projects are attributed to. Hidden when
 * no account is linked (source: "none").
 *
 * For Greenroom admins (and in dev builds) the name is a dropdown trigger
 * hosting the "View as" switch, which forces the effective Greenroom identity to
 * an admin or non-admin so role-gated UI can be previewed live. For everyone
 * else the name is a plain, non-interactive label.
 */
export function MenuBarAccount() {
  const { userId, displayName } = useEffectiveGreenroomAccount();
  const isRealAdmin = useIsRealGreenroomAdmin();
  const { isWindowsTheme, isWin98 } = useThemeFlags();
  const viewAs = useDevViewAsStore((s) => s.viewAs);
  const setViewAs = useDevViewAsStore((s) => s.setViewAs);

  if (userId == null) return null;

  const name = displayName || `User ${userId}`;
  // The View-as switch is admin-gated (via the real identity, so previewing as
  // a non-admin doesn't hide it), and always available in dev for previewing.
  const canViewAs = import.meta.env.DEV || isRealAdmin;

  const labelStyle = {
    marginRight: isWindowsTheme ? "4px" : "8px",
    color: isWin98
      ? "#000000"
      : isWindowsTheme
        ? "#ffffff"
        : "var(--os-color-menubar-text)",
    fontSize: isWindowsTheme ? undefined : "var(--os-typography-button)",
    textShadow:
      isWindowsTheme && !isWin98 ? "1px 1px 1px rgba(0,0,0,0.5)" : undefined,
  } as const;

  const labelClassName = `hidden sm:flex items-center whitespace-nowrap ${
    isWindowsTheme ? "text-xs font-bold" : ""
  }`;

  // Non-admins: plain, non-interactive label.
  if (!canViewAs) {
    return (
      <div
        className={labelClassName}
        style={labelStyle}
        title={`Signed in as ${name} (Greenroom user ${userId})`}
      >
        {name}
      </div>
    );
  }

  const Caret = isWindowsTheme ? CaretUp : CaretDown;
  const value: string = viewAs ?? "off";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`${labelClassName} gap-1 cursor-pointer border-none bg-transparent p-0 focus:outline-none focus-visible:outline-none`}
          style={labelStyle}
          title={`Signed in as ${name} (Greenroom user ${userId}) — click to switch view`}
        >
          {name}
          <Caret size={9} weight="bold" className="opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={isWindowsTheme ? "top" : "bottom"}
        sideOffset={isWindowsTheme ? 4 : 1}
        className="px-0"
      >
        <DropdownMenuLabel className="text-md px-3 py-1 opacity-60">
          View as
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) =>
            setViewAs(v === "off" ? null : (v as ViewAsRole))
          }
        >
          <DropdownMenuRadioItem value="off" className="text-md h-6 pr-3">
            Real identity
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="admin" className="text-md h-6 pr-3">
            Admin
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="non-admin" className="text-md h-6 pr-3">
            Non-admin
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="h-[2px] bg-black my-1" />
        <DropdownMenuLabel className="text-[11px] px-3 py-1 opacity-50 font-normal max-w-[220px] whitespace-normal leading-tight">
          Admin only. Overrides the Greenroom identity to preview admin-gated UI.
          Not enforced server-side.
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
