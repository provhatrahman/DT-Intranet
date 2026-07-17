import type { AppId } from "@/config/appIds";

/**
 * Shape of a single guide card (matches the cards rendered by
 * `HelpDialog` — `{ icon, title, description }`).
 */
export type HelpGuideItem = {
  icon: string;
  title: string;
  description: string;
};

/**
 * App name shown in the title of the general "how to use" guide dialog
 * (renders as "Welcome to Greenroom").
 */
export const GENERAL_HELP_APP_NAME = "Greenroom";

/**
 * The general "How to use Greenroom" guide — an overview of the music-industry
 * workflow that ties the domain apps together. Rendered as cards by `HelpDialog`.
 */
export const generalHelpItems: HelpGuideItem[] = [
  {
    icon: "🎤",
    title: "Pitch a Project",
    description:
      "Start in the Pitch app to submit a new project idea or offer. It's sent off for review and lands in the Inbox.",
  },
  {
    icon: "📥",
    title: "Review the Inbox",
    description:
      "Pitches and logged offers land in the Inbox as the initial set. Vote on them and see aggregated vote counts before anything moves forward.",
  },
  {
    icon: "📋",
    title: "Track in Active Projects",
    description:
      "Offers that get the go-ahead move to Active Projects, where you manage details, add curation suggestions, and build the final lineup.",
  },
  {
    icon: "🗄️",
    title: "Wrap Up in Archive",
    description:
      "Finished projects live in Archive — check payment status, browse pics & vids, and read feedback.",
  },
  {
    icon: "🖥️",
    title: "Getting Around",
    description:
      "Open apps from the desktop icons or the menu bar. Each app has its own menus at the top and its own Help.",
  },
];

/**
 * Greenroom domain apps that get a per-app guide in the homepage Help menu,
 * ordered to follow the workflow. (`incoming-offers` is branded "Inbox".)
 */
export const HELP_GUIDE_APP_IDS: AppId[] = [
  "pitch",
  "incoming-offers",
  "active-projects",
  "archive",
];
