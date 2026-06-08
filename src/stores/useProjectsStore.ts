import { create } from "zustand";
import {
  ProjectListItem,
  ProjectDetail,
  ProjectWrapup,
  CreateProjectPayload,
  UpdateProjectPayload,
  UpdateProjectStatusPayload,
  TeamMemberPayload,
  WrapupPayload,
  getProjects as apiGetProjects,
  getProjectById as apiGetProjectById,
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  updateProjectStatus as apiUpdateProjectStatus,
  assignTeam as apiAssignTeam,
  archiveProject as apiArchiveProject,
  getProjectWrapup as apiGetProjectWrapup,
  createWrapup as apiCreateWrapup,
  updateWrapup as apiUpdateWrapup,
} from "@/lib/api/projects";

// Statuses that the Archive app treats as "done". The backend has no
// dedicated "archived" status and its ?status= filter is unreliable, so we
// fetch all projects and filter client-side.
const ARCHIVED_STATUSES = ["completed", "cancelled"];

interface ProjectsState {
  activeProjects: ProjectListItem[];
  allProjects: ProjectListItem[];
  projectDetails: Record<number, ProjectDetail>;
  isLoading: boolean;
  isLoadingAll: boolean;
  error: string | null;
  lastFetch: number | null;

  fetchActiveProjects: () => Promise<void>;
  fetchAllProjects: () => Promise<void>;
  getArchivedProjects: () => ProjectListItem[];
  refreshProject: (id: number) => Promise<ProjectDetail>;
  createProject: (payload: CreateProjectPayload) => Promise<number>;
  updateProject: (id: number, payload: UpdateProjectPayload) => Promise<void>;
  updateStatus: (
    id: number,
    payload: UpdateProjectStatusPayload
  ) => Promise<void>;
  assignTeam: (id: number, members: TeamMemberPayload[]) => Promise<void>;
  archiveProject: (id: number) => Promise<void>;
  fetchWrapup: (id: number) => Promise<ProjectWrapup | null>;
  saveWrapup: (
    id: number,
    payload: WrapupPayload,
    hasExisting: boolean
  ) => Promise<void>;
  clearError: () => void;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  activeProjects: [],
  allProjects: [],
  projectDetails: {},
  isLoading: false,
  isLoadingAll: false,
  error: null,
  lastFetch: null,

  fetchActiveProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const activeProjects = await apiGetProjects("active");
      set({
        activeProjects,
        isLoading: false,
        lastFetch: Date.now(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch projects";
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  fetchAllProjects: async () => {
    set({ isLoadingAll: true, error: null });
    try {
      // The ?status= filter only narrows for "active"; passing a non-active
      // value returns all projects, which is what we want for the archive.
      const allProjects = await apiGetProjects("completed");
      set({ allProjects, isLoadingAll: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch projects";
      set({ error: message, isLoadingAll: false });
      throw error;
    }
  },

  getArchivedProjects: () => {
    return get().allProjects.filter((p) =>
      ARCHIVED_STATUSES.includes(p.status)
    );
  },

  refreshProject: async (id: number) => {
    try {
      const detail = await apiGetProjectById(id);
      set((state) => ({
        projectDetails: { ...state.projectDetails, [id]: detail },
      }));
      return detail;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Failed to fetch project ${id}`;
      set({ error: message });
      throw error;
    }
  },

  createProject: async (payload: CreateProjectPayload) => {
    set({ error: null });
    try {
      const result = await apiCreateProject(payload);
      await get().fetchActiveProjects();
      return result.id;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create project";
      set({ error: message });
      throw error;
    }
  },

  updateProject: async (id: number, payload: UpdateProjectPayload) => {
    try {
      await apiUpdateProject(id, payload);
      await get().refreshProject(id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update project";
      set({ error: message });
      throw error;
    }
  },

  updateStatus: async (id: number, payload: UpdateProjectStatusPayload) => {
    try {
      await apiUpdateProjectStatus(id, payload);
      await get().refreshProject(id);
      // Keep the active list in sync; a project leaving "active" should drop
      // out of the Active Projects view.
      set((state) => ({
        activeProjects:
          payload.status && payload.status !== "active"
            ? state.activeProjects.filter((p) => p.id !== id)
            : state.activeProjects,
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update project status";
      set({ error: message });
      throw error;
    }
  },

  assignTeam: async (id: number, members: TeamMemberPayload[]) => {
    try {
      await apiAssignTeam(id, members);
      await get().refreshProject(id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to assign team";
      set({ error: message });
      throw error;
    }
  },

  archiveProject: async (id: number) => {
    try {
      await apiArchiveProject(id);
      await get().refreshProject(id);
      set((state) => ({
        activeProjects: state.activeProjects.filter((p) => p.id !== id),
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to archive project";
      set({ error: message });
      throw error;
    }
  },

  fetchWrapup: async (id: number) => {
    try {
      return await apiGetProjectWrapup(id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch wrapup";
      set({ error: message });
      throw error;
    }
  },

  saveWrapup: async (
    id: number,
    payload: WrapupPayload,
    hasExisting: boolean
  ) => {
    try {
      if (hasExisting) {
        await apiUpdateWrapup(id, payload);
      } else {
        await apiCreateWrapup(id, payload);
      }
      await get().refreshProject(id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save wrapup";
      set({ error: message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
