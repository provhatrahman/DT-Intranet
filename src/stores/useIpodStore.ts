import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LyricsAlignment, ChineseVariant, KoreanDisplay } from "@/types/lyrics";
import { LyricLine } from "@/types/lyrics";
import { getApiUrl } from "@/utils/platform";
import * as musicApi from "@/lib/api/music";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatsStore } from "@/stores/useChatsStore";
import { useGreenroomAccountStore } from "@/stores/useGreenroomAccountStore";

/**
 * Best-effort resolution of the current Greenroom user id for attributing an
 * added track. Non-reactive (reads store snapshots). Attribution is optional —
 * the backend silently drops an unknown id — so this never blocks an add.
 */
function resolveGreenroomUserId(): number | undefined {
  try {
    const auth = useAuthStore.getState();
    if (
      auth.status === "authenticated" &&
      auth.user?.id &&
      (!auth.expiresAt || Date.now() < auth.expiresAt)
    ) {
      return auth.user.id;
    }
    const username = useChatsStore.getState().username;
    const account = useGreenroomAccountStore.getState().getAccount(username);
    return account?.greenroomUserId ?? undefined;
  } catch {
    return undefined;
  }
}

// Define the Track type (can be shared or defined here)
export interface Track {
  id: string;
  url: string;
  title: string;
  artist?: string;
  album?: string;
  /** Offset in milliseconds to adjust lyrics timing for this track (positive = lyrics earlier) */
  lyricOffset?: number;
}

type LibraryState = "uninitialized" | "loaded" | "cleared";

interface IpodData {
  tracks: Track[];
  currentIndex: number;
  loopCurrent: boolean;
  loopAll: boolean;
  isShuffled: boolean;
  isPlaying: boolean;
  showVideo: boolean;
  backlightOn: boolean;
  theme: "classic" | "black" | "u2";
  /** Screen skin: "classic" monochrome LCD or "modern" iOS-style color UI */
  uiVariant: "classic" | "modern";
  lcdFilterOn: boolean;
  showLyrics: boolean;
  lyricsAlignment: LyricsAlignment;
  chineseVariant: ChineseVariant;
  koreanDisplay: KoreanDisplay;
  lyricsTranslationRequest: { language: string; songId: string } | null;
  /** Persistent translation language preference that persists across tracks */
  lyricsTranslationLanguage: string | null;
  currentLyrics: { lines: LyricLine[] } | null;
  /** Incrementing nonce to force-refresh lyrics fetching */
  lyricsRefreshNonce: number;
  isFullScreen: boolean;
  libraryState: LibraryState;
  lastKnownVersion: number;
  playbackHistory: string[]; // Track IDs in playback order for back functionality and avoiding recent tracks
  historyPosition: number; // Current position in playback history (-1 means at the end)
}

// ============================================================================
// CACHING FOR iPod TRACKS
// ============================================================================

// In-memory cache for iPod tracks data
let cachedIpodData: { tracks: Track[]; version: number } | null = null;
let ipodDataPromise: Promise<{ tracks: Track[]; version: number }> | null = null;

/**
 * Preload iPod tracks data early (can be called before React mounts).
 * This starts fetching the JSON file without blocking.
 */
export function preloadIpodData(): void {
  if (cachedIpodData || ipodDataPromise) return;
  loadDefaultTracks();
}

/**
 * Load default tracks from JSON.
 * @param forceRefresh - If true, bypasses cache and fetches fresh data (used by syncLibrary)
 */
async function loadDefaultTracks(forceRefresh = false): Promise<{
  tracks: Track[];
  version: number;
}> {
  // Return cached data immediately if available (unless force refresh)
  if (!forceRefresh && cachedIpodData) {
    return cachedIpodData;
  }
  
  // Return existing promise if fetch is in progress (deduplication)
  // But not if we need a force refresh
  if (!forceRefresh && ipodDataPromise) {
    return ipodDataPromise;
  }
  
  // Start new fetch
  const fetchPromise = (async () => {
    try {
      const res = await fetch("/data/ipod-videos.json");
      const data = await res.json();
      const videos: unknown[] = data.videos || data;
      const version = data.version || 1;
      const tracks = videos.map((v) => {
        const video = v as Record<string, unknown>;
        return {
          id: video.id as string,
          url: video.url as string,
          title: video.title as string,
          artist: video.artist as string | undefined,
          album: (video.album as string | undefined) ?? "",
          lyricOffset: video.lyricOffset as number | undefined,
        };
      });
      // Update cache with fresh data
      cachedIpodData = { tracks, version };
      return cachedIpodData;
    } catch (err) {
      console.error("Failed to load ipod-videos.json", err);
      return { tracks: [], version: 1 };
    }
  })();
  
  // Only set the shared promise for non-force-refresh requests
  if (!forceRefresh) {
    ipodDataPromise = fetchPromise;
    fetchPromise.finally(() => {
      ipodDataPromise = null;
    });
  }
  
  return fetchPromise;
}

