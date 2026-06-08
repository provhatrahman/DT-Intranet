import { create } from "zustand";
import {
  ArtistListItem,
  ArtistDetail,
  getArtists as apiGetArtists,
  getArtistById as apiGetArtistById,
  findArtistByName as apiFindArtistByName,
} from "@/lib/api/artists";

interface ArtistsState {
  artists: ArtistListItem[];
  artistDetails: Record<number, ArtistDetail>;
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;

  fetchArtists: () => Promise<void>;
  getArtistDetail: (id: number) => Promise<ArtistDetail>;
  findByName: (name: string) => Promise<number | null>;
  getArtistById: (id: number) => ArtistListItem | undefined;
  clearError: () => void;
}

export const useArtistsStore = create<ArtistsState>((set, get) => ({
  artists: [],
  artistDetails: {},
  isLoading: false,
  error: null,
  lastFetch: null,

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

  clearError: () => set({ error: null }),
}));
