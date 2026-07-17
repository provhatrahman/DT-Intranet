import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useStoreShallow } from "./helpers";
import { ShaderType } from "@/types/shader";
import { DisplayMode } from "@/utils/displayMode";
import { checkShaderPerformance } from "@/utils/performanceCheck";
import { ensureIndexedDBInitialized } from "@/utils/indexedDB";
import { SETTINGS_ANALYTICS, track } from "@/utils/analytics";

/**
 * Display settings store - manages wallpaper, shaders, screen saver, and a
 * couple of misc UI-preference settings. Extracted from useAppStore, mirroring
 * MAIN's useDisplaySettingsStore split.
 *
 * Trimmed vs. MAIN: no cloud-sync hooks (emitCloudSyncDomainChange /
 * useCloudSyncStore — Greenroom has no cloud-sync subsystem), no dynamic
 * wallpaper resolution (shuffle / weather / day-night / now-playing cover —
 * not present in this fork, wallpapers here are always static assets), and no
 * debug console/network capture side effects on `setDebugMode` (those capture
 * utilities don't exist in this fork; `debugMode` here is a plain flag as it
 * was on the old useAppStore).
 */

// IndexedDB helpers for custom wallpapers (unchanged from the old useAppStore)
export const INDEXEDDB_PREFIX = "indexeddb://";
const CUSTOM_WALLPAPERS_STORE = "custom_wallpapers";
const objectURLs: Record<string, string> = {};

type StoredWallpaper = { blob?: Blob; content?: string; [k: string]: unknown };

const dataURLToBlob = (dataURL: string): Blob | null => {
  try {
    if (!dataURL.startsWith("data:")) return null;
    const arr = dataURL.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new Blob([u8], { type: mime });
  } catch (e) {
    console.error("dataURLToBlob", e);
    return null;
  }
};

const saveCustomWallpaper = async (file: File): Promise<string> => {
  if (!file.type.startsWith("image/"))
    throw new Error("Only image files allowed");
  try {
    const db = await ensureIndexedDBInitialized();
    const tx = db.transaction(CUSTOM_WALLPAPERS_STORE, "readwrite");
    const store = tx.objectStore(CUSTOM_WALLPAPERS_STORE);
    const name = `custom_${Date.now()}_${file.name.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    )}`;
    const rec = {
      name,
      blob: file,
      content: "",
      type: file.type,
      dateAdded: new Date().toISOString(),
    };
    await new Promise<void>((res, rej) => {
      const r = store.put(rec, name);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    db.close();
    return `${INDEXEDDB_PREFIX}${name}`;
  } catch (e) {
    console.error("saveCustomWallpaper", e);
    throw e;
  }
};

interface DisplaySettingsState {
  // Display mode
  displayMode: DisplayMode;
  setDisplayMode: (m: DisplayMode) => void;

  // Shader settings
  shaderEffectEnabled: boolean;
  selectedShaderType: ShaderType;
  setShaderEffectEnabled: (v: boolean) => void;
  setSelectedShaderType: (t: ShaderType) => void;

  // Wallpaper
  currentWallpaper: string;
  wallpaperSource: string;
  setCurrentWallpaper: (p: string) => void;
  setWallpaper: (p: string | File) => Promise<void>;
  loadCustomWallpapers: () => Promise<string[]>;
  deleteCustomWallpaper: (reference: string) => Promise<void>;
  getWallpaperData: (reference: string) => Promise<string | null>;

  // Screen saver
  screenSaverEnabled: boolean;
  screenSaverType: string;
  screenSaverIdleTime: number; // minutes
  setScreenSaverEnabled: (v: boolean) => void;
  setScreenSaverType: (v: string) => void;
  setScreenSaverIdleTime: (v: number) => void;

  // Debug mode
  debugMode: boolean;
  setDebugMode: (v: boolean) => void;

  // HTML preview
  htmlPreviewSplit: boolean;
  setHtmlPreviewSplit: (v: boolean) => void;
}

const STORE_VERSION = 1;
const initialShaderState = checkShaderPerformance();

/**
 * Migration source: these fields used to live on useAppStore under
 * localStorage key "ryos:app-store". Read that blob synchronously once so
 * existing users keep their wallpaper/displayMode/screensaver settings after
 * the store split (mirrors MAIN's own upstream extraction).
 */
function readLegacyDisplaySettings(): Partial<DisplaySettingsState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("ryos:app-store");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    const legacy = parsed.state;
    if (!legacy || typeof legacy !== "object") return null;
    const out: Partial<DisplaySettingsState> = {};
    if (typeof legacy.displayMode === "string")
      out.displayMode = legacy.displayMode as DisplayMode;
    if (typeof legacy.shaderEffectEnabled === "boolean")
      out.shaderEffectEnabled = legacy.shaderEffectEnabled;
    if (typeof legacy.selectedShaderType === "string")
      out.selectedShaderType = legacy.selectedShaderType as ShaderType;
    if (typeof legacy.currentWallpaper === "string")
      out.currentWallpaper = legacy.currentWallpaper;
    if (typeof legacy.wallpaperSource === "string")
      out.wallpaperSource = legacy.wallpaperSource;
    if (typeof legacy.screenSaverEnabled === "boolean")
      out.screenSaverEnabled = legacy.screenSaverEnabled;
    if (typeof legacy.screenSaverType === "string")
      out.screenSaverType = legacy.screenSaverType;
    if (typeof legacy.screenSaverIdleTime === "number")
      out.screenSaverIdleTime = legacy.screenSaverIdleTime;
    if (typeof legacy.debugMode === "boolean")
      out.debugMode = legacy.debugMode;
    if (typeof legacy.htmlPreviewSplit === "boolean")
      out.htmlPreviewSplit = legacy.htmlPreviewSplit;
    return out;
  } catch (e) {
    console.error("[useDisplaySettingsStore] failed to read legacy blob", e);
    return null;
  }
}

