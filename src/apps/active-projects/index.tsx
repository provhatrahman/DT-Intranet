export const appMetadata = {
  name: "Active Projects",
  version: "1.0.0",
  creator: {
    name: "Ryo Lu",
    url: "https://ryo.lu",
  },
  github: "https://github.com/ryokun6/ryos",
  icon: "/icons/macosx/pc.png",
};

// @deprecated The Help menu now shows the paged guide in
// src/components/help/guides/activeProjects.tsx. This array is retained only
// because appRegistry still reads `helpItems`; it is no longer user-facing.
export const helpItems = [
  {
    icon: "📋",
    title: "Project Overview",
    description:
      "View and manage project details including size, lead, team, deadline, and Google Drive link. Add status updates to track project progress.",
  },
  {
    icon: "🎨",
    title: "Curation Suggestions",
    description:
      "Suggest artists for curation ideation. Add names, optional work links, and vote with thumbs up on suggestions you think are a good fit.",
  },
  {
    icon: "🎵",
    title: "Final Lineup",
    description:
      "Search the master DJ database and assign artists to the project lineup. Add new DJs to the database if they haven't been booked before.",
  },
  {
    icon: "📝",
    title: "Status Updates",
    description:
      "Add text updates to track project progress. View a chronological log of all status updates for each project.",
  },
];

export { ActiveProjectsAppComponent } from "./components/ActiveProjectsAppComponent";
