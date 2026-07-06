import { create } from "zustand";
import {
  BookingListItem,
  BookingStatus,
  CreateBookingPayload,
  UpdateBookingPayload,
  getBookings as apiGetBookings,
  createBooking as apiCreateBooking,
  updateBooking as apiUpdateBooking,
  deleteBooking as apiDeleteBooking,
} from "@/lib/api/bookings";

interface BookingsState {
  bookings: BookingListItem[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;

  fetchBookings: () => Promise<void>;
  createBooking: (payload: CreateBookingPayload) => Promise<number>;
  updateBooking: (id: number, payload: UpdateBookingPayload) => Promise<void>;
  setBookingStatus: (id: number, status: BookingStatus) => Promise<void>;
  deleteBooking: (id: number) => Promise<void>;
  getPendingBookings: () => BookingListItem[];
  clearError: () => void;
}

export const useBookingsStore = create<BookingsState>((set, get) => ({
  bookings: [],
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
