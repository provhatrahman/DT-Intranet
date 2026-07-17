import { useState } from "react";
import { useAppHelpAboutDialogs } from "@/hooks/useAppHelpAboutDialogs";
import { useTranslation } from "react-i18next";
import { useTranslatedHelpItems } from "@/hooks/useTranslatedHelpItems";
import { helpItems } from "..";
import { useAudioSettingsStoreShallow } from "@/stores/useAudioSettingsStore";
import { useDisplaySettingsStoreShallow } from "@/stores/useDisplaySettingsStore";
import { forceRefreshCache } from "@/utils/prefetch";
import { useThemeFlags } from "@/hooks/useThemeFlags";
import { useThemeStore } from "@/stores/useThemeStore";
import { getTabStyles } from "@/utils/tabStyles";
import { useLanguageStore } from "@/stores/useLanguageStore";
import { useTimezoneStore } from "@/stores/useTimezoneStore";
import { getTranslatedAppName } from "@/utils/i18n";
import type { ControlPanelsInitialData } from "@/apps/base/types";

/**
 * Logic for the Greenroom-trimmed Control Panels app: appearance,
 * desktop & screen saver, displays, international, sound, software update.
 *
 * Hard-trimmed vs. MAIN's useControlPanelsLogic (~1400 lines): this fork
 * deliberately drops the ryOS account (auth/login/password/verify/logout),
 * cloud sync (.mac/auto-sync/force-upload/force-download), manual
 * backup/restore/reset/format, Telegram link, recovery email, AI-model /
 * ElevenLabs-OpenAI TTS-model selection, and debug boot-screen/crash-test
 * tooling that used to live in Accounts/Security/Sharing/.Mac/Assistant
 * panes — none of those panes exist in this build (see CLAUDE.md / the
 * Phase 3 task brief). Only the state + handlers the six surviving panes,
 * the menu bar, and the software-update check actually consume are kept.
 */
export interface UseControlPanelsLogicProps {
  initialData?: ControlPanelsInitialData;
}

