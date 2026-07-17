import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import { useThemeStore } from "./stores/useThemeStore";
import { useLanguageStore } from "./stores/useLanguageStore";
import { preloadFileSystemData } from "./stores/useFilesStore";
import { preloadIpodData } from "./stores/useIpodStore";
import { initPrefetch } from "./utils/prefetch";
import {
  initializeI18nForFirstPaint,
  ensureCurrentLanguageResources,
} from "./lib/i18n";
import { primeReactResources } from "./lib/reactResources";

// Prime React 19 resource hints before anything else runs
primeReactResources();

// ============================================================================
// CHUNK LOAD ERROR HANDLING - Reload when old assets 404 after deployment
// ============================================================================
window.addEventListener("vite:preloadError", (event) => {
  console.warn("[ryOS] Chunk load failed, reloading for fresh assets...", event);
  window.location.reload();
});

// ============================================================================
// PRELOADING - Start fetching JSON data early (non-blocking)
// These run in parallel before React even mounts
// ============================================================================
preloadFileSystemData();
preloadIpodData();

// ============================================================================
// PREFETCHING - Cache icons, sounds, and app components after boot
// This runs during idle time to populate the service worker cache
// ============================================================================
initPrefetch();

// Hydrate theme from localStorage before rendering (first paint attributes
// are already set by the inline bootstrap script in index.html).
useThemeStore.getState().hydrate();

// i18n now initializes lazily (src/lib/i18n.ts loads only the small "shell"
// bundle eagerly, then the full per-language translation bundle in the
// background) instead of as a side effect of importing the module, so it
// must be awaited before the language store hydrates and the app renders.
async function bootstrap() {
  try {
    await initializeI18nForFirstPaint();
  } catch (error) {
    console.error("[ryOS] Failed to initialize i18n during bootstrap:", error);
  }

  useLanguageStore.getState().hydrate();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
      <Analytics />
    </React.StrictMode>
  );

  // Backfill the rest of the current language's translations after first paint.
  void ensureCurrentLanguageResources();
}

void bootstrap();