const legacyDefaults = readLegacyDisplaySettings();

export const useDisplaySettingsStore = create<DisplaySettingsState>()(
  persist(
    (set, get) => ({
      // Display mode
      displayMode: legacyDefaults?.displayMode ?? "color",
      setDisplayMode: (m) => {
        const previousMode = get().displayMode;
        set({ displayMode: m });
        if (previousMode !== m) {
          track(SETTINGS_ANALYTICS.DISPLAY_MODE_CHANGE, { displayMode: m });
        }
      },

      // Shader settings
      shaderEffectEnabled:
        legacyDefaults?.shaderEffectEnabled ?? initialShaderState,
      selectedShaderType: legacyDefaults?.selectedShaderType ?? ShaderType.AURORA,
      setShaderEffectEnabled: (enabled) => {
        set({ shaderEffectEnabled: enabled });
        track(SETTINGS_ANALYTICS.SHADER_TOGGLE, { enabled });
      },
      setSelectedShaderType: (t) => {
        set({ selectedShaderType: t });
        track(SETTINGS_ANALYTICS.SHADER_TYPE_CHANGE, { shaderType: t });
      },

      // Wallpaper
      currentWallpaper:
        legacyDefaults?.currentWallpaper ??
        "/wallpapers/photos/aqua/daytimers-logo.png",
      wallpaperSource:
        legacyDefaults?.wallpaperSource ??
        "/wallpapers/photos/aqua/daytimers-logo.png",
      setCurrentWallpaper: (p) => set({ currentWallpaper: p, wallpaperSource: p }),

      setWallpaper: async (path) => {
        let wall: string;
        if (path instanceof File) {
          try {
            wall = await saveCustomWallpaper(path);
          } catch (e) {
            console.error("setWallpaper failed", e);
            return;
          }
        } else {
          wall = path;
        }
        set({ currentWallpaper: wall, wallpaperSource: wall });
        if (wall.startsWith(INDEXEDDB_PREFIX)) {
          const data = await get().getWallpaperData(wall);
          if (data) set({ wallpaperSource: data });
        }
        window.dispatchEvent(
          new CustomEvent("wallpaperChange", { detail: wall })
        );
        track(SETTINGS_ANALYTICS.WALLPAPER_CHANGE, {
          wallpaperKind: wall.startsWith(INDEXEDDB_PREFIX)
            ? "custom"
            : "built-in",
        });
      },

      loadCustomWallpapers: async () => {
        try {
          const db = await ensureIndexedDBInitialized();
          const tx = db.transaction(CUSTOM_WALLPAPERS_STORE, "readonly");
          const store = tx.objectStore(CUSTOM_WALLPAPERS_STORE);
          const keysReq = store.getAllKeys();
          const keys: string[] = await new Promise((res, rej) => {
            keysReq.onsuccess = () => res(keysReq.result as string[]);
            keysReq.onerror = () => rej(keysReq.error);
          });
          db.close();
          return keys.map((k) => `${INDEXEDDB_PREFIX}${k}`);
        } catch (e) {
          console.error("loadCustomWallpapers", e);
          return [];
        }
      },

      deleteCustomWallpaper: async (reference) => {
        const id = reference.startsWith(INDEXEDDB_PREFIX)
          ? reference.substring(INDEXEDDB_PREFIX.length)
          : reference;
        try {
          const db = await ensureIndexedDBInitialized();
          const tx = db.transaction(CUSTOM_WALLPAPERS_STORE, "readwrite");
          const store = tx.objectStore(CUSTOM_WALLPAPERS_STORE);
          await new Promise<void>((res, rej) => {
            const r = store.delete(id);
            r.onsuccess = () => res();
            r.onerror = () => rej(r.error);
          });
          db.close();
          if (objectURLs[id]) {
            URL.revokeObjectURL(objectURLs[id]);
            delete objectURLs[id];
          }
          if (get().currentWallpaper === reference) {
            set({
              currentWallpaper: "/wallpapers/photos/aqua/daytimers-logo.png",
              wallpaperSource: "/wallpapers/photos/aqua/daytimers-logo.png",
            });
          }
        } catch (e) {
          console.error("deleteCustomWallpaper", e);
        }
      },

      getWallpaperData: async (reference) => {
        if (!reference.startsWith(INDEXEDDB_PREFIX)) return reference;
        const id = reference.substring(INDEXEDDB_PREFIX.length);
        if (objectURLs[id]) return objectURLs[id];
        try {
          const db = await ensureIndexedDBInitialized();
          const tx = db.transaction(CUSTOM_WALLPAPERS_STORE, "readonly");
          const store = tx.objectStore(CUSTOM_WALLPAPERS_STORE);
          const req = store.get(id);
          const result = await new Promise<StoredWallpaper | null>(
            (res, rej) => {
              req.onsuccess = () => res(req.result as StoredWallpaper);
              req.onerror = () => rej(req.error);
            }
          );
          db.close();
          if (!result) return null;
          let objectURL: string | null = null;
          if (result.blob) objectURL = URL.createObjectURL(result.blob);
          else if (result.content) {
            const blob = dataURLToBlob(result.content);
            objectURL = blob ? URL.createObjectURL(blob) : result.content;
          }
          if (objectURL) {
            objectURLs[id] = objectURL;
            return objectURL;
          }
          return null;
        } catch (e) {
          console.error("getWallpaperData", e);
          return null;
        }
      },

      // Screen saver
      screenSaverEnabled: legacyDefaults?.screenSaverEnabled ?? false,
      screenSaverType: legacyDefaults?.screenSaverType ?? "starfield",
      screenSaverIdleTime: legacyDefaults?.screenSaverIdleTime ?? 5, // 5 minutes default
      setScreenSaverEnabled: (v) => {
        set({ screenSaverEnabled: v });
        track(SETTINGS_ANALYTICS.SCREENSAVER_CHANGE, { enabled: v });
      },
      setScreenSaverType: (v) => {
        set({ screenSaverType: v });
        track(SETTINGS_ANALYTICS.SCREENSAVER_CHANGE, { screenSaverType: v });
      },
      setScreenSaverIdleTime: (v) => {
        set({ screenSaverIdleTime: v });
        track(SETTINGS_ANALYTICS.SCREENSAVER_CHANGE, {
          idleMinutesBucket: v <= 5 ? "0-5" : v <= 15 ? "6-15" : "16+",
        });
      },

      // Debug mode
      debugMode: legacyDefaults?.debugMode ?? false,
      setDebugMode: (enabled) => set({ debugMode: enabled }),

      // HTML preview
      htmlPreviewSplit: legacyDefaults?.htmlPreviewSplit ?? true,
      setHtmlPreviewSplit: (v) => set({ htmlPreviewSplit: v }),
    }),
    {
      name: "ryos:display-settings",
      version: STORE_VERSION,
      partialize: (state) => ({
        displayMode: state.displayMode,
        shaderEffectEnabled: state.shaderEffectEnabled,
        selectedShaderType: state.selectedShaderType,
        currentWallpaper: state.currentWallpaper,
        wallpaperSource: state.wallpaperSource,
        screenSaverEnabled: state.screenSaverEnabled,
        screenSaverType: state.screenSaverType,
        screenSaverIdleTime: state.screenSaverIdleTime,
        debugMode: state.debugMode,
        htmlPreviewSplit: state.htmlPreviewSplit,
      }),
    }
  )
);

export const loadHtmlPreviewSplit = () =>
  useDisplaySettingsStore.getState().htmlPreviewSplit;
export const saveHtmlPreviewSplit = (v: boolean) =>
  useDisplaySettingsStore.getState().setHtmlPreviewSplit(v);

/**
 * Shallow-equality selector hook for this store. Co-located with the store
 * (rather than a central helpers barrel) so importing it doesn't pull other
 * stores into the bundle.
 */
export function useDisplaySettingsStoreShallow<T>(
  selector: (state: ReturnType<typeof useDisplaySettingsStore.getState>) => T
): T {
  return useStoreShallow(useDisplaySettingsStore, selector);
}
