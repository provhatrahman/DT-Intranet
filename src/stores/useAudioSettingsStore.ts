import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useStoreShallow } from "./helpers";

/**
 * Audio settings store - manages volume controls and audio preferences.
 * Extracted from useAppStore (mirroring MAIN's useAudioSettingsStore) to
 * reduce useAppStore's surface area and improve separation of concerns.
 *
 * Ducking-factor fields present in MAIN's version (`ttsMusicDuckingFactor`,
 * `ttsChatSynthDuckingFactor`) are dropped here: they exist upstream to duck
 * music/synth volume while the desktop assistant speaks, and Greenroom does
 * not carry the assistant subsystem.
 */

interface AudioSettingsState {
  // Volume controls
  masterVolume: number;
  uiVolume: number;
  chatSynthVolume: number;
  speechVolume: number;
  ipodVolume: number;

  // Audio feature toggles
  uiSoundsEnabled: boolean;
  terminalSoundsEnabled: boolean;
  typingSynthEnabled: boolean;
  speechEnabled: boolean;
  keepTalkingEnabled: boolean;

  // TTS settings
  ttsModel: "openai" | "elevenlabs" | null;
  ttsVoice: string | null;
  /**
   * Preferred browser speechSynthesis voice (voiceURI) for the Sound pane's
   * browser TTS voice select. `null` picks a voice automatically.
   */
  browserTtsVoiceURI: string | null;
  synthPreset: string;

  // Actions
  setMasterVolume: (v: number) => void;
  setUiVolume: (v: number) => void;
  setChatSynthVolume: (v: number) => void;
  setSpeechVolume: (v: number) => void;
  setIpodVolume: (v: number) => void;
  setUiSoundsEnabled: (v: boolean) => void;
  setTerminalSoundsEnabled: (v: boolean) => void;
  setTypingSynthEnabled: (v: boolean) => void;
  setSpeechEnabled: (v: boolean) => void;
  setKeepTalkingEnabled: (v: boolean) => void;
  setTtsModel: (m: "openai" | "elevenlabs" | null) => void;
  setTtsVoice: (v: string | null) => void;
  setBrowserTtsVoiceURI: (v: string | null) => void;
  setSynthPreset: (v: string) => void;
}

const STORE_VERSION = 1;

/**
 * Migration source: fields used to live on useAppStore under localStorage
 * key "ryos:app-store". Read that blob synchronously once so existing users
 * keep their volumes/sound toggles after the store split.
 */
function readLegacyAudioSettings(): Partial<AudioSettingsState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("ryos:app-store");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    const legacy = parsed.state;
    if (!legacy || typeof legacy !== "object") return null;
    const out: Partial<AudioSettingsState> = {};
    if (typeof legacy.masterVolume === "number")
      out.masterVolume = legacy.masterVolume;
    if (typeof legacy.uiVolume === "number") out.uiVolume = legacy.uiVolume;
    if (typeof legacy.chatSynthVolume === "number")
      out.chatSynthVolume = legacy.chatSynthVolume;
    if (typeof legacy.speechVolume === "number")
      out.speechVolume = legacy.speechVolume;
    if (typeof legacy.ipodVolume === "number")
      out.ipodVolume = legacy.ipodVolume;
    if (typeof legacy.uiSoundsEnabled === "boolean")
      out.uiSoundsEnabled = legacy.uiSoundsEnabled;
    if (typeof legacy.terminalSoundsEnabled === "boolean")
      out.terminalSoundsEnabled = legacy.terminalSoundsEnabled;
    if (typeof legacy.typingSynthEnabled === "boolean")
      out.typingSynthEnabled = legacy.typingSynthEnabled;
    if (typeof legacy.speechEnabled === "boolean")
      out.speechEnabled = legacy.speechEnabled;
    if (typeof legacy.keepTalkingEnabled === "boolean")
      out.keepTalkingEnabled = legacy.keepTalkingEnabled;
    if (
      legacy.ttsModel === "openai" ||
      legacy.ttsModel === "elevenlabs" ||
      legacy.ttsModel === null
    )
      out.ttsModel = legacy.ttsModel;
    if (typeof legacy.ttsVoice === "string" || legacy.ttsVoice === null)
      out.ttsVoice = legacy.ttsVoice as string | null;
    if (typeof legacy.synthPreset === "string")
      out.synthPreset = legacy.synthPreset;
    return out;
  } catch (e) {
    console.error("[useAudioSettingsStore] failed to read legacy blob", e);
    return null;
  }
}

