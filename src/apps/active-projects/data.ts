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

// Roles used on a project's internal staff team (users), distinct from the
// artist lineup roles above. The lead is the single row with PROJECT_LEAD_ROLE;
// everyone else is TEAM_MEMBER_ROLE. See the project_team backend table.
export const PROJECT_LEAD_ROLE = "Project Lead";
export const TEAM_MEMBER_ROLE = "Team Member";

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
  archived: "Archived",
};

// Gig sizes verified against the live backend (gig_size_id → gig_size_code).
// S/M/L only (weights 1/2/3, matching the legacy roster-sheet scale) — the
// old XS/XL rows were removed and their ids no longer exist, which is why
// the ids here start at 2. Unknown ids are silently ignored by the API.
export const GIG_SIZES = [
  { id: 2, code: "S" },
  { id: 3, code: "M" },
  { id: 4, code: "L" },
] as const;

// Values observed in live project data; the backend treats these as free text.
export const PROJECT_TYPES = [
  "Concert",
  "Event",
  "Recording",
  "Video",
  "Digital",
  "Community",
  "Educational",
] as const;

export const PROJECT_SOURCES = ["Direct", "Promoter", "pitch"] as const;

// Converts backend datetimes ("2025-03-26T00:00:00") to <input type="date">
// values ("2025-03-26").
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function formatProjectStatus(status: string): string {
  return PROJECT_STATUS_LABELS[status] ?? status;
}

export function formatBudget(budget: string | null | undefined): string {
  if (!budget) return "Not set";
  const num = Number(budget);
  if (Number.isNaN(num)) return budget;
  return num.toLocaleString();
}
