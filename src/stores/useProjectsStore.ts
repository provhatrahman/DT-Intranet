import { create } from "zustand";
import {
  ProjectListItem,
  ProjectDetail,
  ProjectStatus,
  ProjectWrapup,
  ProjectUpdate,
  ProjectSuggestion,
  SuggestionVoteValue,
  CreateProjectPayload,
  UpdateProjectPayload,
  TeamMemberPayload,
  WrapupPayload,
  getProjects as apiGetProjects,
  getProjectById as apiGetProjectById,
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  updateProjectStatus as apiUpdateProjectStatus,
  assignTeam as apiAssignTeam,
  addProjectTeamMember as apiAddProjectTeamMember,
  removeProjectTeamMember as apiRemoveProjectTeamMember,
  archiveProject as apiArchiveProject,
  getProjectWrapup as apiGetProjectWrapup,
  createWrapup as apiCreateWrapup,
  updateWrapup as apiUpdateWrapup,
  getProjectUpdates as apiGetProjectUpdates,
  addProjectUpdate as apiAddProjectUpdate,
  getProjectSuggestions as apiGetProjectSuggestions,
  addProjectSuggestion as apiAddProjectSuggestion,
  voteProjectSuggestion as apiVoteProjectSuggestion,
  deleteProjectSuggestion as apiDeleteProjectSuggestion,
} from "@/lib/api/projects";

// Statuses shown in the Archive app. "archived" is the explicit filing status
// set by POST /projects/{id}/archive/; completed and cancelled are terminal
// working statuses that can still be filed to the archive.
export const ARCHIVE_VIEW_STATUSES: ProjectStatus[] = [
  "completed",
  "cancelled",
  "archived",
];

interface ProjectsState {
  activeProjects: ProjectListItem[];
  // Projects with a status in ARCHIVE_VIEW_STATUSES. The backend list endpoint
  // returns only active projects unless a ?status= filter is given, so these
  // are fetched with one request per status and merged.
  archivedProjects: ProjectListItem[];
  projectDetails: Record<number, ProjectDetail>;
  isLoading: boolean;
  isLoadingArchived: boolean;
  error: string | null;
  lastFetch: number | null;

  fetchActiveProjects: () => Promise<void>;
  fetchArchivedProjects: () => Promise<void>;
  refreshProject: (id: number) => Promise<ProjectDetail>;
  createProject: (payload: CreateProjectPayload) => Promise<number>;
  updateProject: (id: number, payload: UpdateProjectPayload) => Promise<void>;
  updateStatus: (id: number, status: ProjectStatus) => Promise<void>;
  assignTeam: (id: number, members: TeamMemberPayload[]) => Promise<void>;
  // Internal staff team (users), distinct from the artist `assignTeam` above.
  addTeamMember: (id: number, userId: number, role: string) => Promise<void>;
  removeTeamMember: (id: number, userId: number) => Promise<void>;
  archiveProject: (id: number) => Promise<void>;
  fetchWrapup: (id: number) => Promise<ProjectWrapup | null>;
  saveWrapup: (
    id: number,
    payload: WrapupPayload,
    hasExisting: boolean
  ) => Promise<void>;
  fetchUpdates: (id: number) => Promise<ProjectUpdate[]>;
  postUpdate: (
    id: number,
    body: string,
    userId: number | null
  ) => Promise<ProjectUpdate>;
  // Curation: artist suggestions (longlist) + thumbs up/down votes. Like
  // updates/wrapup, these return data to the caller rather than caching.
  fetchSuggestions: (id: number) => Promise<ProjectSuggestion[]>;
  addSuggestion: (
    id: number,
    payload: { artist_name: string; link?: string; notes?: string },
    userId: number | null
  ) => Promise<ProjectSuggestion>;
  voteSuggestion: (
    id: number,
    suggestionId: number,
    userId: number,
    voteValue: SuggestionVoteValue
  ) => Promise<ProjectSuggestion>;
  deleteSuggestion: (id: number, suggestionId: number) => Promise<void>;
  clearError: () => void;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  activeProjects: [],
  archivedProjects: [],
  projectDetails: {},
  isLoading: false,
  isLoadingArchived: false,
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

  fetchArchivedProjects: async () => {
    set({ isLoadingArchived: true, error: null });
    try {
      const lists = await Promise.all(
        ARCHIVE_VIEW_STATUSES.map((status) => apiGetProjects(status))
      );
      const archivedProjects = lists
        .flat()
        .sort((a, b) =>
          (b.end_date ?? b.start_date ?? "").localeCompare(
            a.end_date ?? a.start_date ?? ""
          )
        );
      set({ archivedProjects, isLoadingArchived: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch projects";
      set({ error: message, isLoadingArchived: false });
      throw error;
    }
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
      if (payload.status === "active") {
        await get().fetchActiveProjects();
      }
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

  updateStatus: async (id: number, status: ProjectStatus) => {
    try {
      await apiUpdateProjectStatus(id, status);
      await get().refreshProject(id);
      // A project leaving "active" drops out of the Active Projects view.
      set((state) => ({
        activeProjects:
          status !== "active"
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

  addTeamMember: async (id: number, userId: number, role: string) => {
    try {
      await apiAddProjectTeamMember(id, userId, role);
      await get().refreshProject(id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add team member";
      set({ error: message });
      throw error;
    }
  },

  removeTeamMember: async (id: number, userId: number) => {
    try {
      await apiRemoveProjectTeamMember(id, userId);
      await get().refreshProject(id);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to remove team member";
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
        archivedProjects: state.archivedProjects.map((p) =>
          p.id === id ? { ...p, status: "archived" } : p
        ),
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

  fetchUpdates: async (id: number) => {
    try {
      return await apiGetProjectUpdates(id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch updates";
      set({ error: message });
      throw error;
    }
  },

  postUpdate: async (id: number, body: string, userId: number | null) => {
    try {
      return await apiAddProjectUpdate(id, body, userId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to post update";
      set({ error: message });
      throw error;
    }
  },

  fetchSuggestions: async (id: number) => {
    try {
      return await apiGetProjectSuggestions(id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch suggestions";
      set({ error: message });
      throw error;
    }
  },

  addSuggestion: async (
    id: number,
    payload: { artist_name: string; link?: string; notes?: string },
    userId: number | null
  ) => {
    try {
      return await apiAddProjectSuggestion(id, payload, userId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add suggestion";
      set({ error: message });
      throw error;
    }
  },

  voteSuggestion: async (
    id: number,
    suggestionId: number,
    userId: number,
    voteValue: SuggestionVoteValue
  ) => {
    try {
      return await apiVoteProjectSuggestion(id, suggestionId, userId, voteValue);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to record vote";
      set({ error: message });
      throw error;
    }
  },

  deleteSuggestion: async (id: number, suggestionId: number) => {
    try {
      await apiDeleteProjectSuggestion(id, suggestionId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete suggestion";
      set({ error: message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