// `initialData.defaultTab` is consumed directly by ControlPanelsMacLayout
// (via the component's own `initialData` prop), not by this hook — kept in
// the signature for parity with every other app's `use*Logic({ initialData })`
// hook shape.
export function useControlPanelsLogic({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  initialData: _initialData,
}: UseControlPanelsLogicProps) {
  const { t } = useTranslation();
  const translatedHelpItems = useTranslatedHelpItems(
    "control-panels",
    helpItems
  );
  const {
    isHelpDialogOpen,
    setIsHelpDialogOpen,
    isAboutDialogOpen,
    setIsAboutDialogOpen,
  } = useAppHelpAboutDialogs();

  // Display settings from display settings store
  const { shaderEffectEnabled, setShaderEffectEnabled } =
    useDisplaySettingsStoreShallow((s) => ({
      shaderEffectEnabled: s.shaderEffectEnabled,
      setShaderEffectEnabled: s.setShaderEffectEnabled,
    }));

  // Audio settings from audio settings store
  const {
    terminalSoundsEnabled,
    setTerminalSoundsEnabled,
    uiSoundsEnabled,
    setUiSoundsEnabled,
    uiVolume,
    setUiVolume,
    speechEnabled,
    setSpeechEnabled,
    chatSynthVolume,
    setChatSynthVolume,
    speechVolume,
    setSpeechVolume,
    browserTtsVoiceURI,
    setBrowserTtsVoiceURI,
    synthPreset,
    setSynthPreset,
    ipodVolume,
    setIpodVolume,
    masterVolume,
    setMasterVolume,
  } = useAudioSettingsStoreShallow((s) => ({
    terminalSoundsEnabled: s.terminalSoundsEnabled,
    setTerminalSoundsEnabled: s.setTerminalSoundsEnabled,
    uiSoundsEnabled: s.uiSoundsEnabled,
    setUiSoundsEnabled: s.setUiSoundsEnabled,
    uiVolume: s.uiVolume,
    setUiVolume: s.setUiVolume,
    speechEnabled: s.speechEnabled,
    setSpeechEnabled: s.setSpeechEnabled,
    chatSynthVolume: s.chatSynthVolume,
    setChatSynthVolume: s.setChatSynthVolume,
    speechVolume: s.speechVolume,
    setSpeechVolume: s.setSpeechVolume,
    browserTtsVoiceURI: s.browserTtsVoiceURI,
    setBrowserTtsVoiceURI: s.setBrowserTtsVoiceURI,
    synthPreset: s.synthPreset,
    setSynthPreset: s.setSynthPreset,
    ipodVolume: s.ipodVolume,
    setIpodVolume: s.setIpodVolume,
    masterVolume: s.masterVolume,
    setMasterVolume: s.setMasterVolume,
  }));

  // Theme state
  const {
    currentTheme,
    supportsDarkMode,
    isDarkMode,
    darkModePreference,
    supportsAccent,
    accent,
    macChrome,
    isWindowsTheme,
    isMacOSTheme,
    aquaMaterial,
  } = useThemeFlags();
  const setTheme = useThemeStore((state) => state.setTheme);
  const setDarkMode = useThemeStore((state) => state.setDarkMode);
  const setAccent = useThemeStore((state) => state.setAccent);
  const setAquaMaterial = useThemeStore((state) => state.setAquaMaterial);
  const wallpaperAccentColor = useThemeStore(
    (state) => state.wallpaperAccentColor
  );

  // Language state
  const currentLanguage = useLanguageStore((state) => state.current);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  // Timezone state
  const timezone = useTimezoneStore((state) => state.timezone);
  const setTimezone = useTimezoneStore((state) => state.setTimezone);

  // States for previous volume levels for mute/unmute functionality
  const [prevMasterVolume, setPrevMasterVolume] = useState(
    masterVolume > 0 ? masterVolume : 1
  );
  const [prevUiVolume, setPrevUiVolume] = useState(uiVolume > 0 ? uiVolume : 1);
  const [prevSpeechVolume, setPrevSpeechVolume] = useState(
    speechVolume > 0 ? speechVolume : 1
  );
  const [prevChatSynthVolume, setPrevChatSynthVolume] = useState(
    chatSynthVolume > 0 ? chatSynthVolume : 1
  );
  const [prevIpodVolume, setPrevIpodVolume] = useState(
    ipodVolume > 0 ? ipodVolume : 1
  );

  // Detect iOS Safari – volume API does not work for YouTube embeds there
  const isIOS =
    typeof navigator !== "undefined" &&
    /iP(hone|od|ad)/.test(navigator.userAgent);

  const handleUISoundsChange = (enabled: boolean) => {
    setUiSoundsEnabled(enabled);
  };

  const handleSpeechChange = (enabled: boolean) => {
    setSpeechEnabled(enabled);
  };

  const handleBrowserTtsVoiceChange = (voiceURI: string | null) => {
    setBrowserTtsVoiceURI(voiceURI);
  };

  const handleSynthPresetChange = (value: string) => {
    setSynthPreset(value);
  };

  // Mute toggle handlers
  const handleMasterMuteToggle = () => {
    if (masterVolume > 0) {
      setPrevMasterVolume(masterVolume);
      setMasterVolume(0);
    } else {
      setMasterVolume(prevMasterVolume);
    }
  };

  const handleUiMuteToggle = () => {
    if (uiVolume > 0) {
      setPrevUiVolume(uiVolume);
      setUiVolume(0);
    } else {
      setUiVolume(prevUiVolume);
    }
  };

  const handleSpeechMuteToggle = () => {
    if (speechVolume > 0) {
      setPrevSpeechVolume(speechVolume);
      setSpeechVolume(0);
    } else {
      setSpeechVolume(prevSpeechVolume);
    }
  };

  const handleChatSynthMuteToggle = () => {
    if (chatSynthVolume > 0) {
      setPrevChatSynthVolume(chatSynthVolume);
      setChatSynthVolume(0);
    } else {
      setChatSynthVolume(prevChatSynthVolume);
    }
  };

  const handleIpodMuteToggle = () => {
    if (isIOS) return;
    if (ipodVolume > 0) {
      setPrevIpodVolume(ipodVolume);
      setIpodVolume(0);
    } else {
      setIpodVolume(prevIpodVolume);
    }
  };

  const tabStyles = getTabStyles(currentTheme);
  const windowTitle = getTranslatedAppName("control-panels");

  const handleCheckForUpdates = () => {
    forceRefreshCache();
  };

  return {
    t,
    translatedHelpItems,
    windowTitle,
    isHelpDialogOpen,
    setIsHelpDialogOpen,
    isAboutDialogOpen,
    setIsAboutDialogOpen,
    handleCheckForUpdates,
    shaderEffectEnabled,
    setShaderEffectEnabled,
    currentTheme,
    setTheme,
    aquaMaterial,
    setAquaMaterial,
    supportsDarkMode,
    isDarkMode,
    darkModePreference,
    setDarkMode,
    supportsAccent,
    accent,
    accentChrome: macChrome,
    setAccent,
    wallpaperAccentColor,
    currentLanguage,
    setLanguage,
    timezone,
    setTimezone,
    tabStyles,
    isWindowsTheme,
    isMacOSTheme,
    uiSoundsEnabled,
    handleUISoundsChange,
    speechEnabled,
    handleSpeechChange,
    browserTtsVoiceURI,
    handleBrowserTtsVoiceChange,
    terminalSoundsEnabled,
    setTerminalSoundsEnabled,
    synthPreset,
    handleSynthPresetChange,
    masterVolume,
    setMasterVolume,
    setPrevMasterVolume,
    handleMasterMuteToggle,
    uiVolume,
    setUiVolume,
    setPrevUiVolume,
    handleUiMuteToggle,
    speechVolume,
    setSpeechVolume,
    setPrevSpeechVolume,
    handleSpeechMuteToggle,
    chatSynthVolume,
    setChatSynthVolume,
    setPrevChatSynthVolume,
    handleChatSynthMuteToggle,
    ipodVolume,
    setIpodVolume,
    setPrevIpodVolume,
    handleIpodMuteToggle,
    isIOS,
  };
}