const initialIpodData: IpodData = {
  tracks: [],
  currentIndex: 0,
  loopCurrent: false,
  loopAll: true,
  isShuffled: true,
  isPlaying: false,
  showVideo: false,
  backlightOn: true,
  theme: "classic",
  uiVariant: "modern",
  lcdFilterOn: true,
  showLyrics: true,
  lyricsAlignment: LyricsAlignment.FocusThree,
  chineseVariant: ChineseVariant.Traditional,
  koreanDisplay: KoreanDisplay.Original,
  lyricsTranslationRequest: null,
  lyricsTranslationLanguage: null,
  currentLyrics: null,
  lyricsRefreshNonce: 0,
  isFullScreen: false,
  libraryState: "uninitialized",
  lastKnownVersion: 0,
  playbackHistory: [],
  historyPosition: -1,
};

export interface IpodState extends IpodData {
  setCurrentIndex: (index: number) => void;
  toggleLoopCurrent: () => void;
  toggleLoopAll: () => void;
  toggleShuffle: () => void;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  toggleVideo: () => void;
  toggleBacklight: () => void;
  toggleLcdFilter: () => void;
  toggleFullScreen: () => void;
  setTheme: (theme: "classic" | "black" | "u2") => void;
  setUiVariant: (uiVariant: "classic" | "modern") => void;
  toggleUiVariant: () => void;
  addTrack: (track: Track) => void;
  /** Remove a track from the collective library (local + server). */
  removeTrack: (id: string) => Promise<void>;
  clearLibrary: () => void;
  resetLibrary: () => Promise<void>;
  nextTrack: () => void;
  previousTrack: () => void;
  setShowVideo: (show: boolean) => void;
  toggleLyrics: () => void;
  /** Force refresh lyrics for current track */
  refreshLyrics: () => void;
  /** Adjust the lyric offset (in ms) for the track at the given index. */
  adjustLyricOffset: (trackIndex: number, deltaMs: number) => void;
  /** Set lyrics alignment mode */
  setLyricsAlignment: (alignment: LyricsAlignment) => void;
  /** Set Chinese character variant */
  setChineseVariant: (variant: ChineseVariant) => void;
  /** Set Korean text display mode */
  setKoreanDisplay: (display: KoreanDisplay) => void;
  /** Set the target language for lyrics translation. Pass null to disable translation. */
  setLyricsTranslationRequest: (
    language: string | null,
    songId: string | null
  ) => void;
  /** Set the persistent translation language preference that persists across tracks */
  setLyricsTranslationLanguage: (language: string | null) => void;
  /** Import library from JSON string */
  importLibrary: (json: string) => void;
  /** Export library to JSON string */
  exportLibrary: () => string;
  /**
   * Adds a track from a YouTube video ID or URL. Metadata is fetched
   * automatically (oEmbed + AI title parsing) unless `overrides.title` is
   * provided, in which case the caller-supplied title/artist/album are used
   * verbatim and the network lookups are skipped.
   */
  addTrackFromVideoId: (
    urlOrId: string,
    autoPlay?: boolean,
    overrides?: { title?: string; artist?: string; album?: string }
  ) => Promise<Track | null>;
  /** Load the collective library from the server (falls back to defaults if offline) */
  initializeLibrary: () => Promise<void>;

  /**
   * Fetch the collective library from the server and make it the source of
   * truth for the local list (adds, updates, and removes propagate). Preserves
   * the currently-playing track by id. Returns the diff counts.
   */
  fetchSharedLibrary: () => Promise<{
    newTracksAdded: number;
    tracksUpdated: number;
    removed: number;
    totalTracks: number;
  }>;

  /** Sync library with the collective server library (thin wrapper over fetchSharedLibrary) */
  syncLibrary: () => Promise<{
    newTracksAdded: number;
    tracksUpdated: number;
    totalTracks: number;
  }>;
}

const CURRENT_IPOD_STORE_VERSION = 20; // Added uiVariant (classic/modern screen skin)

