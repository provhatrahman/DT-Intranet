import { create } from "zustand";
import {
  FeedbackReport,
  FeedbackStatus,
  CreateFeedbackPayload,
  getFeedback as apiGetFeedback,
  createFeedback as apiCreateFeedback,
  updateFeedbackStatus as apiUpdateFeedbackStatus,
} from "@/lib/api/feedback";

interface FeedbackState {
  reports: FeedbackReport[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;

  // Admin: load all reports for the triage view.
  fetchReports: () => Promise<void>;
  // Any user: submit a new report. Returns the new report's id.
  createReport: (payload: CreateFeedbackPayload) => Promise<number>;
  // Admin: flip a report's status (optimistic).
  updateStatus: (id: number, status: FeedbackStatus) => Promise<void>;
  clearError: () => void;
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const useFeedbackStore = create<FeedbackState>((set) => ({
  reports: [],
  isLoading: false,
  error: null,
  lastFetch: null,

  fetchReports: async () => {
    set({ isLoading: true, error: null });
    try {
      const reports = await apiGetFeedback();
      set({ reports, isLoading: false, lastFetch: Date.now() });
    } catch (error) {
      set({
        error: errorMessage(error, "Failed to fetch feedback"),
        isLoading: false,
      });
      throw error;
    }
  },

  createReport: async (payload) => {
    set({ error: null });
    try {
      const created = await apiCreateFeedback(payload);
      return created.id;
    } catch (error) {
      set({ error: errorMessage(error, "Failed to submit feedback") });
      throw error;
    }
  },

  updateStatus: async (id, status) => {
    set({ error: null });
    try {
      await apiUpdateFeedbackStatus(id, status);
      set((state) => ({
        reports: state.reports.map((r) =>
          r.id === id
            ? { ...r, status, date_last_updated: new Date().toISOString() }
            : r
        ),
      }));
    } catch (error) {
      set({ error: errorMessage(error, "Failed to update feedback") });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
