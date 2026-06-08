import { GREENROOM_API_BASE } from "@/config/greenroomApi";

export type ProjectStatus =
  | "active"
  | "completed"
  | "on_hold"
  | "cancelled"
  | string;

export interface ProjectListItem {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  project_type: string | null;
  start_date: string | null;
  end_date: string | null;
  lead_artist_id: number | null;
  budget: string | null;
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
  date_created?: string | null;
}

export interface ProjectDetail extends ProjectListItem {
  members: ProjectMember[];
  tasks: ProjectTask[];
  wrapup: ProjectWrapup | null;
}

export interface CreateProjectPayload {
  name: string;
  status: ProjectStatus;
  description?: string;
  project_type?: string;
  start_date?: string;
  end_date?: string;
  lead_artist_id?: number | null;
  budget?: string | number;
  drive_parent_folder_id?: string;
  updated_by_user_id?: number;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  project_type?: string;
  start_date?: string;
  end_date?: string;
  lead_artist_id?: number | null;
  budget?: string | number;
  drive_parent_folder_id?: string;
  updated_by_user_id?: number;
}

export interface UpdateProjectStatusPayload {
  status?: ProjectStatus;
  description?: string;
  end_date?: string;
  updated_by_user_id?: number;
}

export interface TeamMemberPayload {
  artist_id: number;
  role_in_project: string;
}

export interface WrapupPayload {
  summary?: string;
  lessons_learned?: string;
  wrapup_by_user_id?: number;
  updated_by_user_id?: number;
}

interface ProjectsListResponse {
  projects: ProjectListItem[];
}

interface ProjectDetailResponse {
  project: ProjectListItem;
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

// NOTE: The backend `?status=` filter is unreliable. The default and
// `?status=active` return only active projects, but any other value returns
// ALL projects regardless of status. Callers that need completed/cancelled
// projects should fetch with a non-active status and filter client-side.
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

export async function updateProjectStatus(
  id: number,
  payload: UpdateProjectStatusPayload
): Promise<{ message: string; project_id: number; status: ProjectStatus }> {
  const response = await fetch(
    `${GREENROOM_API_BASE}/projects/${id}/update-status/`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

export async function archiveProject(
  id: number
): Promise<{ message: string; project_id: number }> {
  const response = await fetch(
    `${GREENROOM_API_BASE}/projects/${id}/archive/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to archive project"));
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
