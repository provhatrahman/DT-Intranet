export const appMetadata = {
  name: "Inbox",
  version: "1.0.0",
  creator: {
    name: "Ryo Lu",
    url: "https://ryo.lu",
  },
  github: "https://github.com/ryokun6/ryos",
  icon: "/icons/macosx/bento.png",
};

export const helpItems = [
  {
    icon: "📋",
    title: "Viewing Offers",
    description:
      "Browse incoming gig and brand offers in a card-based dashboard. Each card shows key details like dates, venue, fee, and promoter.",
  },
  {
    icon: "🗳️",
    title: "Voting",
    description:
      "Vote on offers with options: Accept, Interested, Decline, or Recommend. You can select both Accept and Interested together.",
  },
  {
    icon: "📊",
    title: "Vote Counts",
    description:
      "See aggregated vote counts from all team members for each offer option.",
  },
  {
    icon: "🔍",
    title: "Filtering",
    description:
      "Filter and sort offers by date, fee, or other criteria to find what you're looking for.",
  },
];

export { IncomingOffersAppComponent } from "./components/IncomingOffersAppComponent";
