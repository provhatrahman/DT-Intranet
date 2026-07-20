import { create } from "zustand";
import {
  GreenroomUser,
  CreateUserPayload,
  UpdateUserPayload,
  getUsers as apiGetUsers,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
} from "@/lib/api/users";

interface UsersState {
  users: GreenroomUser[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;

  fetchUsers: () => Promise<void>;
  createUser: (payload: CreateUserPayload) => Promise<GreenroomUser>;
  updateUser: (id: number, payload: UpdateUserPayload) => Promise<GreenroomUser>;
  deleteUser: (id: number) => Promise<void>;
  getUserById: (id: number) => GreenroomUser | undefined;
  clearError: () => void;
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  isLoading: false,
  error: null,
  lastFetch: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const users = await apiGetUsers();
      set({ users, isLoading: false, lastFetch: Date.now() });
    } catch (error) {
      set({ error: errorMessage(error, "Failed to fetch users"), isLoading: false });
      throw error;
    }
  },

  createUser: async (payload) => {
    set({ error: null });
    try {
      const user = await apiCreateUser(payload);
      // Insert keeping the username sort the list endpoint uses.
      set((state) => ({
        users: [...state.users, user].sort((a, b) =>
          a.username.localeCompare(b.username)
        ),
      }));
      return user;
    } catch (error) {
      set({ error: errorMessage(error, "Failed to create user") });
      throw error;
    }
  },

  updateUser: async (id, payload) => {
    set({ error: null });
    try {
      const updated = await apiUpdateUser(id, payload);
      set((state) => ({
        users: state.users.map((u) => (u.id === id ? updated : u)),
      }));
      return updated;
    } catch (error) {
      set({ error: errorMessage(error, "Failed to update user") });
      throw error;
    }
  },

  deleteUser: async (id) => {
    set({ error: null });
    try {
      await apiDeleteUser(id);
      set((state) => ({ users: state.users.filter((u) => u.id !== id) }));
    } catch (error) {
      set({ error: errorMessage(error, "Failed to delete user") });
      throw error;
    }
  },

  getUserById: (id: number) => {
    return get().users.find((u) => u.id === id);
  },

  clearError: () => set({ error: null }),
}));
