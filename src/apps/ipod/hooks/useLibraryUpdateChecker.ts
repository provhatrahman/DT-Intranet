import { useEffect, useRef } from "react";
import { useIpodStore } from "@/stores/useIpodStore";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

export function useLibraryUpdateChecker(isActive: boolean) {
  const { t } = useTranslation();
  const syncLibrary = useIpodStore((state) => state.syncLibrary);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckedRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive) {
      // Clear interval when app is not active
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const checkForUpdates = async () => {
      try {
        const wasEmpty = useIpodStore.getState().tracks.length === 0;

        // Pull the collective library from the server and reconcile. syncLibrary
        // only mutates the store when something actually changed, so we can key
        // the toast off the returned counts.
        const result = await syncLibrary();

        console.log("[iPod] Auto update check:", {
          newTracksAdded: result.newTracksAdded,
          tracksUpdated: result.tracksUpdated,
          totalTracks: result.totalTracks,
        });

        if (result.newTracksAdded > 0 || result.tracksUpdated > 0) {
          const message =
            wasEmpty && result.newTracksAdded > 0
              ? t("apps.ipod.dialogs.addedSongsToTop", {
                  count: result.newTracksAdded,
                  plural: result.newTracksAdded === 1 ? "" : "s",
                })
              : result.newTracksAdded > 0
              ? t("apps.ipod.dialogs.autoUpdatedLibraryAddedSongs", {
                  newCount: result.newTracksAdded,
                  newPlural: result.newTracksAdded === 1 ? "" : "s",
                  updatedText:
                    result.tracksUpdated > 0
                      ? t("apps.ipod.dialogs.andUpdated", {
                          count: result.tracksUpdated,
                          plural: result.tracksUpdated === 1 ? "" : "s",
                        })
                      : "",
                })
              : t("apps.ipod.dialogs.autoUpdatedTrackMetadata", {
                  count: result.tracksUpdated,
                });

          toast.success(t("apps.ipod.dialogs.libraryAutoUpdated"), {
            description: message,
            duration: 4000,
          });

          console.log(
            `[iPod] Auto-updated: ${result.newTracksAdded} new tracks, ${result.tracksUpdated} updated tracks`
          );
        }
      } catch (error) {
        console.error("Error checking for library updates:", error);
      }
    };

    // Always check immediately when app becomes active (with a small delay to allow store to rehydrate)
    const immediateCheckTimeout = setTimeout(() => {
      console.log(
        "[iPod] Running immediate library update check on app activation"
      );
      checkForUpdates();
      lastCheckedRef.current = Date.now();
    }, 100);

    // Set up periodic checking
    intervalRef.current = setInterval(() => {
      checkForUpdates();
      lastCheckedRef.current = Date.now();
    }, CHECK_INTERVAL);

    return () => {
      clearTimeout(immediateCheckTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, syncLibrary]);

  // Manual check function that can be called externally
  const manualCheck = async () => {
    try {
      const wasEmptyBefore = useIpodStore.getState().tracks.length === 0;
      const result = await syncLibrary();

      if (result.newTracksAdded > 0 || result.tracksUpdated > 0) {
        const message =
          wasEmptyBefore && result.newTracksAdded > 0
            ? t("apps.ipod.dialogs.addedSongsToTop", {
                count: result.newTracksAdded,
                plural: result.newTracksAdded === 1 ? "" : "s",
              })
            : t("apps.ipod.dialogs.addedNewSongsToTop", {
                newCount: result.newTracksAdded,
                newPlural: result.newTracksAdded === 1 ? "" : "s",
                updatedText:
                  result.tracksUpdated > 0
                    ? t("apps.ipod.dialogs.andUpdated", {
                        count: result.tracksUpdated,
                        plural: result.tracksUpdated === 1 ? "" : "s",
                      })
                    : "",
                total: result.totalTracks,
              });

        toast.success(t("apps.ipod.dialogs.libraryUpdated"), {
          description: message,
        });
        return true;
      } else {
        toast.info(t("apps.ipod.dialogs.noUpdates"), {
          description: t("apps.ipod.dialogs.libraryAlreadyUpToDate"),
        });
        return false;
      }
    } catch (error) {
      console.error("Error during manual library update check:", error);
      toast.error(t("apps.ipod.dialogs.updateCheckFailed"), {
        description: t("apps.ipod.dialogs.failedToCheckForLibraryUpdates"),
      });
      return false;
    }
  };

  // Manual sync function that syncs with server library
  const manualSync = async () => {
    try {
      const wasEmptyBefore = useIpodStore.getState().tracks.length === 0;
      const result = await syncLibrary();

      if (result.newTracksAdded > 0 || result.tracksUpdated > 0) {
        const message =
          wasEmptyBefore && result.newTracksAdded > 0
            ? t("apps.ipod.dialogs.addedSongsToTop", {
                count: result.newTracksAdded,
                plural: result.newTracksAdded === 1 ? "" : "s",
              })
            : t("apps.ipod.dialogs.addedNewSongsToTop", {
                newCount: result.newTracksAdded,
                newPlural: result.newTracksAdded === 1 ? "" : "s",
                updatedText:
                  result.tracksUpdated > 0
                    ? t("apps.ipod.dialogs.andUpdated", {
                        count: result.tracksUpdated,
                        plural: result.tracksUpdated === 1 ? "" : "s",
                      })
                    : "",
                total: result.totalTracks,
              });

        toast.success(t("apps.ipod.dialogs.librarySynced"), {
          description: message,
        });
      } else {
        toast.info(t("apps.ipod.dialogs.librarySynced"), {
          description: t("apps.ipod.dialogs.libraryUpToDateWithSongs", {
            count: result.totalTracks,
          }),
        });
      }
      return true;
    } catch (error) {
      console.error("Error during library sync:", error);
      toast.error(t("apps.ipod.dialogs.syncFailed"), {
        description: t("apps.ipod.dialogs.failedToSyncWithServerLibrary"),
      });
      return false;
    }
  };

  return { manualCheck, manualSync };
}
