import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import { greenroomFetch } from "@/lib/api/client";

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

// A confirmed final-lineup artist (project_lineup row) — a real artists-table
// reference, unlike the free-text Curation suggestions.
export interface ProjectLineupEntry {
  id: number;
  artist_id: number;
  artist_name: string;
  display_order: number | null;
  added_by_user_id: number | null;
  date_created: string | null;
}

// Internal staff (a user working on the project), distinct from artist members.
// The row with role "Project Lead" is the project lead; others are team members.
export interface ProjectTeamMember {
  user_id: number;
  username: string | null;
  role: string;
  added_at: string | null;
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

export type SuggestionVoteValue = 1 | -1 | 0;

export interface SuggestionVote {
  user_id: number;
  username: string | null;
  vote_value: SuggestionVoteValue;
}

// A curated artist suggestion — a free-text name (not an artists row) that any
// user can add to a project's longlist and everyone can thumbs up/down.
export interface ProjectSuggestion {
  id: number;
  artist_name: string;
  link: string | null;
  suggested_email: string | null;
  suggested_phone: string | null;
  curated_by_user_id: number | null;
  curated_by_username: string | null;
  notes: string | null;
  up_votes: number;
  down_votes: number;
  score: number;
  vote_count: number;
  votes: SuggestionVote[];
  date_created: string | null;
}

export interface ProjectDetail extends ProjectListItem {
  // Confirmed final-lineup artists (project_lineup rows), managed via the
  // lineup endpoints below. `members` is the legacy assign-team list.
  lineup: ProjectLineupEntry[];
  members: ProjectMember[];
  tasks: ProjectTask[];
  // Internal staff working on the project (users), separate from artist members.
  team: ProjectTeamMember[];
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
  // Author of the comment. Field name matches the backend create endpoint,
  // which credits the row to this user.
  wrapup_by_user_id?: number;
}

interface ProjectsListResponse {
  projects: ProjectListItem[];
}

interface ProjectDetailResponse {
  project: ProjectListItem;
  lineup?: ProjectLineupEntry[];
  members?: ProjectMember[];
  tasks?: ProjectTask[];
  team?: ProjectTeamMember[];
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
  const response = await greenroomFetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }
  const data: ProjectsListResponse = await response.json();
  return data.projects;
}

export async function getProjectById(id: number): Promise<ProjectDetail> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/projects/${id}/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch project ${id}: ${response.statusText}`);
  }
  const data: ProjectDetailResponse = await response.json();
  return {
    ...data.project,
    lineup: data.lineup ?? [],
    members: data.members ?? [],
    tasks: data.tasks ?? [],
    team: data.team ?? [],
    wrapup: data.wrapup ?? null,
  };
}

export async function createProject(
  payload: CreateProjectPayload
): Promise<CreateProjectResponse> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/projects/create/`, {
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
  const response = await greenroomFetch(
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
  const response = await greenroomFetch(
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
  const response = await greenroomFetch(
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

// --- Final lineup (project_lineup rows: confirmed artists on the bill) ---

export async function getProjectLineup(
  id: number
): Promise<ProjectLineupEntry[]> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/projects/${id}/lineup/`
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to fetch lineup"));
  }
  const data: { project_id: number; lineup: ProjectLineupEntry[] } =
    await response.json();
  return data.lineup;
}

// Idempotent server-side: re-adding an existing artist returns 200 instead of 201.
export async function addLineupArtist(
  id: number,
  payload: {
    artist_id: number;
    display_order?: number;
    added_by_user_id?: number;
  }
): Promise<{ message: string; lineup_entry: ProjectLineupEntry }> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/projects/${id}/lineup/add/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to add artist to lineup"));
  }
  return await response.json();
}

export async function removeLineupArtist(
  id: number,
  artistId: number
): Promise<{ message: string }> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/projects/${id}/lineup/${artistId}/`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(
      await parseError(response, "Failed to remove artist from lineup")
    );
  }
  return await response.json();
}

// --- Internal staff team (users) — distinct from the artist `assignTeam` above.

export async function getProjectTeam(
  id: number
): Promise<ProjectTeamMember[]> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/projects/${id}/team/`);
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to fetch team"));
  }
  const data = await response.json();
  return data.team ?? [];
}

// Add or re-role a staff user on the project's team. The backend upserts on
// (project, user), so calling this with role "Project Lead" also handles
// reassigning the lead.
export async function addProjectTeamMember(
  id: number,
  userId: number,
  role: string
): Promise<{ message: string; member: ProjectTeamMember }> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/projects/${id}/team/add/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to add team member"));
  }
  return await response.json();
}

export async function removeProjectTeamMember(
  id: number,
  userId: number
): Promise<{ message: string }> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/projects/${id}/team/${userId}/`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to remove team member"));
  }
  return await response.json();
}

