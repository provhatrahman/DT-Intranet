export type {
  ProjectListItem,
  ProjectDetail,
  ProjectMember,
  ProjectTask,
  ProjectStatus,
} from "@/lib/api/projects";

// Roles offered when assigning an artist to a project's lineup/team.
export const PROJECT_ROLES = [
  "Performer",
  "DJ",
  "Producer",
  "Engineer",
  "Co-writer",
  "Manager",
] as const;

export const DEFAULT_PROJECT_ROLE = "Performer";

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

export function formatProjectStatus(status: string): string {
  return PROJECT_STATUS_LABELS[status] ?? status;
}

export function formatBudget(budget: string | null | undefined): string {
  if (!budget) return "Not set";
  const num = Number(budget);
  if (Number.isNaN(num)) return budget;
  return num.toLocaleString();
}
