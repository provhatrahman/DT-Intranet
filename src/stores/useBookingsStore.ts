import { create } from "zustand";
import {
  BookingListItem,
  BookingDetail,
  BookingStatus,
  BookingVotePayload,
  CreateBookingPayload,
  UpdateBookingPayload,
  getBookings as apiGetBookings,
  getBookingById as apiGetBookingById,
  createBooking as apiCreateBooking,
  updateBooking as apiUpdateBooking,
  deleteBooking as apiDeleteBooking,
  voteOnBooking as apiVoteOnBooking,
} from "@/lib/api/bookings";

interface BookingsState {
  bookings: BookingListItem[];
  bookingDetails: Record<number, BookingDetail>;
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;

  fetchBookings: () => Promise<void>;
  refreshBooking: (id: number) => Promise<void>;
  createBooking: (payload: CreateBookingPayload) => Promise<number>;
  updateBooking: (id: number, payload: UpdateBookingPayload) => Promise<void>;
  setBookingStatus: (id: number, status: BookingStatus) => Promise<void>;
  deleteBooking: (id: number) => Promise<void>;
  voteOnBooking: (id: number, payload: BookingVotePayload) => Promise<void>;
  getPendingBookings: () => BookingListItem[];
  clearError: () => void;
}

export const useBookingsStore = create<BookingsState>((set, get) => ({
  bookings: [],
  bookingDetails: {},
  isLoading: false,
  error: null,
  lastFetch: null,

  fetchBookings: async () => {
    set({ isLoading: true, error: null });
    try {
      const bookings = await apiGetBookings();
      set({ bookings, isLoading: false, lastFetch: Date.now() });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch bookings";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  refreshBooking: async (id: number) => {
    try {
      const detail = await apiGetBookingById(id);
      set((state) => ({
        bookingDetails: { ...state.bookingDetails, [id]: detail },
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Failed to fetch booking ${id}`;
      set({ error: message });
      throw error;
    }
  },

  createBooking: async (payload: CreateBookingPayload) => {
    set({ error: null });
    try {
      const result = await apiCreateBooking(payload);
      await get().fetchBookings();
      return result.id;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create booking";
      set({ error: message });
      throw error;
    }
  },

  updateBooking: async (id: number, payload: UpdateBookingPayload) => {
    set({ error: null });
    try {
      await apiUpdateBooking(id, payload);
      await get().fetchBookings();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update booking";
      set({ error: message });
      throw error;
    }
  },

  setBookingStatus: async (id: number, status: BookingStatus) => {
    await get().updateBooking(id, { status });
  },

  voteOnBooking: async (id: number, payload: BookingVotePayload) => {
    try {
      await apiVoteOnBooking(id, payload);
      await get().refreshBooking(id);
      await get().fetchBookings();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to vote on booking";
      set({ error: message });
      throw error;
    }
  },

  deleteBooking: async (id: number) => {
    set({ error: null });
    try {
      await apiDeleteBooking(id);
      set((state) => ({
        bookings: state.bookings.filter((b) => b.booking_id !== id),
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete booking";
      set({ error: message });
      throw error;
    }
  },

  getPendingBookings: () => {
    return get().bookings.filter((b) => b.status === "pending");
  },

  clearError: () => set({ error: null }),
}));
