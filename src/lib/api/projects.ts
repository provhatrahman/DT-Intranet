import { GREENROOM_API_BASE } from "@/config/greenroomApi";

// Types verified against the live backend on 2026-07-06 — see BACKEND_STATE.md.
// Notable: `lead_artist_id` no longer exists; event fields (event_date, venue,
// city/country, promoter, gig size) are merged onto the project itself.

export type ProjectStatus =
  | "active"
  | "completed"
  | "on_hold"
  | "cancelled"
  | "archived"
  | string;

export interface ProjectListItem {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  project_type: string | null;
  start_date: string | null;
  end_date: string | null;
  feedback: string | null;
  budget: string | null;
  drive_parent_folder_id: string | null;
  event_date: string | null;
  event_type: string | null;
  venue_name: string | null;
  location_id: number | null;
  city: string | null;
  country: string | null;
  promoter_name: string | null;
  source: string | null;
  gig_size_id: number | null;
  gig_size_code: string | null;
}

export interface ProjectMember {
  artist_id: number;
  artist_name: string;
  role_in_project: string;
  joined_at: string | null;
}

export interface ProjectTask {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_user_id: number | null;
  due_date: string | null;
}

export interface ProjectWrapup {
  id?: number;
  summary: string | null;
  lessons_learned: string | null;
  submitted_by?: string | null;
  submitted_by_user_id?: number | null;
  date_created?: string | null;
}

export interface ProjectStatusHistoryEntry {
  id: number;
  old_status: string | null;
  new_status: string;
  changed_by_user_id: number | null;
  changed_by_username: string | null;
  notes: string | null;
  changed_at: string;
}

export interface ProjectUpdate {
  id: number;
  user_id: number | null;
  username: string | null;
  body: string;
  created_at: string;
}

export interface ProjectDetail extends ProjectListItem {
  // `lineup` exists on detail responses but is empty on every project in the
  // live DB, so its item shape is unverified. Members is the populated list.
  lineup: ProjectMember[];
  members: ProjectMember[];
  tasks: ProjectTask[];
  wrapup: ProjectWrapup | null;
}

// Only `name` and `status` are required by the backend. `city`/`country` are
// accepted on create/update and auto-resolve `location_id` server-side.
export interface ProjectFieldsPayload {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  project_type?: string;
  start_date?: string;
  end_date?: string;
  feedback?: string;
  budget?: string | number;
  drive_parent_folder_id?: string;
  event_date?: string;
  event_type?: string;
  venue_name?: string;
  city?: string;
  country?: string;
  promoter_name?: string;
  source?: string;
  gig_size_id?: number;
}

export interface CreateProjectPayload extends ProjectFieldsPayload {
  name: string;
  status: ProjectStatus;
}

export type UpdateProjectPayload = ProjectFieldsPayload;

export interface TeamMemberPayload {
  artist_id: number;
  role_in_project: string;
}

export interface WrapupPayload {
  summary?: string;
  lessons_learned?: string;
  submitted_by_user_id?: number;
}

interface ProjectsListResponse {
  projects: ProjectListItem[];
}

interface ProjectDetailResponse {
  project: ProjectListItem;
  lineup?: ProjectMember[];
  members?: ProjectMember[];
  tasks?: ProjectTask[];
  wrapup?: ProjectWrapup | null;
}

interface CreateProjectResponse {
  id: number;
  name: string;
  status: ProjectStatus;
  message: string;
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const error = await response
    .json()
    .catch(() => ({ error: response.statusText }));
  return error.error || fallback;
}

// IMPORTANT (verified live): the unfiltered list returns ONLY active projects.
// Non-active projects (completed/cancelled/on_hold/archived) are only reachable
// via an explicit `?status=` — there is no way to fetch all statuses at once.
export async function getProjects(
  status?: string
): Promise<ProjectListItem[]> {
  const url = status
    ? `${GREENROOM_API_BASE}/projects/?status=${encodeURIComponent(status)}`
    : `${GREENROOM_API_BASE}/projects/`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }
  const data: ProjectsListResponse = await response.json();
  return data.projects;
}

