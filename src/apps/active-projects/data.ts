import { Offer } from "../incoming-offers/data";

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

// Convert an Offer from inbox to an ActiveProject with default values
export function convertOfferToActiveProject(offer: Offer): ActiveProject {
  // Generate a unique project ID based on timestamp and offer ID
  const projectId = `project-${offer.id}-${Date.now()}`;
  
  // Calculate deadline as 30 days from now (or use offer date if it's in the future)
  const offerDate = new Date(offer.date);
  const now = new Date();
  const deadlineDate = offerDate > now ? offerDate : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const deadline = deadlineDate.toISOString().split('T')[0];
  
  return {
    id: projectId,
    name: offer.name,
    description: offer.description,
    promoter: offer.promoter,
    venue: offer.venue,
    date: offer.date,
    fee: offer.fee,
    timings: offer.timings,
    projectSize: "Med", // Default to medium
    projectLead: "", // Empty, to be filled in Active Projects
    team: [],
    deadline: deadline,
    googleDriveLink: "",
    statusUpdates: [
      {
        id: `status-${projectId}-1`,
        timestamp: new Date().toISOString(),
        text: `Project approved and moved from inbox: ${offer.name}`,
        userId: "system",
      },
    ],
    curationSuggestions: [],
    finalLineup: [],
  };
}

// Empty array - projects will be loaded from localStorage
export const dummyProjects: ActiveProject[] = [];

// Type definitions for archive (to avoid circular dependency)
export type ProjectPaymentStatus = "Invoice Not Sent" | "Invoice Sent" | "Payment Received" | "Invoice Paid";
export type LineupPaymentStatus = "Not Sent" | "Link Sent" | "Invoice Received" | "Invoice Paid";

export interface LineupPaymentInfo {
  djId: string;
  status: LineupPaymentStatus;
  invoiceGeneratedAt?: string;
  invoiceSentAt?: string;
  paidAt?: string;
}

// Convert an ActiveProject to an archived project structure
// This is used when moving projects to archive
export function prepareProjectForArchive(project: ActiveProject) {
  return {
    ...project,
    archivedAt: new Date().toISOString(),
    projectPaymentStatus: "Invoice Not Sent" as ProjectPaymentStatus,
    lineupPayments: project.finalLineup.map((djId) => ({
      djId,
      status: "Not Sent" as LineupPaymentStatus,
    })),
    photosAndVideos: project.googleDriveLink || "",
    wrapUpFeedback: [] as Array<{
      id: string;
      userId: string;
      timestamp: string;
      text: string;
    }>,
  };
}
