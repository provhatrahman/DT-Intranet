export const appMetadata = {
  name: "Feedback",
  version: "1.0.0",
  creator: {
    name: "Ryo Lu",
    url: "https://ryo.lu",
  },
  github: "https://github.com/ryokun6/ryos",
  icon: "/icons/macosx/automator.png",
};

// @deprecated The Help menu now shows the paged guide in
// src/components/help/guides/feedback.tsx. This array is retained only because
// appRegistry still reads `helpItems`; it is no longer user-facing.
export const helpItems = [
  {
    icon: "🐞",
    title: "Report a Bug",
    description:
      "Spotted something broken or confusing? Describe what happened and we'll take a look.",
  },
  {
    icon: "📍",
    title: "Pick the App",
    description:
      "Choose which app your report is about (Inbox, Pitch, Active Projects, Archive) or General if it's app-wide.",
  },
  {
    icon: "✅",
    title: "Submit",
    description:
      "Your report is sent to the Greenroom team, who can read and resolve it from the Admin Portal.",
  },
];

export { FeedbackAppComponent } from "./components/FeedbackAppComponent";