// Sets status to "archived" (a real status, distinct from completed/cancelled)
// and writes a status-history row.
export async function archiveProject(
  id: number
): Promise<{ message: string; project_id: number }> {
  const response = await greenroomFetch(
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
  const response = await greenroomFetch(
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
  const response = await greenroomFetch(
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
  const response = await greenroomFetch(
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

// --- Curation: artist suggestions (longlist) + thumbs up/down votes.

// Ranked by net vote score (up minus down), highest first.
export async function getProjectSuggestions(
  id: number
): Promise<ProjectSuggestion[]> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/projects/${id}/suggestions/`
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to fetch suggestions"));
  }
  const data = await response.json();
  return data.suggestions ?? [];
}

// Rejected (400) if the artist name is already suggested for the project
// (case-insensitive). As with updates, the author's user_id travels in the body.
export async function addProjectSuggestion(
  id: number,
  payload: { artist_name: string; link?: string; notes?: string },
  userId: number | null
): Promise<ProjectSuggestion> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/projects/${id}/suggestions/add/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        curated_by_user_id: userId ?? undefined,
      }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to add suggestion"));
  }
  const data = await response.json();
  return data.suggestion;
}

// One vote per user, upserted — re-voting replaces. 1 = up, -1 = down, 0 = clear.
export async function voteProjectSuggestion(
  id: number,
  suggestionId: number,
  userId: number,
  voteValue: SuggestionVoteValue
): Promise<ProjectSuggestion> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/projects/${id}/suggestions/${suggestionId}/vote/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, vote_value: voteValue }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to record vote"));
  }
  const data = await response.json();
  return data.suggestion;
}

export async function deleteProjectSuggestion(
  id: number,
  suggestionId: number
): Promise<{ message: string }> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/projects/${id}/suggestions/${suggestionId}/`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to delete suggestion"));
  }
  return await response.json();
}

// Blocked (400) while the project has any members, tasks, wrapups, files,
// bookings, payments, linked pitches, lineup, or suggestions.
export async function deleteProject(
  id: number
): Promise<{ message: string }> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/projects/${id}/delete/`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to delete project"));
  }
  return await response.json();
}

// Wrap-up is a lightweight forum: each row is one comment, so this returns the
// full list (newest first). A comment's text lives in `summary` (for the "how
// it went" section) or `lessons_learned` (for the "lessons learned" section).
export async function getProjectWrapups(
  id: number
): Promise<ProjectWrapup[]> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/projects/${id}/wrapup/`
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch wrapups: ${response.statusText}`);
  }
  const data = await response.json();
  return data.wrapups ?? [];
}

export async function createWrapup(
  id: number,
  payload: WrapupPayload
): Promise<{ id: number; message: string }> {
  const response = await greenroomFetch(
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

// Edit a single wrap-up comment (scoped to its row id).
export async function updateWrapup(
  projectId: number,
  wrapupId: number,
  payload: WrapupPayload
): Promise<{ message: string; wrapup_id: number }> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/projects/${projectId}/wrapup/${wrapupId}/update/`,
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

// Delete a single wrap-up comment (scoped to its row id).
export async function deleteWrapup(
  projectId: number,
  wrapupId: number
): Promise<{ message: string }> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/projects/${projectId}/wrapup/${wrapupId}/delete/`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to delete wrapup"));
  }
  return await response.json();
}
