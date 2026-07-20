export const appMetadata = {
  name: "Admin Portal",
  version: "1.0.0",
  creator: {
    name: "Ryo Lu",
    url: "https://ryo.lu",
  },
  github: "https://github.com/ryokun6/ryos",
  icon: "/icons/default/terminal.png",
};

// @deprecated The Help menu shows the paged guide in
// src/components/help/guides/greenroomAdmin.tsx. This array is retained only
// because appRegistry still reads `helpItems`; it is no longer user-facing.
export const helpItems = [
  {
    icon: "👥",
    title: "Manage Users",
    description:
      "View everyone with access to Greenroom, and add, edit, or remove users.",
  },
  {
    icon: "➕",
    title: "Add a User",
    description:
      "Create a user with a username, email, and role. Their email is the Google account allowed to sign in.",
  },
  {
    icon: "🛡️",
    title: "Roles & Admin Access",
    description:
      "Admin and Manager roles get admin access; Coordinator and Staff do not.",
  },
  {
    icon: "🔒",
    title: "Admins Only",
    description:
      "Only Greenroom admins can open this app and manage users. Changes are enforced server-side.",
  },
];

export { GreenroomAdminAppComponent } from "./components/GreenroomAdminAppComponent";
