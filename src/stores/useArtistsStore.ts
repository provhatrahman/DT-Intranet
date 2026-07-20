import { create } from "zustand";
import {
  ArtistListItem,
  ArtistDetail,
  CreateArtistPayload,
  UpdateArtistPayload,
  getArtists as apiGetArtists,
  getArtistById as apiGetArtistById,
  findArtistByName as apiFindArtistByName,
  createArtist as apiCreateArtist,
  updateArtist as apiUpdateArtist,
} from "@/lib/api/artists";
import { ArtistGigScore, getGigScores } from "@/lib/api/analytics";

interface ArtistsState {
  artists: ArtistListItem[];
  artistDetails: Record<number, ArtistDetail>;
  // Per-artist gig stats keyed by artist id. Artists with no completed
  // bookings have no entry — treat a missing key as score 0 / never booked.
  stats: Record<number, ArtistGigScore>;
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;

  fetchArtists: () => Promise<void>;
  fetchStats: () => Promise<void>;
  getArtistDetail: (id: number) => Promise<ArtistDetail>;
  findByName: (name: string) => Promise<number | null>;
  getArtistById: (id: number) => ArtistListItem | undefined;
  // Creates the artist then refreshes the cached list; returns the new id.
  createArtist: (payload: CreateArtistPayload) => Promise<number>;
  // Patches the artist, then refreshes both the cached detail and list row.
  updateArtist: (id: number, payload: UpdateArtistPayload) => Promise<void>;
  clearError: () => void;
}

export const useArtistsStore = create<ArtistsState>((set, get) => ({
  artists: [],
  artistDetails: {},
  stats: {},
  isLoading: false,
  error: null,
  lastFetch: null,

  fetchStats: async () => {
    try {
      const scores = await getGigScores();
      const stats: Record<number, ArtistGigScore> = {};
      for (const score of scores) {
        stats[score.artist_id] = score;
      }
      set({ stats });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch artist stats";
      set({ error: message });
      throw error;
    }
  },

  fetchArtists: async () => {
    set({ isLoading: true, error: null });
    try {
      const artists = await apiGetArtists();
      set({ artists, isLoading: false, lastFetch: Date.now() });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch artists";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  getArtistDetail: async (id: number) => {
    const cached = get().artistDetails[id];
    if (cached) return cached;
    try {
      const detail = await apiGetArtistById(id);
      set((state) => ({
        artistDetails: { ...state.artistDetails, [id]: detail },
      }));
      return detail;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to fetch artist ${id}`;
      set({ error: message });
      throw error;
    }
  },

  findByName: async (name: string) => {
    try {
      const result = await apiFindArtistByName(name);
      return result.found ? result.id : null;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to find artist";
      set({ error: message });
      throw error;
    }
  },

  getArtistById: (id: number) => {
    return get().artists.find((a) => a.id === id);
  },

  createArtist: async (payload: CreateArtistPayload) => {
    try {
      const result = await apiCreateArtist(payload);
      await get().fetchArtists();
      return result.id;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create artist";
      set({ error: message });
      throw error;
    }
  },

  updateArtist: async (id: number, payload: UpdateArtistPayload) => {
    try {
      await apiUpdateArtist(id, payload);
      const detail = await apiGetArtistById(id);
      set((state) => ({
        artistDetails: { ...state.artistDetails, [id]: detail },
      }));
      await get().fetchArtists();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update artist";
      set({ error: message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
