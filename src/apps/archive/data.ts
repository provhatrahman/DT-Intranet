import type { ProjectPaymentStatus, LineupPaymentStatus } from "../active-projects/data";

export type { ProjectPaymentStatus, LineupPaymentStatus };

export interface LineupPaymentInfo {
  djId: string;
  status: LineupPaymentStatus;
  invoiceGeneratedAt?: string;
  invoiceSentAt?: string;
  paidAt?: string;
}

export interface ArchivedProject {
  // All fields from ActiveProject
  id: string;
  name: string;
  description: string;
  promoter: string;
  venue: string;
  date: string;
  fee: string;
  timings: string;
  projectSize: "Small" | "Med" | "Large";
  projectLead: string;
  team: string[];
  deadline: string;
  googleDriveLink: string;
  statusUpdates: Array<{
    id: string;
    timestamp: string;
    text: string;
    userId: string;
  }>;
  curationSuggestions: Array<{
    id: string;
    name: string;
    workLink?: string;
    votes: Record<string, boolean>;
  }>;
  finalLineup: string[]; // Array of DJ IDs
  
  // Archive-specific fields
  archivedAt: string;
  projectPaymentStatus: ProjectPaymentStatus;
  lineupPayments: LineupPaymentInfo[];
  photosAndVideos: string; // Google Drive link or notes
  wrapUpFeedback: Array<{
    id: string;
    userId: string;
    timestamp: string;
    text: string;
  }>;
}

// Note: The conversion function is in active-projects/data.ts to avoid circular dependencies

// Empty array - archived projects will be loaded from localStorage
export const dummyArchivedProjects: ArchivedProject[] = [];
