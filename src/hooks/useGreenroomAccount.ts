import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { useAuthStore } from "@/stores/useAuthStore";
import { useGreenroomAccountStore } from "@/stores/useGreenroomAccountStore";
import { useDevOverridesStore } from "@/stores/useDevOverridesStore";
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
}

/**
 * Returns the effective Greenroom user ID to use for API calls.
 * In dev mode, if the dev override is enabled, returns the dummy dev user ID.
 * Otherwise, returns the linked Greenroom account's user ID.
 */
export function useEffectiveGreenroomAccount(): EffectiveGreenroomAccount {
  const { username } = useAuth();
  const { getAccount } = useGreenroomAccountStore();
  const { getUseDevGreenroomAccount } = useDevOverridesStore();
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
  const useDevAccount = isDev && validDevUserId && getUseDevGreenroomAccount(username);

  const viewAs = isDev ? viewAsRole : null;

  return useMemo(() => {
    // Dev-only "View as" override wins over everything else.
    if (viewAs != null) {
      const isAdmin = viewAs === "admin";
      return {
        userId: isAdmin ? VIEW_AS_ADMIN_USER_ID : VIEW_AS_NON_ADMIN_USER_ID,
        displayName: isAdmin ? "Admin (view as)" : "Non-admin (view as)",
        source: "dev" as const,
      };
    }

    if (useDevAccount && validDevUserId) {
      return {
        userId: validDevUserId,
        displayName: devDisplayName,
        source: "dev" as const,
      };
    }

    // A logged-in Google user is auto-linked to their Greenroom account — no
    // manual linking needed. Wins over the legacy manual link below.
    if (authAccount) {
      return {
        userId: authAccount.id,
        displayName: authAccount.username || authAccount.email,
        source: "linked" as const,
      };
    }

    if (currentAccount?.greenroomUserId) {
      return {
        userId: currentAccount.greenroomUserId,
        displayName: currentAccount.displayName,
        source: "linked" as const,
      };
    }

    return {
      userId: null,
      displayName: undefined,
      source: "none" as const,
    };
  }, [
    viewAs,
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