// Helper function to get unplayed track IDs from history
function getUnplayedTrackIds(
  tracks: Track[],
  playbackHistory: string[]
): string[] {
  const playedIds = new Set(playbackHistory);
  return tracks.map((track) => track.id).filter((id) => !playedIds.has(id));
}

// Helper function to get a random track avoiding recently played songs
function getRandomTrackAvoidingRecent(
  tracks: Track[],
  playbackHistory: string[],
  currentIndex: number
): number {
  if (tracks.length === 0) return -1;
  if (tracks.length === 1) return 0;

  // Get unplayed tracks first (tracks that have never been played)
  const unplayedIds = getUnplayedTrackIds(tracks, playbackHistory);

  // If we have unplayed tracks, prioritize them
  if (unplayedIds.length > 0) {
    const availableUnplayed = unplayedIds.filter((id) => {
      const trackIndex = tracks.findIndex((track) => track.id === id);
      return trackIndex !== currentIndex;
    });

    if (availableUnplayed.length > 0) {
      const randomUnplayedId =
        availableUnplayed[Math.floor(Math.random() * availableUnplayed.length)];
      return tracks.findIndex((track) => track.id === randomUnplayedId);
    }
  }

  // If no unplayed tracks, avoid recently played ones
  // Keep a reasonable history size to avoid (e.g., half the playlist or 10 tracks, whichever is smaller)
  const avoidCount = Math.min(Math.floor(tracks.length / 2), 10);
  const recentTrackIds = playbackHistory.slice(-avoidCount);
  const recentIds = new Set(recentTrackIds);

  // Find tracks that haven't been played recently
  const availableIndices = tracks
    .map((_, index) => index)
    .filter((index) => {
      const trackId = tracks[index].id;
      return !recentIds.has(trackId) && index !== currentIndex;
    });

  if (availableIndices.length > 0) {
    return availableIndices[
      Math.floor(Math.random() * availableIndices.length)
    ];
  }

  // If all tracks have been played recently, just pick any track except current
  const allIndicesExceptCurrent = tracks
    .map((_, index) => index)
    .filter((index) => index !== currentIndex);

  if (allIndicesExceptCurrent.length > 0) {
    return allIndicesExceptCurrent[
      Math.floor(Math.random() * allIndicesExceptCurrent.length)
    ];
  }

  // Fallback: return current index if it's the only option
  return currentIndex;
}

// Helper function to update playback history
function updatePlaybackHistory(
  playbackHistory: string[],
  trackId: string,
  maxHistory: number = 50
): string[] {
  // Remove the track if it's already in history (to avoid duplicates when going back/forward)
  const filtered = playbackHistory.filter((id) => id !== trackId);
  // Add the track ID to the end of history
  const updated = [...filtered, trackId];
  // Keep only the most recent tracks
  return updated.slice(-maxHistory);
}