const legacyDefaults = readLegacyAudioSettings();

export const useAudioSettingsStore = create<AudioSettingsState>()(
  persist(
    (set) => ({
      // Defaults, seeded from the legacy useAppStore blob when present so
      // nobody loses their volume/sound settings on first load post-split.
      masterVolume: legacyDefaults?.masterVolume ?? 1,
      uiVolume: legacyDefaults?.uiVolume ?? 1,
      chatSynthVolume: legacyDefaults?.chatSynthVolume ?? 2,
      speechVolume: legacyDefaults?.speechVolume ?? 2,
      ipodVolume: legacyDefaults?.ipodVolume ?? 1,

      uiSoundsEnabled: legacyDefaults?.uiSoundsEnabled ?? true,
      terminalSoundsEnabled: legacyDefaults?.terminalSoundsEnabled ?? true,
      typingSynthEnabled: legacyDefaults?.typingSynthEnabled ?? false,
      speechEnabled: legacyDefaults?.speechEnabled ?? false,
      keepTalkingEnabled: legacyDefaults?.keepTalkingEnabled ?? true,

      ttsModel: legacyDefaults?.ttsModel ?? null,
      ttsVoice: legacyDefaults?.ttsVoice ?? null,
      browserTtsVoiceURI: null,
      synthPreset: legacyDefaults?.synthPreset ?? "classic",

      // Actions
      setMasterVolume: (v) => set({ masterVolume: v }),
      setUiVolume: (v) => set({ uiVolume: v }),
      setChatSynthVolume: (v) => set({ chatSynthVolume: v }),
      setSpeechVolume: (v) => set({ speechVolume: v }),
      setIpodVolume: (v) => set({ ipodVolume: v }),
      setUiSoundsEnabled: (v) => set({ uiSoundsEnabled: v }),
      setTerminalSoundsEnabled: (v) => set({ terminalSoundsEnabled: v }),
      setTypingSynthEnabled: (v) => set({ typingSynthEnabled: v }),
      setSpeechEnabled: (v) => set({ speechEnabled: v }),
      setKeepTalkingEnabled: (v) => set({ keepTalkingEnabled: v }),
      setTtsModel: (m) => set({ ttsModel: m }),
      setTtsVoice: (v) => set({ ttsVoice: v }),
      setBrowserTtsVoiceURI: (v) => set({ browserTtsVoiceURI: v }),
      setSynthPreset: (v) => set({ synthPreset: v }),
    }),
    {
      name: "ryos:audio-settings",
      version: STORE_VERSION,
      partialize: (state) => ({
        masterVolume: state.masterVolume,
        uiVolume: state.uiVolume,
        chatSynthVolume: state.chatSynthVolume,
        speechVolume: state.speechVolume,
        ipodVolume: state.ipodVolume,
        uiSoundsEnabled: state.uiSoundsEnabled,
        terminalSoundsEnabled: state.terminalSoundsEnabled,
        typingSynthEnabled: state.typingSynthEnabled,
        speechEnabled: state.speechEnabled,
        keepTalkingEnabled: state.keepTalkingEnabled,
        ttsModel: state.ttsModel,
        ttsVoice: state.ttsVoice,
        browserTtsVoiceURI: state.browserTtsVoiceURI,
        synthPreset: state.synthPreset,
      }),
    }
  )
);

// Re-export commonly used selectors for convenience
export const selectMasterVolume = (state: AudioSettingsState) =>
  state.masterVolume;
export const selectUiVolume = (state: AudioSettingsState) => state.uiVolume;
export const selectUiSoundsEnabled = (state: AudioSettingsState) =>
  state.uiSoundsEnabled;
export const selectEffectiveIpodVolume = (state: AudioSettingsState) =>
  state.ipodVolume * state.masterVolume;
export const selectEffectiveChatSynthVolume = (state: AudioSettingsState) =>
  state.chatSynthVolume * state.masterVolume;

/**
 * Shallow-equality selector hook for this store. Co-located with the store
 * (rather than a central helpers barrel) so importing it doesn't pull other
 * stores into the bundle.
 */
export function useAudioSettingsStoreShallow<T>(
  selector: (state: ReturnType<typeof useAudioSettingsStore.getState>) => T
): T {
  return useStoreShallow(useAudioSettingsStore, selector);
}
