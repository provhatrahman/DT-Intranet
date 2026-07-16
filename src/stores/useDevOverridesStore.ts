import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DevOverridesState {
  useDevGreenroomAccount: Record<string, boolean>;
  setUseDevGreenroomAccount: (username: string | null, enabled: boolean) => void;
  getUseDevGreenroomAccount: (username: string | null) => boolean;
}

export const useDevOverridesStore = create<DevOverridesState>()(
  persist(
    (set, get) => ({
      useDevGreenroomAccount: {},
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

