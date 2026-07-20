import type { AppId } from "@/config/appIds";

/**
 * App name shown in the title of the general "how to use" guide dialog
 * (renders as "Welcome to Greenroom"). Consumed by `HelpGuideDialog`.
 */
export const GENERAL_HELP_APP_NAME = "Greenroom";

/**
 * Greenroom domain apps that get a per-app guide in the desktop Help menu,
 * ordered to follow the workflow. (`incoming-offers` is branded "Inbox".)
 * The guide content itself lives in `src/components/help/guides/*`.
 */
export const HELP_GUIDE_APP_IDS: AppId[] = [
  "pitch",
  "incoming-offers",
  "active-projects",
  "archive",
  "feedback",
];
