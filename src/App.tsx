import { AppManager } from "./apps/base/AppManager";
import { appRegistry } from "./config/appRegistry";
import { useEffect, useState, useMemo } from "react";
import { applyDisplayMode } from "./utils/displayMode";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { useAppStoreShallow } from "@/stores/helpers";
import { useDisplaySettingsStore } from "@/stores/useDisplaySettingsStore";
import { BootScreen } from "./components/dialogs/BootScreen";
import { LoginScreen } from "./components/dialogs/LoginScreen";
import { getNextBootMessage, clearNextBootMessage } from "./utils/bootMessage";
import { AnyApp } from "./apps/base/types";
import { useThemeStore } from "./stores/useThemeStore";
import { useIsMobile } from "./hooks/useIsMobile";
import { useOffline } from "./hooks/useOffline";
import { useTranslation } from "react-i18next";
import { isTauri } from "./utils/platform";
import { checkDesktopUpdate, onDesktopUpdate, DesktopUpdateResult } from "./utils/prefetch";
import { Download } from "lucide-react";
import { ScreenSaverOverlay } from "./components/screensavers/ScreenSaverOverlay";
import { useAuthStore } from "./stores/useAuthStore";
import { AUTH_ENABLED, AUTH_CALLBACK_PATH } from "./config/auth";

// Convert registry to array, filtering out hidden apps
const apps: AnyApp[] = Object.values(appRegistry).filter(
  (app) => !(app as { hidden?: boolean }).hidden
);

