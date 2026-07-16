import { create } from "zustand";
import { persist } from "zustand/middleware";

// Dev-only "View as" role override.
//
// When set, it forces the *effective* Greenroom identity (see
// useEffectiveGreenroomAccount) to a fixed admin or non-admin user, so the
// role-gated UI (e.g. the admin-only pitch "Reject" / booking "Decline"
// actions) can be previewed live without linking a real backend account.
//
// This is a global override with top priority over the env dev-account and any
// linked account. It is honored only in dev builds (import.meta.env.DEV); the
// UI that flips it (the "Dev" menu in the top menu bar) is also dev-only.
//
// `null` = off — fall back to the real effective identity.

export type ViewAsRole = "admin" | "non-admin";

interface DevViewAsState {
  viewAs: ViewAsRole | null;
  setViewAs: (role: ViewAsRole | null) => void;
}

export const useDevViewAsStore = create<DevViewAsState>()(
  persist(
    (set) => ({
      viewAs: null,
      setViewAs: (role) => set({ viewAs: role }),
    }),
    {
      name: "greenroom-dev-view-as",
    }
  )
);
