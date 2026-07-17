import { useAppStoreShallow } from "@/stores/helpers";

/**
 * Simplified vs. MAIN: upstream's VersionDisplay links out to os.ryo.lu's own
 * docs (changelog/privacy/terms) via `getDocsBaseUrl()` + the Internet
 * Explorer app. Greenroom has no equivalent docs site to point those links
 * at, so this is trimmed to a plain version/build string.
 */
export function VersionDisplay() {
  const { ryOSVersion, ryOSBuildNumber } = useAppStoreShallow((state) => ({
    ryOSVersion: state.ryOSVersion,
    ryOSBuildNumber: state.ryOSBuildNumber,
  }));

  const displayVersion = ryOSVersion || "...";
  const displayBuild = ryOSBuildNumber ? ` (Build ${ryOSBuildNumber})` : "";

  return (
    <p className="text-[11px] text-neutral-600 font-geneva-12">
      ryOS {displayVersion}
      {displayBuild}
    </p>
  );
}