export function App() {
  const { t } = useTranslation();
  const { isFirstBoot, setHasBooted, setLastSeenDesktopVersion } =
    useAppStoreShallow((state) => ({
      isFirstBoot: state.isFirstBoot,
      setHasBooted: state.setHasBooted,
      setLastSeenDesktopVersion: state.setLastSeenDesktopVersion,
    }));
  const displayMode = useDisplaySettingsStore((state) => state.displayMode);
  const currentTheme = useThemeStore((state) => state.current);
  const isMobile = useIsMobile();
  // Initialize offline detection
  useOffline();

  // Determine toast position and offset based on theme and device
  const toastConfig = useMemo(() => {
    const isWindowsTheme = currentTheme === "xp" || currentTheme === "win98";
    const dockHeight = currentTheme === "macosx" ? 56 : 0;
    const taskbarHeight = isWindowsTheme ? 30 : 0;
    
    // Mobile: always show at bottom-center with dock/taskbar and safe area clearance
    if (isMobile) {
      const bottomOffset = dockHeight + taskbarHeight + 16;
      return {
        position: "bottom-center" as const,
        offset: `calc(env(safe-area-inset-bottom, 0px) + ${bottomOffset}px)`,
      };
    }

    if (isWindowsTheme) {
      // Windows themes: bottom-right with taskbar clearance (30px + padding)
      return {
        position: "bottom-right" as const,
        offset: `calc(env(safe-area-inset-bottom, 0px) + 42px)`,
      };
    } else {
      // macOS themes: top-right with menubar clearance
      const menuBarHeight = currentTheme === "system7" ? 30 : 25;
      return {
        position: "top-right" as const,
        offset: `${menuBarHeight + 12}px`,
      };
    }
  }, [currentTheme, isMobile]);

  const [bootScreenMessage, setBootScreenMessage] = useState<string | null>(
    null
  );
  const [showBootScreen, setShowBootScreen] = useState(false);
  const [showLoginScreen, setShowLoginScreen] = useState(false);

  // Auth (gated behind AUTH_ENABLED; no-op otherwise).
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const authExpiresAt = useAuthStore((s) => s.expiresAt);
  const authError = useAuthStore((s) => s.error);
  const startLogin = useAuthStore((s) => s.startLogin);
  const handleCallback = useAuthStore((s) => s.handleCallback);
  const isOnCallback =
    typeof window !== "undefined" &&
    window.location.pathname === AUTH_CALLBACK_PATH;
  const isAuthed =
    authStatus === "authenticated" &&
    !!authUser &&
    (!authExpiresAt || Date.now() < authExpiresAt);

  // Complete the OAuth redirect: exchange ?code, verify, then restore the URL.
  useEffect(() => {
    if (!AUTH_ENABLED || !isOnCallback) return;
    let cancelled = false;
    (async () => {
      await handleCallback(window.location.search);
      if (cancelled) return;
      const returnTo =
        sessionStorage.getItem("greenroom:return_to") || "/";
      sessionStorage.removeItem("greenroom:return_to");
      history.replaceState(null, "", returnTo);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOnCallback, handleCallback]);

  useEffect(() => {
    applyDisplayMode(displayMode);
  }, [displayMode]);

  // Preview trigger for the (dummy) Aqua login screen. Fired from Control
  // Panels (Debug), or by navigating straight to #login.
  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash.replace(/^#\/?/, "") === "login") {
        setShowLoginScreen(true);
      }
    };
    const show = () => setShowLoginScreen(true);
    syncFromHash();
    window.addEventListener("ryos:show-login", show);
    window.addEventListener("hashchange", syncFromHash);
    return () => {
      window.removeEventListener("ryos:show-login", show);
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, []);

  useEffect(() => {
    // Only show boot screen for system operations (reset/restore/format/debug)
    const persistedMessage = getNextBootMessage();
    if (persistedMessage) {
      setBootScreenMessage(persistedMessage);
      setShowBootScreen(true);
    }

    // Set first boot flag without showing boot screen
    if (isFirstBoot) {
      setHasBooted();
    }
  }, [isFirstBoot, setHasBooted]);

  // Show download toast for macOS users when new desktop version is available
  // For web: show on first visit and updates
  // For Tauri: only show on updates (not first time)
  useEffect(() => {
    const isMacOS = navigator.platform.toLowerCase().includes("mac");
    const isInTauri = isTauri();

    if (!isMacOS) {
      return;
    }

    // Handler for showing the desktop update toast
    const showDesktopUpdateToast = (result: DesktopUpdateResult) => {
      if (result.type === 'update' && result.version) {
        // Mark as seen immediately so dismissing the toast won't show it again
        setLastSeenDesktopVersion(result.version);
        // New version available - show update toast (both web and Tauri)
        toast(`ryOS ${result.version} for Mac is available`, {
          id: 'desktop-update',
          icon: <Download className="h-4 w-4" />,
          duration: Infinity,
          action: {
            label: "Download",
            onClick: () => {
              window.open(
                `https://github.com/ryokun6/ryos/releases/download/v${result.version}/ryOS_${result.version}_aarch64.dmg`,
                "_blank"
              );
            },
          },
        });
      } else if (result.type === 'first-time' && result.version && !isInTauri) {
        // Mark as seen immediately so dismissing the toast won't show it again
        setLastSeenDesktopVersion(result.version);
        // First time user on web - show initial download toast (not in Tauri)
        toast("ryOS is available as a Mac app", {
          id: 'desktop-update',
          icon: <Download className="h-4 w-4" />,
          duration: Infinity,
          action: {
            label: "Download",
            onClick: () => {
              window.open(
                `https://github.com/ryokun6/ryos/releases/download/v${result.version}/ryOS_${result.version}_aarch64.dmg`,
                "_blank"
              );
            },
          },
        });
      } else if (result.type === 'first-time' && result.version && isInTauri) {
        // First time in Tauri - just store the version without showing toast
        setLastSeenDesktopVersion(result.version);
      }
    };

    // Register callback for periodic/manual update checks
    onDesktopUpdate(showDesktopUpdateToast);

    // Initial check on load (delayed to let app render first)
    const timer = setTimeout(async () => {
      const result = await checkDesktopUpdate();
      showDesktopUpdateToast(result);
    }, 2000);

    return () => clearTimeout(timer);
  }, [setLastSeenDesktopVersion]);

  if (showBootScreen) {
    return (
      <BootScreen
        isOpen={true}
        onOpenChange={() => {}}
        title={bootScreenMessage || t("common.system.systemRestoring")}
        onBootComplete={() => {
          clearNextBootMessage();
          setShowBootScreen(false);
        }}
      />
    );
  }

  // Auth gate: when enabled, require a verified session before the desktop.
  // The Aqua LoginScreen doubles as the gate (real Google flow) and, when auth
  // is off, as the dummy #login / Control Panels preview overlay.
  if (AUTH_ENABLED && !isAuthed) {
    return (
      <LoginScreen
        isOpen={true}
        authEnabled
        busy={authStatus === "authenticating" || isOnCallback}
        errorMessage={authError}
        onGoogleLogin={startLogin}
      />
    );
  }

  return (
    <>
      <AppManager apps={apps} />
      <Toaster position={toastConfig.position} offset={toastConfig.offset} />
      <ScreenSaverOverlay />
      <LoginScreen
        isOpen={showLoginScreen}
        onLogin={() => {
          setShowLoginScreen(false);
          if (window.location.hash) history.replaceState(null, "", " ");
        }}
        onCancel={() => {
          setShowLoginScreen(false);
          if (window.location.hash) history.replaceState(null, "", " ");
        }}
      />
    </>
  );
}