export const useIpodStore = create<IpodState>()(
  persist(
    (set, get) => ({
      ...initialIpodData,
      // --- Actions ---
      setCurrentIndex: (index) =>
        set((state) => {
          // Only update playback history if we're actually changing tracks
          if (
            index !== state.currentIndex &&
            index >= 0 &&
            index < state.tracks.length
          ) {
            const currentTrackId = state.tracks[state.currentIndex]?.id;
            const newPlaybackHistory = currentTrackId
              ? updatePlaybackHistory(state.playbackHistory, currentTrackId)
              : state.playbackHistory;

            // Preserve translation language preference but update song ID
            const newTranslationRequest = state.lyricsTranslationLanguage && state.tracks[index]?.id
              ? { language: state.lyricsTranslationLanguage, songId: state.tracks[index].id }
              : null;

            return {
              currentIndex: index,
              lyricsTranslationRequest: newTranslationRequest,
              playbackHistory: newPlaybackHistory,
              historyPosition: -1,
            };
          }

          // If not changing tracks, still update translation request if language preference exists
          const newTranslationRequest = state.lyricsTranslationLanguage && state.tracks[index]?.id
            ? { language: state.lyricsTranslationLanguage, songId: state.tracks[index].id }
            : null;

          return {
            currentIndex: index,
            lyricsTranslationRequest: newTranslationRequest,
          };
        }),
      toggleLoopCurrent: () =>
        set((state) => ({ loopCurrent: !state.loopCurrent })),
      toggleLoopAll: () => set((state) => ({ loopAll: !state.loopAll })),
      toggleShuffle: () =>
        set((state) => {
          const newShuffleState = !state.isShuffled;
          return {
            isShuffled: newShuffleState,
            // Clear playback history when turning shuffle on to start fresh
            playbackHistory: newShuffleState ? [] : state.playbackHistory,
            historyPosition: newShuffleState ? -1 : state.historyPosition,
          };
        }),
      togglePlay: () => {
        // Prevent playback when offline
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          return;
        }
        set((state) => ({ isPlaying: !state.isPlaying }));
      },
      setIsPlaying: (playing) => {
        // Prevent starting playback when offline
        if (playing && typeof navigator !== "undefined" && !navigator.onLine) {
          return;
        }
        set({ isPlaying: playing });
      },
      toggleVideo: () => {
        // Prevent turning on video when offline
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          return;
        }
        set((state) => ({ showVideo: !state.showVideo }));
      },
      toggleBacklight: () =>
        set((state) => ({ backlightOn: !state.backlightOn })),
      toggleLcdFilter: () =>
        set((state) => ({ lcdFilterOn: !state.lcdFilterOn })),
      toggleFullScreen: () =>
        set((state) => ({ isFullScreen: !state.isFullScreen })),
      setTheme: (theme) => set({ theme }),
      setUiVariant: (uiVariant) => set({ uiVariant }),
      toggleUiVariant: () =>
        set((state) => ({
          uiVariant: state.uiVariant === "modern" ? "classic" : "modern",
        })),
      addTrack: (track) =>
        set((state) => ({
          tracks: [track, ...state.tracks],
          currentIndex: 0,
          isPlaying: true,
          lyricsTranslationRequest: null,
          libraryState: "loaded",
          playbackHistory: [], // Clear playback history when adding new tracks
          historyPosition: -1,
        })),
      removeTrack: async (id: string) => {
        const current = get();
        const idx = current.tracks.findIndex((t) => t.id === id);
        if (idx === -1) return;

        // Snapshot for rollback if the server delete fails.
        const snapshotTracks = current.tracks;
        const snapshotIndex = current.currentIndex;

        // Optimistically remove locally, fixing up currentIndex/playback.
        set((state) => {
          const tracks = state.tracks.filter((t) => t.id !== id);
          let currentIndex = state.currentIndex;
          if (idx < state.currentIndex) {
            currentIndex = state.currentIndex - 1;
          } else if (idx === state.currentIndex) {
            currentIndex =
              tracks.length > 0
                ? Math.min(state.currentIndex, tracks.length - 1)
                : -1;
          }
          return {
            tracks,
            currentIndex,
            isPlaying: tracks.length === 0 ? false : state.isPlaying,
          };
        });

        try {
          await musicApi.removeTrack(id);
        } catch (error) {
          console.error("Failed to remove track from shared library:", error);
          // Roll back the optimistic removal.
          set({ tracks: snapshotTracks, currentIndex: snapshotIndex });
          throw error;
        }
      },
      clearLibrary: () =>
        set({
          tracks: [],
          currentIndex: -1,
          isPlaying: false,
          lyricsTranslationRequest: null,
          libraryState: "cleared",
          playbackHistory: [], // Clear playback history when clearing library
          historyPosition: -1,
        }),
      resetLibrary: async () => {
        const { tracks, version } = await loadDefaultTracks();
        set({
          tracks,
          currentIndex: tracks.length > 0 ? 0 : -1,
          isPlaying: false,
          lyricsTranslationRequest: null,
          libraryState: "loaded",
          lastKnownVersion: version,
          playbackHistory: [], // Clear playback history when resetting library
          historyPosition: -1,
        });
      },
      nextTrack: () =>
        set((state) => {
          if (state.tracks.length === 0)
            return { currentIndex: -1, lyricsTranslationRequest: null };

          // Add current track to history before moving to next
          const currentTrackId = state.tracks[state.currentIndex]?.id;
          let newPlaybackHistory = state.playbackHistory;
          if (currentTrackId && !state.loopCurrent) {
            newPlaybackHistory = updatePlaybackHistory(
              state.playbackHistory,
              currentTrackId
            );
          }

          let next: number;

          if (state.loopCurrent) {
            // If looping current track, stay on the same track
            next = state.currentIndex;
          } else if (state.isShuffled) {
            // Shuffle mode: pick a random track avoiding recent ones
            next = getRandomTrackAvoidingRecent(
              state.tracks,
              newPlaybackHistory,
              state.currentIndex
            );
          } else {
            // Sequential mode
            next = (state.currentIndex + 1) % state.tracks.length;

            // If we've reached the end and loop all is off, stop
            if (!state.loopAll && next === 0) {
              // Preserve translation language preference but update song ID
              const newTranslationRequest = state.lyricsTranslationLanguage && state.tracks[state.tracks.length - 1]?.id
                ? { language: state.lyricsTranslationLanguage, songId: state.tracks[state.tracks.length - 1].id }
                : null;

              return {
                currentIndex: state.tracks.length - 1,
                isPlaying: false,
                lyricsTranslationRequest: newTranslationRequest,
              };
            }
          }

          // Preserve translation language preference but update song ID
          const newTranslationRequest = state.lyricsTranslationLanguage && state.tracks[next]?.id
            ? { language: state.lyricsTranslationLanguage, songId: state.tracks[next].id }
            : null;

          return {
            currentIndex: next,
            isPlaying: true,
            lyricsTranslationRequest: newTranslationRequest,
            playbackHistory: newPlaybackHistory,
            historyPosition: -1, // Always reset to end when moving forward
          };
        }),
      previousTrack: () =>
        set((state) => {
          if (state.tracks.length === 0)
            return { currentIndex: -1, lyricsTranslationRequest: null };

          let prev: number;
          let newPlaybackHistory = state.playbackHistory;

          if (state.isShuffled && state.playbackHistory.length > 0) {
            // In shuffle mode, go back to the last played track from history
            const lastTrackId =
              state.playbackHistory[state.playbackHistory.length - 1];
            const lastTrackIndex = state.tracks.findIndex(
              (track) => track.id === lastTrackId
            );

            if (
              lastTrackIndex !== -1 &&
              lastTrackIndex !== state.currentIndex
            ) {
              // Found the previous track in history
              prev = lastTrackIndex;
              // Remove it from history since we're going back to it
              newPlaybackHistory = state.playbackHistory.slice(0, -1);
            } else {
              // No valid history, pick a random track
              prev = getRandomTrackAvoidingRecent(
                state.tracks,
                state.playbackHistory,
                state.currentIndex
              );
            }
          } else {
            // Sequential mode or no history
            prev =
              (state.currentIndex - 1 + state.tracks.length) %
              state.tracks.length;
          }

          // Preserve translation language preference but update song ID
          const newTranslationRequest = state.lyricsTranslationLanguage && state.tracks[prev]?.id
            ? { language: state.lyricsTranslationLanguage, songId: state.tracks[prev].id }
            : null;

          return {
            currentIndex: prev,
            isPlaying: true,
            lyricsTranslationRequest: newTranslationRequest,
            playbackHistory: newPlaybackHistory,
            historyPosition: -1,
          };
        }),
      setShowVideo: (show) => set({ showVideo: show }),
      toggleLyrics: () => set((state) => ({ showLyrics: !state.showLyrics })),
      refreshLyrics: () =>
        set((state) => ({
          lyricsRefreshNonce: state.lyricsRefreshNonce + 1,
          currentLyrics: null,
        })),
      adjustLyricOffset: (trackIndex, deltaMs) =>
        set((state) => {
          if (
            trackIndex < 0 ||
            trackIndex >= state.tracks.length ||
            Number.isNaN(deltaMs)
          ) {
            return {} as Partial<IpodState>;
          }

          const tracks = [...state.tracks];
          const current = tracks[trackIndex];
          const newOffset = (current.lyricOffset || 0) + deltaMs;

          tracks[trackIndex] = {
            ...current,
            lyricOffset: newOffset,
          };

          return { tracks } as Partial<IpodState>;
        }),
      setLyricsAlignment: (alignment) => set({ lyricsAlignment: alignment }),
      setChineseVariant: (variant) => set({ chineseVariant: variant }),
      setKoreanDisplay: (display) => set({ koreanDisplay: display }),
      setLyricsTranslationRequest: (language, songId) =>
        set(
          language && songId
            ? { 
                lyricsTranslationRequest: { language, songId },
                lyricsTranslationLanguage: language
              }
            : { 
                lyricsTranslationRequest: null,
                lyricsTranslationLanguage: null
              }
        ),
      setLyricsTranslationLanguage: (language) =>
        set((state) => {
          const newTranslationRequest = language && state.tracks[state.currentIndex]?.id
            ? { language, songId: state.tracks[state.currentIndex].id }
            : null;

          return {
            lyricsTranslationLanguage: language,
            lyricsTranslationRequest: newTranslationRequest,
          };
        }),
      importLibrary: (json: string) => {
        try {
          const importedTracks = JSON.parse(json) as Track[];
          if (!Array.isArray(importedTracks)) {
            throw new Error("Invalid library format");
          }
          // Validate each track has required fields
          for (const track of importedTracks) {
            if (!track.id || !track.url || !track.title) {
              throw new Error("Invalid track format");
            }
          }
          set({
            tracks: importedTracks,
            currentIndex: importedTracks.length > 0 ? 0 : -1,
            isPlaying: false,
            lyricsTranslationRequest: null,
            libraryState: "loaded",
            playbackHistory: [], // Clear playback history when importing library
            historyPosition: -1,
          });

          // The library is collective (server = source of truth), so push the
          // imported tracks up too — otherwise the next poll would drop any that
          // aren't already on the server. Best-effort / fire-and-forget.
          const addedBy = resolveGreenroomUserId();
          void Promise.allSettled(
            importedTracks.map((track) =>
              musicApi.addTrack(musicApi.toAddPayload(track, addedBy))
            )
          ).then((results) => {
            const failed = results.filter((r) => r.status === "rejected").length;
            if (failed > 0) {
              console.warn(
                `[iPod] importLibrary: ${failed}/${importedTracks.length} tracks failed to sync to the shared library`
              );
            }
          });
        } catch (error) {
          console.error("Failed to import library:", error);
          throw error;
        }
      },
      exportLibrary: () => {
        const { tracks } = get();
        return JSON.stringify(tracks, null, 2);
      },
      initializeLibrary: async () => {
        const current = get();
        // Only initialize if the library is in uninitialized state
        if (current.libraryState !== "uninitialized") return;

        try {
          // The collective library lives on the server; load it as source of truth.
          await get().fetchSharedLibrary();
          set((state) => ({
            currentIndex:
              state.tracks.length > 0
                ? state.currentIndex >= 0
                  ? state.currentIndex
                  : 0
                : -1,
            playbackHistory: [],
            historyPosition: -1,
          }));
        } catch (err) {
          // Offline / server unreachable: fall back to the bundled defaults so
          // the app still works. The poller will reconcile once online.
          console.error(
            "Failed to load collective library, using bundled defaults",
            err
          );
          const { tracks, version } = await loadDefaultTracks();
          set({
            tracks,
            currentIndex: tracks.length > 0 ? 0 : -1,
            libraryState: "loaded",
            lastKnownVersion: version,
            playbackHistory: [],
            historyPosition: -1,
          });
        }
      },
      fetchSharedLibrary: async () => {
        const serverTracks = await musicApi.listTracks();
        const current = get();
        const currentId = current.tracks[current.currentIndex]?.id;

        // Diff against the local list (for toast counts / change detection).
        const existingIds = new Set(current.tracks.map((t) => t.id));
        const serverIds = new Set(serverTracks.map((t) => t.id));
        const newTracksAdded = serverTracks.filter(
          (t) => !existingIds.has(t.id)
        ).length;
        const removed = current.tracks.filter(
          (t) => !serverIds.has(t.id)
        ).length;
        const localById = new Map(current.tracks.map((t) => [t.id, t]));
        let tracksUpdated = 0;
        for (const s of serverTracks) {
          const local = localById.get(s.id);
          if (
            local &&
            (local.title !== s.title ||
              local.artist !== s.artist ||
              local.album !== s.album ||
              local.url !== s.url ||
              local.lyricOffset !== s.lyricOffset)
          ) {
            tracksUpdated++;
          }
        }

        // Server is the source of truth: replace the local list with it, while
        // keeping the currently-playing track selected (matched by id).
        if (newTracksAdded > 0 || tracksUpdated > 0 || removed > 0) {
          let currentIndex = -1;
          if (serverTracks.length > 0) {
            const foundIdx = currentId
              ? serverTracks.findIndex((t) => t.id === currentId)
              : -1;
            currentIndex =
              foundIdx >= 0
                ? foundIdx
                : Math.min(
                    Math.max(current.currentIndex, 0),
                    serverTracks.length - 1
                  );
          }
          set({ tracks: serverTracks, currentIndex, libraryState: "loaded" });
        } else if (current.libraryState !== "loaded") {
          set({ libraryState: "loaded" });
        }

        return {
          newTracksAdded,
          tracksUpdated,
          removed,
          totalTracks: serverTracks.length,
        };
      },
      addTrackFromVideoId: async (
        urlOrId: string,
        autoPlay: boolean = true,
        overrides?: { title?: string; artist?: string; album?: string }
      ): Promise<Track | null> => {
        // Extract video ID from various URL formats
        const extractVideoId = (input: string): string | null => {
          // If it's already a video ID (11 characters, alphanumeric + hyphens/underscores)
          if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
            return input;
          }

          try {
            const url = new URL(input);

            // Handle os.ryo.lu/ipod/:id format
            if (
              url.hostname === "os.ryo.lu" &&
              url.pathname.startsWith("/ipod/")
            ) {
              return url.pathname.split("/")[2] || null;
            }

            // Handle YouTube URLs
            if (
              url.hostname.includes("youtube.com") ||
              url.hostname.includes("youtu.be")
            ) {
              // Standard YouTube URL: youtube.com/watch?v=VIDEO_ID
              const vParam = url.searchParams.get("v");
              if (vParam) return vParam;

              // Short YouTube URL: youtu.be/VIDEO_ID
              if (url.hostname === "youtu.be") {
                return url.pathname.slice(1) || null;
              }

              // Embedded or other YouTube formats
              const pathMatch = url.pathname.match(
                /\/(?:embed\/|v\/)?([a-zA-Z0-9_-]{11})/
              );
              if (pathMatch) return pathMatch[1];
            }

            return null;
          } catch {
            // Not a valid URL, might be just a video ID
            return /^[a-zA-Z0-9_-]{11}$/.test(input) ? input : null;
          }
        };

        const videoId = extractVideoId(urlOrId);
        if (!videoId) {
          throw new Error("Invalid YouTube URL or video ID");
        }

        // Collective library is keyed by video id — if it's already present,
        // just select/play it instead of adding a duplicate (and skip the
        // oEmbed/parse round-trips).
        const existingIndex = get().tracks.findIndex((t) => t.id === videoId);
        if (existingIndex !== -1) {
          set({ currentIndex: existingIndex, isPlaying: autoPlay });
          return get().tracks[existingIndex];
        }

        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const trackInfo = {
          title: `Video ID: ${videoId}`,
          artist: undefined as string | undefined,
          album: undefined as string | undefined,
        };

        const manualTitle = overrides?.title?.trim();
        if (manualTitle) {
          // Caller supplied metadata (manual Add Song form): use it verbatim and
          // skip the oEmbed + AI title lookups entirely.
          trackInfo.title = manualTitle;
          trackInfo.artist = overrides?.artist?.trim() || undefined;
          trackInfo.album = overrides?.album?.trim() || undefined;
        } else {
          let rawTitle = trackInfo.title; // Default title
          let authorName: string | undefined = undefined; // Store author_name

          try {
            // Fetch oEmbed data
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
              youtubeUrl
            )}&format=json`;
            const oembedResponse = await fetch(oembedUrl);

            if (oembedResponse.ok) {
              const oembedData = await oembedResponse.json();
              rawTitle = oembedData.title || rawTitle;
              authorName = oembedData.author_name; // Extract author_name
            } else {
              throw new Error(
                `Failed to fetch video info (${oembedResponse.status}). Please check the YouTube URL.`
              );
            }
          } catch (error) {
            console.error(`Error fetching oEmbed data for ${urlOrId}:`, error);
            throw error; // Re-throw to be handled by caller
          }

          trackInfo.title = rawTitle;

          try {
            // Call /api/parse-title
            const parseResponse = await fetch(getApiUrl("/api/parse-title"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: rawTitle,
                author_name: authorName,
              }),
            });

            if (parseResponse.ok) {
              const parsedData = await parseResponse.json();
              trackInfo.title = parsedData.title || rawTitle;
              trackInfo.artist = parsedData.artist;
              trackInfo.album = parsedData.album;
            } else {
              console.warn(
                `Failed to parse title with AI (status: ${parseResponse.status}), using raw title from oEmbed/default.`
              );
            }
          } catch (error) {
            console.error("Error calling /api/parse-title:", error);
          }
        }

        const newTrack: Track = {
          id: videoId,
          url: youtubeUrl,
          title: trackInfo.title,
          artist: trackInfo.artist,
          album: trackInfo.album,
          lyricOffset: 1000, // Default 1 second offset for new tracks
        };

        // Optimistically add to the local list, then persist to the shared
        // library so every user sees it. Roll back if the server write fails.
        get().addTrack(newTrack);
        if (!autoPlay) {
          set({ isPlaying: false });
        }

        try {
          const saved = await musicApi.addTrack(
            musicApi.toAddPayload(newTrack, resolveGreenroomUserId())
          );
          // Reconcile with the server's stored copy (metadata may be normalized).
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.id === saved.id ? { ...t, ...saved } : t
            ),
          }));
          return saved;
        } catch (error) {
          console.error("Failed to persist track to shared library:", error);
          // Roll back the optimistic add.
          set((state) => {
            const tracks = state.tracks.filter((t) => t.id !== newTrack.id);
            const currentIndex =
              tracks.length > 0
                ? Math.min(state.currentIndex, tracks.length - 1)
                : -1;
            return { tracks, currentIndex };
          });
          throw error;
        }
      },

      syncLibrary: async () => {
        // The collective library lives on the server (single global list), so a
        // sync is just a fetch that reconciles adds/updates/removes.
        const { newTracksAdded, tracksUpdated, totalTracks } =
          await get().fetchSharedLibrary();
        return { newTracksAdded, tracksUpdated, totalTracks };
      },
    }),
    {
      name: "ryos:ipod", // Unique name for localStorage persistence
      version: CURRENT_IPOD_STORE_VERSION, // Set the current version
      partialize: (state) => ({
        // Keep tracks and originalOrder here initially for migration
        tracks: state.tracks,
        currentIndex: state.currentIndex,
        loopAll: state.loopAll,
        loopCurrent: state.loopCurrent,
        isShuffled: state.isShuffled,
        theme: state.theme,
        uiVariant: state.uiVariant,
        lcdFilterOn: state.lcdFilterOn,
        showLyrics: state.showLyrics, // Persist lyrics visibility
        lyricsAlignment: state.lyricsAlignment,
        chineseVariant: state.chineseVariant,
        koreanDisplay: state.koreanDisplay,
        lyricsTranslationRequest: state.lyricsTranslationRequest, // Persist translation state
        lyricsTranslationLanguage: state.lyricsTranslationLanguage, // Persist translation language preference
        isFullScreen: state.isFullScreen,
        libraryState: state.libraryState,
        lastKnownVersion: state.lastKnownVersion,
      }),
      migrate: (persistedState, version) => {
        let state = persistedState as IpodState; // Type assertion

        // If the persisted version is older than the current version, update defaults
        if (version < CURRENT_IPOD_STORE_VERSION) {
          console.log(
            `Migrating iPod store from version ${version} to ${CURRENT_IPOD_STORE_VERSION}`
          );
          state = {
            ...state,
            tracks: [],
            currentIndex: 0,
            isPlaying: false,
            isShuffled: state.isShuffled, // Keep shuffle preference maybe? Or reset? Let's keep it for now.
            showLyrics: state.showLyrics ?? true, // Add default for migration
            lyricsAlignment:
              state.lyricsAlignment ?? LyricsAlignment.FocusThree,
            chineseVariant: state.chineseVariant ?? ChineseVariant.Traditional,
            koreanDisplay: state.koreanDisplay ?? KoreanDisplay.Original,
            uiVariant: state.uiVariant ?? "modern", // Default to the modern color screen skin
            lyricsTranslationRequest: state.lyricsTranslationRequest ?? null, // Preserve existing translation state
            lyricsTranslationLanguage: state.lyricsTranslationLanguage ?? null, // Preserve existing translation language preference
            libraryState: "uninitialized" as LibraryState, // Reset to uninitialized on migration
            lastKnownVersion: state.lastKnownVersion ?? 0,
          };
        }
        // Clean up potentially outdated fields if needed in future migrations
        // Example: delete state.someOldField;

        // Ensure the returned state matches the latest IpodStoreState structure
        // Remove fields not present in the latest partialize if necessary
        const partializedState = {
          tracks: state.tracks,
          currentIndex: state.currentIndex,
          loopAll: state.loopAll,
          loopCurrent: state.loopCurrent,
          isShuffled: state.isShuffled,
          theme: state.theme,
          uiVariant: state.uiVariant,
          lcdFilterOn: state.lcdFilterOn,
          showLyrics: state.showLyrics, // Persist lyrics visibility
          lyricsAlignment: state.lyricsAlignment,
          chineseVariant: state.chineseVariant,
          koreanDisplay: state.koreanDisplay,
          lyricsTranslationRequest: state.lyricsTranslationRequest, // Persist translation state
          lyricsTranslationLanguage: state.lyricsTranslationLanguage, // Persist translation language preference
          isFullScreen: state.isFullScreen,
          libraryState: state.libraryState,
        };

        return partializedState as IpodState; // Return the potentially migrated state
      },
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error("Error rehydrating iPod store:", error);
          } else if (state && state.libraryState === "uninitialized") {
            // Only auto-initialize if library state is uninitialized
            Promise.resolve(state.initializeLibrary()).catch((err) =>
              console.error("Initialization failed on rehydrate", err)
            );
          }
        };
      },
    }
  )
);
