import { dummyOffers } from "../incoming-offers/data";
import { DJ } from "./djDatabase";

export type ProjectSize = "Small" | "Med" | "Large";

export interface StatusUpdate {
  id: string;
  timestamp: string;
  text: string;
  userId: string;
}

export interface CurationSuggestion {
  id: string;
  name: string;
  workLink?: string;
  votes: Record<string, boolean>; // userId -> hasVoted
}

export interface ActiveProject {
  id: string;
  // From inbox
  name: string;
  description: string;
  promoter: string;
  venue: string;
  date: string;
  fee: string;
  timings: string;
  // New fields
  projectSize: ProjectSize;
  projectLead: string;
  team: string[];
  deadline: string;
  googleDriveLink: string;
  statusUpdates: StatusUpdate[];
  curationSuggestions: CurationSuggestion[];
  finalLineup: string[]; // Array of DJ IDs
}

// Convert inbox offers to active projects with additional fields
export const dummyProjects: ActiveProject[] = dummyOffers.map((offer, index) => {
  const sizes: ProjectSize[] = ["Small", "Med", "Large"];
  const leads = ["Dhillon", "Roop", "Kiran", "Izzi"];
  const teams = [
    ["Dhillon", "Roop"],
    ["Kiran", "Izzi", "Dhillon"],
    ["Roop"],
    ["Kiran", "Dhillon", "Izzi"],
    ["Roop", "Kiran"],
    ["Izzi", "Dhillon"],
  ];
  const deadlines = [
    "2024-06-15",
    "2024-08-20",
    "2024-04-25",
    "2024-06-30",
    "2024-05-15",
    "2024-07-25",
  ];

  return {
    id: `project-${offer.id}`,
    name: offer.name,
    description: offer.description,
    promoter: offer.promoter,
    venue: offer.venue,
    date: offer.date,
    fee: offer.fee,
    timings: offer.timings,
    projectSize: sizes[index % sizes.length],
    projectLead: leads[index % leads.length],
    team: teams[index % teams.length],
    deadline: deadlines[index % deadlines.length],
    googleDriveLink: "",
    statusUpdates: [
      {
        id: `status-${offer.id}-1`,
        timestamp: new Date(Date.now() - 86400000 * (index + 1)).toISOString(),
        text: `Project initialized from offer ${offer.name}`,
        userId: "system",
      },
    ],
    curationSuggestions: [],
    finalLineup: [],
  };
});
