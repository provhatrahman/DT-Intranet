import { create } from "zustand";
import { GreenroomUser, getUsers as apiGetUsers } from "@/lib/api/users";

interface UsersState {
  users: GreenroomUser[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;

  fetchUsers: () => Promise<void>;
  getUserById: (id: number) => GreenroomUser | undefined;
  clearError: () => void;
}

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
      const message =
        error instanceof Error ? error.message : "Failed to fetch users";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  getUserById: (id: number) => {
    return get().users.find((u) => u.id === id);
  },

  clearError: () => set({ error: null }),
}));
