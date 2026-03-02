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
  parsePitchDescription,
} from "@/lib/api/pitches";
import { useGreenroomAccountStore } from "./useGreenroomAccountStore";

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
      const newPitch = await apiCreatePitch(payload);
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
        const { [id]: removed, ...pitchDetails } = state.pitchDetails;
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

  getCurrentUserPitches: (greenroomUserId: number | null) => {
    if (!greenroomUserId) return [];
    return get().pitches.filter(
      (pitch) => pitch.submitter_user_id === greenroomUserId
    );
  },

  clearError: () => set({ error: null }),
}));

