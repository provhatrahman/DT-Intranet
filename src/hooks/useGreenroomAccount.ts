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
   * The real underlying user ID, ignoring any active "View as" override. Use
   * this (not `userId`) to decide whether to *offer* the View-as switch, so an
   * admin who is previewing as a non-admin doesn't lose access to the toggle.
   */
  realUserId: number | null;
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
      };
    } else if (authAccount) {
      // A logged-in Google user is auto-linked to their Greenroom account — no
      // manual linking needed. Wins over the legacy manual link below.
      base = {
        userId: authAccount.id,
        displayName: authAccount.username || authAccount.email,
        source: "linked",
        realUserId: authAccount.id,
      };
    } else if (currentAccount?.greenroomUserId) {
      base = {
        userId: currentAccount.greenroomUserId,
        displayName: currentAccount.displayName,
        source: "linked",
        realUserId: currentAccount.greenroomUserId,
      };
    } else {
      base = {
        userId: null,
        displayName: undefined,
        source: "none",
        realUserId: null,
      };
    }

    // 2) The "View as" override is available to Greenroom admins (and in dev
    //    builds). When active it forces the *effective* identity to a fixed
    //    admin/non-admin user, while preserving `realUserId` so the switch
    //    stays reachable even after previewing as a non-admin.
    const realIsAdmin = isGreenroomAdminUserId(base.realUserId);
    if (viewAsRole != null && (isDev || realIsAdmin)) {
      const isAdmin = viewAsRole === "admin";
      return {
        userId: isAdmin ? VIEW_AS_ADMIN_USER_ID : VIEW_AS_NON_ADMIN_USER_ID,
        displayName: isAdmin ? "Admin (view as)" : "Non-admin (view as)",
        source: "dev" as const,
        realUserId: base.realUserId,
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
 * Whether the effective Greenroom account is a (frontend-designated) admin.
 * See src/config/greenroomAdmins.ts — this gates admin-only UI actions such as
 * declining a pitch. NOT enforced server-side (the Greenroom API is anonymous).
 */
export function useIsGreenroomAdmin(): boolean {
  const { userId } = useEffectiveGreenroomAccount();
  return isGreenroomAdminUserId(userId);
}

/**
 * Whether the *real* underlying account is a (frontend-designated) admin,
 * ignoring any active "View as" override. Unlike useIsGreenroomAdmin (which
 * follows the previewed identity), this stays true while an admin previews as a
 * non-admin — so it's the right gate for *offering* the View-as switch itself.
 */
export function useIsRealGreenroomAdmin(): boolean {
  const { realUserId } = useEffectiveGreenroomAccount();
  return isGreenroomAdminUserId(realUserId);
}

