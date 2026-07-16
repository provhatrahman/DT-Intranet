import { create } from "zustand";
import {
  Pitch,
  PitchDetail,
  CreatePitchPayload,
  UpdatePitchPayload,
  VotePayload,
  CommentPayload,
  getPitches as apiGetPitches,
  getPitchById as apiGetPitchById,
  createPitch as apiCreatePitch,
  updatePitch as apiUpdatePitch,
  deletePitch as apiDeletePitch,
  voteOnPitch as apiVoteOnPitch,
  addComment as apiAddComment,
  approvePitch as apiApprovePitch,
  closePitch as apiClosePitch,
} from "@/lib/api/pitches";

interface PitchesState {
  pitches: Pitch[];
  pitchDetails: Record<number, PitchDetail>;
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  fetchPitches: () => Promise<void>;
  refreshPitch: (id: number) => Promise<void>;
  createPitch: (payload: CreatePitchPayload) => Promise<Pitch>;
  updatePitch: (id: number, payload: UpdatePitchPayload) => Promise<void>;
  deletePitch: (id: number) => Promise<void>;
  voteOnPitch: (
    id: number,
    payload: VotePayload
  ) => Promise<void>;
  addComment: (id: number, payload: CommentPayload) => Promise<void>;
  // POST /pitches/{id}/approve/ — creates a project from the pitch and links
  // it. Returns the new project id so the caller can fill in project fields.
  approvePitch: (id: number) => Promise<number>;
  // POST /pitches/{id}/close/ — closes without creating a project.
  closePitch: (id: number) => Promise<void>;
  // No dedicated endpoint; sets status "rejected" via update.
  rejectPitch: (id: number) => Promise<void>;
  getCurrentUserPitches: (greenroomUserId: number | null) => Pitch[];
  clearError: () => void;
}

export const usePitchesStore = create<PitchesState>((set, get) => ({
  pitches: [],
  pitchDetails: {},
  isLoading: false,
  error: null,
  lastFetch: null,

  fetchPitches: async () => {
    set({ isLoading: true, error: null });
    try {
      const pitches = await apiGetPitches();
      set({
        pitches,
        isLoading: false,
        lastFetch: Date.now(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch pitches";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  refreshPitch: async (id: number) => {
    try {
      const detail = await apiGetPitchById(id);
      set((state) => ({
        pitchDetails: {
          ...state.pitchDetails,
          [id]: detail,
        },
        pitches: state.pitches.map((p) =>
          p.id === id ? { ...p, ...detail } : p
        ),
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Failed to fetch pitch ${id}`;
      set({ error: message });
      throw error;
    }
  },

  createPitch: async (payload: CreatePitchPayload) => {
    set({ isLoading: true, error: null });
    try {
      const created = await apiCreatePitch(payload);
      // The create endpoint returns only { id, title, status, message } — not
      // a full pitch row. Reconstruct the rest from the request payload so the
      // stored pitch carries submitter_user_id/description. Without this the
      // new pitch is invisible in "My Pitches" (getCurrentUserPitches filters
      // on submitter_user_id) until the next full refetch.
      const newPitch: Pitch = {
        id: created.id,
        title: created.title ?? payload.title,
        description: payload.description ?? "",
        status: created.status ?? payload.status ?? "submitted",
        project_id: payload.project_id ?? null,
        submitter_user_id: payload.submitter_user_id,
        date_submitted: new Date().toISOString(),
        date_closed: null,
        total_votes: 0,
        yes_votes: 0,
      };
      set((state) => ({
        pitches: [newPitch, ...state.pitches],
        isLoading: false,
      }));
      return newPitch;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create pitch";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updatePitch: async (id: number, payload: UpdatePitchPayload) => {
    set({ isLoading: true, error: null });
    try {
      await apiUpdatePitch(id, payload);
      await get().refreshPitch(id);
      set({ isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update pitch";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deletePitch: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      await apiDeletePitch(id);
      set((state) => {
        const pitchDetails = { ...state.pitchDetails };
        delete pitchDetails[id];
        return {
          pitches: state.pitches.filter((p) => p.id !== id),
          pitchDetails,
          isLoading: false,
        };
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete pitch";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  voteOnPitch: async (id: number, payload: VotePayload) => {
    try {
      await apiVoteOnPitch(id, payload);
      await get().refreshPitch(id);
      await get().fetchPitches();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to vote on pitch";
      set({ error: message });
      throw error;
    }
  },

  addComment: async (id: number, payload: CommentPayload) => {
    try {
      await apiAddComment(id, payload);
      await get().refreshPitch(id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add comment";
      set({ error: message });
      throw error;
    }
  },

  approvePitch: async (id: number) => {
    set({ error: null });
    try {
      const result = await apiApprovePitch(id);
      await get().refreshPitch(id);
      await get().fetchPitches();
      return result.project_id;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to approve pitch";
      set({ error: message });
      throw error;
    }
  },

  closePitch: async (id: number) => {
    set({ error: null });
    try {
      await apiClosePitch(id);
      await get().refreshPitch(id);
      await get().fetchPitches();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to close pitch";
      set({ error: message });
      throw error;
    }
  },

  rejectPitch: async (id: number) => {
    await get().updatePitch(id, { status: "rejected" });
    await get().fetchPitches();
  },

  getCurrentUserPitches: (greenroomUserId: number | null) => {
    if (!greenroomUserId) return [];
    return get().pitches.filter(
      (pitch) => pitch.submitter_user_id === greenroomUserId
    );
  },

  clearError: () => set({ error: null }),
}));