export async function getProjectById(id: number): Promise<ProjectDetail> {
  const response = await fetch(`${GREENROOM_API_BASE}/projects/${id}/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch project ${id}: ${response.statusText}`);
  }
  const data: ProjectDetailResponse = await response.json();
  return {
    ...data.project,
    lineup: data.lineup ?? [],
    members: data.members ?? [],
    tasks: data.tasks ?? [],
    wrapup: data.wrapup ?? null,
  };
}

export async function createProject(
  payload: CreateProjectPayload
): Promise<CreateProjectResponse> {
  const response = await fetch(`${GREENROOM_API_BASE}/projects/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to create project"));
  }
  return await response.json();
}

export async function updateProject(
  id: number,
  payload: UpdateProjectPayload
): Promise<{ message: string; project_id: number }> {
  const response = await fetch(
    `${GREENROOM_API_BASE}/projects/${id}/update/`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to update project"));
  }
  return await response.json();
}

// PATCH (POST returns 405). The backend does NOT validate the status value and
// records a status-history row, so callers must only pass known statuses.
export async function updateProjectStatus(
  id: number,
  status: ProjectStatus
): Promise<{ message: string; project_id: number; status: ProjectStatus }> {
  const response = await fetch(
    `${GREENROOM_API_BASE}/projects/${id}/update-status/`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );
  if (!response.ok) {
    throw new Error(
      await parseError(response, "Failed to update project status")
    );
  }
  return await response.json();
}

export async function assignTeam(
  id: number,
  teamMembers: TeamMemberPayload[]
): Promise<{ message: string; members: ProjectMember[] }> {
  const response = await fetch(
    `${GREENROOM_API_BASE}/projects/${id}/assign-team/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_members: teamMembers }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to assign team"));
  }
  return await response.json();
}

// Sets status to "archived" (a real status, distinct from completed/cancelled)
// and writes a status-history row.
export async function archiveProject(
  id: number
): Promise<{ message: string; project_id: number }> {
  const response = await fetch(
    `${GREENROOM_API_BASE}/projects/${id}/archive/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to archive project"));
  }
  return await response.json();
}

export async function getProjectStatusHistory(
  id: number
): Promise<ProjectStatusHistoryEntry[]> {
  const response = await fetch(
    `${GREENROOM_API_BASE}/projects/${id}/status-history/`
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch status history: ${response.statusText}`
    );
  }
  const data = await response.json();
  return data.status_history ?? [];
}

// Free-text progress updates posted on a project, newest first. Distinct from
// status-history (which only records status transitions).
export async function getProjectUpdates(
  id: number
): Promise<ProjectUpdate[]> {
  const response = await fetch(
    `${GREENROOM_API_BASE}/projects/${id}/updates/`
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to fetch updates"));
  }
  const data = await response.json();
  return data.updates ?? [];
}

// The Greenroom API has no auth, so the author's user_id is sent in the body
// (as votes/comments do) so the update shows the real author.
export async function addProjectUpdate(
  id: number,
  body: string,
  userId: number | null
): Promise<ProjectUpdate> {
  const response = await fetch(
    `${GREENROOM_API_BASE}/projects/${id}/updates/add/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, user_id: userId ?? undefined }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to post update"));
  }
  const data = await response.json();
  return data.update;
}

// Blocked (400) while the project has any members, tasks, wrapups, files,
// bookings, payments, linked pitches, lineup, or suggestions.
export async function deleteProject(
  id: number
): Promise<{ message: string }> {
  const response = await fetch(
    `${GREENROOM_API_BASE}/projects/${id}/delete/`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to delete project"));
  }
  return await response.json();
}

export async function getProjectWrapup(
  id: number
): Promise<ProjectWrapup | null> {
  const response = await fetch(
    `${GREENROOM_API_BASE}/projects/${id}/wrapup/`
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch wrapup: ${response.statusText}`);
  }
  const data = await response.json();
  return data.wrapup ?? null;
}

export async function createWrapup(
  id: number,
  payload: WrapupPayload
): Promise<{ id: number; message: string }> {
  const response = await fetch(
    `${GREENROOM_API_BASE}/projects/${id}/wrapup/create/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to create wrapup"));
  }
  return await response.json();
}

export async function updateWrapup(
  id: number,
  payload: WrapupPayload
): Promise<{ message: string; wrapup_id: number }> {
  const response = await fetch(
    `${GREENROOM_API_BASE}/projects/${id}/wrapup/update/`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to update wrapup"));
  }
  return await response.json();
}
