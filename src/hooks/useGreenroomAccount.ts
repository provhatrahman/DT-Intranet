import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { useGreenroomAccountStore } from "@/stores/useGreenroomAccountStore";
import { useDevOverridesStore } from "@/stores/useDevOverridesStore";
import {
  isGreenroomAdminUserId,
  KNOWN_GREENROOM_USERS,
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
  const { getUseDevGreenroomAccount, viewAsUserId } = useDevOverridesStore();

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

  const viewAs = isDev && viewAsUserId != null ? viewAsUserId : null;

  return useMemo(() => {
    // Dev/demo "view as" wins over everything else.
    if (viewAs != null) {
      return {
        userId: viewAs,
        displayName: KNOWN_GREENROOM_USERS[viewAs] ?? `User ${viewAs}`,
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
  }, [viewAs, useDevAccount, validDevUserId, devDisplayName, currentAccount]);
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

