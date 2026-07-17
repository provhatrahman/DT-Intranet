import { create } from "zustand";
import { persist } from "zustand/middleware";

// Tracks which booking "offers" the current user created via the Inbox's Log
// Offer form. The Greenroom backend has no `created_by` on bookings and all
// writes are anonymous (see CLAUDE.md "Known limitation"), so ownership is a
// client-side, per-browser convenience — it lets a non-admin delete an offer
// card they logged themselves without being able to touch anyone else's.
// Admins can delete any offer regardless of what's recorded here.
interface LoggedOffersState {
  // greenroom userId -> booking ids that user logged from this browser.
  ownedByUser: Record<number, number[]>;
  recordOwnedBooking: (userId: number, bookingId: number) => void;
  forgetOwnedBooking: (userId: number, bookingId: number) => void;
  ownsBooking: (userId: number | null, bookingId: number | undefined) => boolean;
}

export const useLoggedOffersStore = create<LoggedOffersState>()(
  persist(
    (set, get) => ({
      ownedByUser: {},

      recordOwnedBooking: (userId, bookingId) => {
        set((state) => {
          const existing = state.ownedByUser[userId] ?? [];
          if (existing.includes(bookingId)) return state;
          return {
            ownedByUser: {
              ...state.ownedByUser,
              [userId]: [...existing, bookingId],
            },
          };
        });
      },

      forgetOwnedBooking: (userId, bookingId) => {
        set((state) => {
          const existing = state.ownedByUser[userId];
          if (!existing) return state;
          return {
            ownedByUser: {
              ...state.ownedByUser,
              [userId]: existing.filter((id) => id !== bookingId),
            },
          };
        });
      },

      ownsBooking: (userId, bookingId) => {
        if (userId == null || bookingId == null) return false;
        return (get().ownedByUser[userId] ?? []).includes(bookingId);
      },
    }),
    {
      name: "greenroom-logged-offers",
    }
  )
);
