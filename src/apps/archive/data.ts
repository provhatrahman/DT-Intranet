export type {
  ProjectListItem,
  ProjectDetail,
  ProjectMember,
  ProjectWrapup,
} from "@/lib/api/projects";

export type { Payment, PaymentStatus } from "@/lib/api/payments";

// Backend payment status enum, used by the Archive payments tab.
export const PAYMENT_STATUSES = [
  "pending",
  "issued",
  "paid",
  "overdue",
  "cancelled",
] as const;

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  issued: "Issued",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

// Statuses a project must have to appear in the Archive.
export const ARCHIVED_PROJECT_STATUSES = ["completed", "cancelled"] as const;
