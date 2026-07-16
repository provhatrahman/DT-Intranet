import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DevOverridesState {
  useDevGreenroomAccount: Record<string, boolean>;
  setUseDevGreenroomAccount: (username: string | null, enabled: boolean) => void;
  getUseDevGreenroomAccount: (username: string | null) => boolean;
  // Dev/demo "view as" override: when set, forces the effective Greenroom user
  // to this ID (top priority over dev-env + linked account). Used to switch
  // between an admin and a non-admin identity to preview role-gated UI.
  viewAsUserId: number | null;
  setViewAsUserId: (userId: number | null) => void;
}

export const useDevOverridesStore = create<DevOverridesState>()(
  persist(
    (set, get) => ({
      useDevGreenroomAccount: {},
      viewAsUserId: null,
      setViewAsUserId: (userId: number | null) => set({ viewAsUserId: userId }),
      setUseDevGreenroomAccount: (username: string | null, enabled: boolean) => {
        const key = username ? username.toLowerCase() : "__anonymous__";
        set((state) => ({
          useDevGreenroomAccount: {
            ...state.useDevGreenroomAccount,
            [key]: enabled,
          },
        }));
      },
      getUseDevGreenroomAccount: (username: string | null) => {
        const key = username ? username.toLowerCase() : "__anonymous__";
        const overrides = get().useDevGreenroomAccount;
        return overrides[key] ?? false;
      },
    }),
    {
      name: "dev-overrides",
    }
  )
);

