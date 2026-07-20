import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import { greenroomFetch } from "@/lib/api/client";

// Internal staff users (managers, coordinators, staff) — the people assignable
// as a project's Lead/Team, and the Google-sign-in allowlist (a Google account
// can sign in only if its email matches a users row). See api/views/users.py.
export interface GreenroomUser {
  id: number;
  username: string;
  email: string;
  role: string | null;
  // Server-derived from `role` (GREENROOM_ADMIN_ROLES). Authoritative admin flag.
  is_admin: boolean;
}

// Roles the backend accepts. Mirrors VALID_ROLES in api/views/users.py.
export const USER_ROLES = ["admin", "manager", "coordinator", "staff"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface CreateUserPayload {
  username: string;
  email: string;
  role: UserRole;
}

// Partial update — any subset of the editable fields.
export type UpdateUserPayload = Partial<CreateUserPayload>;

interface UsersListResponse {
  users: GreenroomUser[];
}

interface UserResponse {
  user: GreenroomUser;
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const error = await response
    .json()
    .catch(() => ({ error: response.statusText }));
  return error.error || fallback;
}

export async function getUsers(): Promise<GreenroomUser[]> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/users/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`);
  }
  const data: UsersListResponse = await response.json();
  return data.users;
}

// Admin only (server-enforced). POST /users/.
export async function createUser(
  payload: CreateUserPayload
): Promise<GreenroomUser> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/users/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to create user"));
  }
  const data: UserResponse = await response.json();
  return data.user;
}

// Admin only (server-enforced). PATCH /users/<id>/.
export async function updateUser(
  id: number,
  payload: UpdateUserPayload
): Promise<GreenroomUser> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/users/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to update user"));
  }
  const data: UserResponse = await response.json();
  return data.user;
}

// Admin only (server-enforced). DELETE /users/<id>/.
export async function deleteUser(id: number): Promise<void> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/users/${id}/`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to delete user"));
  }
}
