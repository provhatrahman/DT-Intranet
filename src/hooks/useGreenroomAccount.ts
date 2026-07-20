import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { useAuthStore } from "@/stores/useAuthStore";
import { useGreenroomAccountStore } from "@/stores/useGreenroomAccountStore";
import { useDevViewAsStore } from "@/stores/useDevViewAsStore";
import {
  isGreenroomAdminUserId,
  VIEW_AS_ADMIN_USER_ID,
  VIEW_AS_NON_ADMIN_USER_ID,
} from "@/config/greenroomAdmins";

interface EffectiveGreenroomAccount {
  userId: number | null;
  displayName: string | undefined;
  source: "dev" | "linked" | "none";
  /**
   * The real underlying user ID, ignoring any active (local-dev) "View as"
   * override. Consumers that must act on the genuine signed-in identity rather
   * than the previewed one (e.g. settings sync) use this instead of `userId`.
   */
  realUserId: number | null;
  /**
   * Whether this effective identity is a Greenroom admin. Sourced from the
   * backend's authoritative `is_admin` flag on the signed-in user (derived from
   * their `users.role`), with the legacy hardcoded ID allowlist kept as a
   * fallback for dev accounts / manual links. The dev "View as" override forces
   * this to match the previewed role. See useIsGreenroomAdmin.
   */
  isAdmin: boolean;
}

/**
 * Returns the effective Greenroom user ID to use for API calls.
 * In dev mode, if the dev override is enabled, returns the dummy dev user ID.
 * Otherwise, returns the linked Greenroom account's user ID.
 */
export function useEffectiveGreenroomAccount(): EffectiveGreenroomAccount {
  const { username } = useAuth();
  const { getAccount } = useGreenroomAccountStore();
  const viewAsRole = useDevViewAsStore((s) => s.viewAs);

  // The authenticated Google identity IS the Greenroom account: the backend's
  // auth exchange returns the user's numeric `users.id`, so a logged-in user
  // never has to manually link. See useAuthStore.
  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const authExpiresAt = useAuthStore((s) => s.expiresAt);
  const authAccount =
    authStatus === "authenticated" &&
    authUser?.id &&
    (!authExpiresAt || Date.now() < authExpiresAt)
      ? authUser
      : null;

  const isDev = import.meta.env.DEV;
  const devUserIdStr = import.meta.env.VITE_DEV_GREENROOM_USER_ID;
  const devUserId = devUserIdStr && devUserIdStr.trim() !== ""
    ? parseInt(devUserIdStr.trim(), 10)
    : null;
  const devDisplayName = import.meta.env.VITE_DEV_GREENROOM_USER_DISPLAY || "Dev Tester";

  // Validate parsed user ID
  const validDevUserId = devUserId && !isNaN(devUserId) && devUserId > 0 ? devUserId : null;

  const currentAccount = getAccount(username);
  // In dev, a configured VITE_DEV_GREENROOM_USER_ID is enough to activate the
  // dev account (the old getUseDevGreenroomAccount() opt-in toggle was removed
  // from the UI, leaving the env var inert). Guarded by isDev, so prod builds
  // never use it regardless of env.
  const useDevAccount = isDev && !!validDevUserId;

  return useMemo(() => {
    // 1) Resolve the real underlying identity, ignoring any "View as" override.
    let base: EffectiveGreenroomAccount;
    if (useDevAccount && validDevUserId) {
      base = {
        userId: validDevUserId,
        displayName: devDisplayName,
        source: "dev",
        realUserId: validDevUserId,
        // No auth user in the dev-account path — fall back to the ID allowlist.
        isAdmin: isGreenroomAdminUserId(validDevUserId),
      };
    } else if (authAccount) {
      // A logged-in Google user is auto-linked to their Greenroom account — no
      // manual linking needed. Wins over the legacy manual link below. Admin
      // status comes from the backend's authoritative `is_admin` (derived from
      // the user's role); the legacy ID allowlist is only a fallback so the
      // seeded 8/9/10 accounts keep working.
      base = {
        userId: authAccount.id,
        displayName: authAccount.username || authAccount.email,
        source: "linked",
        realUserId: authAccount.id,
        isAdmin:
          authAccount.is_admin === true ||
          isGreenroomAdminUserId(authAccount.id),
      };
    } else if (currentAccount?.greenroomUserId) {
      base = {
        userId: currentAccount.greenroomUserId,
        displayName: currentAccount.displayName,
        source: "linked",
        realUserId: currentAccount.greenroomUserId,
        isAdmin: isGreenroomAdminUserId(currentAccount.greenroomUserId),
      };
    } else {
      base = {
        userId: null,
        displayName: undefined,
        source: "none",
        realUserId: null,
        isAdmin: false,
      };
    }

    // 2) The "View as" override is a strictly local-development preview tool.
    //    When active it forces the *effective* identity to a fixed admin/non-admin
    //    user, while preserving `realUserId`. Gated on isDev so it can never take
    //    effect in a built/deployed bundle.
    if (viewAsRole != null && isDev) {
      const isAdmin = viewAsRole === "admin";
      return {
        userId: isAdmin ? VIEW_AS_ADMIN_USER_ID : VIEW_AS_NON_ADMIN_USER_ID,
        displayName: isAdmin ? "Admin (view as)" : "Non-admin (view as)",
        source: "dev" as const,
        realUserId: base.realUserId,
        isAdmin,
      };
    }

    return base;
  }, [
    viewAsRole,
    isDev,
    useDevAccount,
    validDevUserId,
    devDisplayName,
    authAccount,
    currentAccount,
  ]);
}

/**
 * Whether the effective Greenroom account is an admin. Gates admin-only UI
 * actions (approving/rejecting offers in the Inbox, admin actions in Active
 * Projects, the Admin Portal, etc.). The source of truth is the backend's
 * `is_admin` flag on the signed-in user (derived from their `users.role`), which
 * the backend ALSO enforces server-side — the legacy hardcoded ID allowlist in
 * src/config/greenroomAdmins.ts is only a fallback for dev accounts and manual
 * links. See useEffectiveGreenroomAccount for how this is resolved.
 */
export function useIsGreenroomAdmin(): boolean {
  const { isAdmin } = useEffectiveGreenroomAccount();
  return isAdmin;
}

