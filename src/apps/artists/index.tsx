export const appMetadata = {
  name: "Artists",
  version: "1.0.0",
  creator: {
    name: "Ryo Lu",
    url: "https://ryo.lu",
  },
  github: "https://github.com/ryokun6/ryos",
  icon: "/icons/macosx/dictionary.png",
};

// @deprecated The Help menu shows the paged guide in
// src/components/help/guides/artists.tsx. This array is retained only because
// appRegistry still reads `helpItems`; it is no longer user-facing.
export const helpItems = [
  {
    icon: "🔍",
    title: "Search the Database",
    description:
      "Browse and filter the whole artist roster by name, genre, or city — no need to go through a project or event.",
  },
  {
    icon: "⭐",
    title: "Gig Stats",
    description:
      "Each artist shows their total gig score (completed bookings weighted by gig size), completed gig count, and the last time we booked them.",
  },
  {
    icon: "➕",
    title: "Add & Edit Artists",
    description:
      "Add new artists straight to the database, or open a profile to update their details, links, and status.",
  },
  {
    icon: "📖",
    title: "Booking History",
    description:
      "Every artist's profile lists their bookings across projects and events, with dates, venues, and fees.",
  },
];

export { ArtistsAppComponent } from "./components/ArtistsAppComponent";
