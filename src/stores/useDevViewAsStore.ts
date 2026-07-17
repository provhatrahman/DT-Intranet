import { create } from "zustand";
import { persist } from "zustand/middleware";

// "View as" role override.
//
// When set, it forces the *effective* Greenroom identity (see
// useEffectiveGreenroomAccount) to a fixed admin or non-admin user, so the
// role-gated UI (e.g. the admin-only pitch "Reject" / booking "Decline"
// actions) can be previewed live without linking a real backend account.
//
// This is a global override with top priority over the env dev-account and any
// linked account. It is honored for Greenroom admins (and in dev builds); the
// menu-bar switch that flips it (MenuBarAccount) is gated the same way, keyed
// off the *real* identity so an admin previewing as a non-admin keeps access.
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
