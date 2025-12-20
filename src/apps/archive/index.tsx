export const appMetadata = {
  name: "Archive",
  version: "1.0.0",
  creator: {
    name: "Ryo Lu",
    url: "https://ryo.lu",
  },
  github: "https://github.com/ryokun6/ryos",
  icon: "/icons/macosx/vault.png",
};

export const helpItems = [
  {
    icon: "💰",
    title: "Project Payment Status",
    description:
      "Track the main project payment status from Invoice Sent to Payment Received. Use the Check Payment button to verify incoming payments via bank transaction data.",
  },
  {
    icon: "👥",
    title: "Lineup Payment Status",
    description:
      "Manage individual artist payments. Track when invoices are received and paid. Use the Check button to verify outgoing payments to artists.",
  },
  {
    icon: "📸",
    title: "Pics & Vids",
    description:
      "Store the Google Drive link containing photos and videos from completed projects. This helps keep all project media organized in one place.",
  },
  {
    icon: "💬",
    title: "Feedback",
    description:
      "Add feedback, learnings, and notes about completed projects. This helps capture insights and improve future project management.",
  },
];

export { ArchiveAppComponent } from "./components/ArchiveAppComponent";
