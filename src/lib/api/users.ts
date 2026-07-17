import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import { greenroomFetch } from "@/lib/api/client";

// Internal staff users (managers, coordinators, staff) — the people assignable
// as a project's Lead/Team. The Greenroom API has no auth; this is just the
// users table, used to populate people pickers. See api/views/users.py.
export interface GreenroomUser {
  id: number;
  username: string;
  role: string | null;
}

interface UsersListResponse {
  users: GreenroomUser[];
}

export async function getUsers(): Promise<GreenroomUser[]> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/users/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`);
  }
  const data: UsersListResponse = await response.json();
  return data.users;
}
