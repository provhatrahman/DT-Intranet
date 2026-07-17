import { BaseApp } from "../base/types";
import { FinderAppComponent } from "./components/FinderAppComponent";

export const appMetadata = {
  name: "DAYTIMERS greenroom",
  version: "1.0.0",
  creator: {
    name: "DAYTIMERS",
    url: "https://daytimers.org",
  },
  github: "",
  icon: "/icons/mac.png",
};

export const helpItems = [
  {
    icon: "🔍",
    title: "Browse & Navigate",
    description:
      "Back/Forward buttons, address bar & Go menu for fast navigation",
  },
  {
    icon: "📁",
    title: "File Management",
    description:
      "Create folders, rename, move, and drag items to organize files",
  },
  {
    icon: "👀",
    title: "View & Sort",
    description: "Switch Icon sizes and sort by name, kind, size, or date",
  },
  {
    icon: "📍",
    title: "Quick Access",
    description:
      "Jump to Documents, Applications, or Trash instantly from Go menu",
  },
  {
    icon: "ℹ️",
    title: "Storage Info",
    description: "See free space & item count in the window footer",
  },
  {
    icon: "🗑️",
    title: "Trash",
    description: "Drag files to Trash & Empty to permanently delete",
  },
];

export const FinderApp: BaseApp = {
  id: "finder",
  name: "Finder",
  description: "Browse and manage files",
  icon: {
    type: "image",
    src: "/icons/mac.png",
  },
  component: FinderAppComponent,
  helpItems,
  metadata: appMetadata,
};
