import { useState, useEffect, useMemo } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { ActiveProjectsMenuBar } from "./ActiveProjectsMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { helpItems, appMetadata } from "..";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { useArtistsStore } from "@/stores/useArtistsStore";
import {
  PROJECT_ROLES,
  DEFAULT_PROJECT_ROLE,
  GIG_SIZES,
  PROJECT_TYPES,
  formatProjectStatus,
  formatBudget,
  toDateInputValue,
} from "../data";
import type {
  ProjectDetail,
  ProjectMember,
  ProjectStatusHistoryEntry,
} from "@/lib/api/projects";
import { getProjectStatusHistory } from "@/lib/api/projects";
import type { ArtistDetail } from "@/lib/api/artists";
import { CardContent } from "@/components/ui/card";
import {
  AquaCard,
  EmptyState,
  FormDialog,
  SidebarRow,
  StatusBadge,
  useOsTheme,
} from "@/components/greenroom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getTabStyles } from "@/utils/tabStyles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Users,
  Calendar,
  Music,
  User,
  DollarSign,
  Building2,
  Mail,
  Instagram,
  ListChecks,
  Plus,
  X,
  FolderOpen,
  ExternalLink,
  History,
} from "lucide-react";

// Greenroom stores a Google Drive folder ID; build the folder URL from it.
function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export function ActiveProjectsAppComponent({
  isWindowOpen,
  onClose,
  isForeground,
  skipInitialSound,
  instanceId,
  onNavigateNext,
  onNavigatePrevious,
}: AppProps) {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [pendingCompleteProjectId, setPendingCompleteProjectId] = useState<
    number | null
  >(null);
  // Viewport-width based (not touch): a touch-enabled desktop keeps the
  // two-pane master-detail layout instead of collapsing to a single pane.
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );

  const { themeId, isMacTheme, isXpTheme } = useOsTheme();
  const tabStyles = getTabStyles(themeId);

  const {
    activeProjects,
    projectDetails,
    isLoading,
    error,
    fetchActiveProjects,
    refreshProject,
    updateProject,
    updateStatus,
    clearError,
  } = useProjectsStore();
  const { fetchArtists } = useArtistsStore();

  // Fetch projects and artists when the window opens.
  useEffect(() => {
    if (isWindowOpen) {
      fetchActiveProjects().catch((err) => {
        console.error("Failed to fetch projects:", err);
      });
      fetchArtists().catch((err) => {
        console.error("Failed to fetch artists:", err);
      });
    }
  }, [isWindowOpen, fetchActiveProjects, fetchArtists]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // Default selection on desktop.
  useEffect(() => {
    if (!isMobile && activeProjects.length > 0 && selectedProjectId === null) {
      setSelectedProjectId(activeProjects[0].id);
    }
  }, [activeProjects, selectedProjectId, isMobile]);

  // Load detail whenever a project is selected.
  useEffect(() => {
    if (selectedProjectId !== null && !projectDetails[selectedProjectId]) {
      refreshProject(selectedProjectId).catch((err) => {
        console.error("Failed to load project detail:", err);
      });
    }
  }, [selectedProjectId, projectDetails, refreshProject]);

  const selectedProject =
    selectedProjectId !== null ? projectDetails[selectedProjectId] : undefined;

  const menuBar = (
    <ActiveProjectsMenuBar
      onClose={onClose}
      onShowHelp={() => setIsHelpDialogOpen(true)}
      onShowAbout={() => setIsAboutDialogOpen(true)}
    />
  );

  const handleMarkCompleteClick = (projectId: number) => {
    setPendingCompleteProjectId(projectId);
    setIsCompleteDialogOpen(true);
  };

  const handleCompleteConfirm = async () => {
    if (pendingCompleteProjectId === null) return;
    try {
      // update-status only takes the status; the end date is a normal field.
      const project = projectDetails[pendingCompleteProjectId];
      if (!project?.end_date) {
        await updateProject(pendingCompleteProjectId, {
          end_date: new Date().toISOString().split("T")[0],
        });
      }
      await updateStatus(pendingCompleteProjectId, "completed");
      toast.success("Project marked as complete and moved to Archive");
      if (selectedProjectId === pendingCompleteProjectId) {
        setSelectedProjectId(null);
      }
    } catch {
      // error surfaced via store toast
    } finally {
      setIsCompleteDialogOpen(false);
      setPendingCompleteProjectId(null);
    }
  };

  if (!isWindowOpen) return null;

  return (
    <>
      {!isXpTheme && isForeground && menuBar}
      <WindowFrame
        title="Active Projects"
        onClose={onClose}
        isForeground={isForeground}
        appId="active-projects"
        skipInitialSound={skipInitialSound}
        instanceId={instanceId}
        onNavigateNext={onNavigateNext}
        onNavigatePrevious={onNavigatePrevious}
        menuBar={isXpTheme ? menuBar : undefined}
      >
        <div className="flex flex-col h-full w-full min-h-0">
        <div
          className={cn(
            "flex flex-1 w-full min-h-0 p-4",
            isMacTheme ? "pt-2" : "bg-background"
          )}
        >
          {/* Project List Sidebar */}
          {(!isMobile || selectedProjectId === null) && (
            <div
              className={cn(
                "flex flex-col min-h-0",
                isMobile ? "w-full" : "w-64 pr-4 mr-4",
                isMacTheme && !isMobile && "border-r border-r-black/10"
              )}
            >
              <h2 className="text-lg font-semibold mb-3">Projects</h2>
              {/* Radix wraps content in a display:table div that grows to the
                  content's intrinsic width; force block so rows can't exceed
                  the fixed sidebar width. */}
              <ScrollArea className="flex-1 min-h-0 [&_[data-radix-scroll-area-viewport]>div]:block!">
                <div className="space-y-2">
                  {isLoading && activeProjects.length === 0 ? (
                    <EmptyState title="Loading projects..." className="py-6" />
                  ) : activeProjects.length === 0 ? (
                    <EmptyState
                      title="No active projects"
                      hint="Approve offers from the Inbox to create projects."
                      className="py-6"
                    />
                  ) : (
                    activeProjects.map((project) => {
                      const isSelected = selectedProjectId === project.id;
                      return (
                        <SidebarRow
                          key={project.id}
                          selected={isSelected}
                          onClick={() => setSelectedProjectId(project.id)}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium text-sm flex-1 min-w-0 break-words">
                                {project.name}
                              </div>
                              <StatusBadge
                                status={project.status}
                                label={formatProjectStatus(project.status)}
                                className="shrink-0"
                              />
                            </div>
                            <div className="space-y-1">
                              {project.project_type && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  <span className="truncate">
                                    {project.project_type}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {toDateInputValue(
                                    project.event_date || project.start_date
                                  ) || "No date"}
                                </span>
                              </div>
                              {(project.city || project.venue_name) && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate">
                                    {[project.venue_name, project.city]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </SidebarRow>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Main Content */}
          {(!isMobile || selectedProjectId !== null) && (
            <div
              className={cn(
                "flex-1 flex flex-col min-w-0 min-h-0",
                isMacTheme ? "bg-transparent" : "bg-background"
              )}
            >
              {activeProjects.length === 0 ? (
                <EmptyState title="No active projects" className="flex-1" />
              ) : selectedProject ? (
                <ProjectDetailView
                  project={selectedProject}
                  tabStyles={tabStyles}
                  isMobile={isMobile}
                  onBack={() => setSelectedProjectId(null)}
                  onMarkComplete={handleMarkCompleteClick}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  {selectedProjectId !== null
                    ? "Loading project..."
                    : "Select a project to view details"}
                </div>
              )}
            </div>
          )}
        </div>
        </div>

        <HelpDialog
          isOpen={isHelpDialogOpen}
          onOpenChange={setIsHelpDialogOpen}
          helpItems={helpItems}
          appId="active-projects"
        />
        <AboutDialog
          isOpen={isAboutDialogOpen}
          onOpenChange={setIsAboutDialogOpen}
          metadata={appMetadata}
          appId="active-projects"
        />
        <ConfirmDialog
          isOpen={isCompleteDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsCompleteDialogOpen(false);
              setPendingCompleteProjectId(null);
            } else {
              setIsCompleteDialogOpen(true);
            }
          }}
          onConfirm={handleCompleteConfirm}
          title="Mark Project as Complete"
          description={`Are you sure you want to mark "${
            activeProjects.find((p) => p.id === pendingCompleteProjectId)?.name ||
            "this project"
          }" as complete? It will move to the Archive.`}
        />
      </WindowFrame>
    </>
  );
}

function ProjectDetailView({
  project,
  tabStyles,
  isMobile,
  onBack,
  onMarkComplete,
}: {
  project: ProjectDetail;
  tabStyles: ReturnType<typeof getTabStyles>;
  isMobile: boolean;
  onBack: () => void;
  onMarkComplete: (projectId: number) => void;
}) {
  const { updateProject, updateStatus, assignTeam } = useProjectsStore();

  const projectToForm = (p: ProjectDetail) => ({
    name: p.name,
    description: p.description ?? "",
    project_type: p.project_type ?? "",
    start_date: toDateInputValue(p.start_date),
    end_date: toDateInputValue(p.end_date),
    budget: p.budget ?? "",
    event_date: toDateInputValue(p.event_date),
    event_type: p.event_type ?? "",
    venue_name: p.venue_name ?? "",
    city: p.city ?? "",
    country: p.country ?? "",
    promoter_name: p.promoter_name ?? "",
    gig_size_id: p.gig_size_id,
    drive_parent_folder_id: p.drive_parent_folder_id ?? "",
    feedback: p.feedback ?? "",
  });

  const [form, setForm] = useState(() => projectToForm(project));
  const [isSaving, setIsSaving] = useState(false);
  const [statusHistory, setStatusHistory] = useState<
    ProjectStatusHistoryEntry[]
  >([]);

  // Reset the form when switching projects.
  useEffect(() => {
    setForm(projectToForm(project));
  }, [project]);

  // Read-only status-change log. Re-fetch when the project changes or its
  // status changes (a status update writes a new history row).
  useEffect(() => {
    let cancelled = false;
    getProjectStatusHistory(project.id)
      .then((history) => {
        if (!cancelled) setStatusHistory(history);
      })
      .catch((err) => {
        console.error("Failed to load status history:", err);
        if (!cancelled) setStatusHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, project.status]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProject(project.id, {
        name: form.name,
        description: form.description,
        project_type: form.project_type || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        budget: form.budget || undefined,
        event_date: form.event_date || undefined,
        event_type: form.event_type || undefined,
        venue_name: form.venue_name || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        promoter_name: form.promoter_name || undefined,
        gig_size_id: form.gig_size_id ?? undefined,
        drive_parent_folder_id: form.drive_parent_folder_id || undefined,
        feedback: form.feedback || undefined,
      });
      toast.success("Project saved");
    } catch {
      // error surfaced via store toast
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (status === project.status) return;
    try {
      await updateStatus(project.id, status);
      toast.success(
        status === "active"
          ? "Project set active"
          : `Project ${formatProjectStatus(status).toLowerCase()}`
      );
    } catch {
      // error surfaced via store toast
    }
  };

  const handleToggleMember = async (artistId: number, role: string) => {
    const existing = project.members.find((m) => m.artist_id === artistId);
    let nextMembers: { artist_id: number; role_in_project: string }[];
    if (existing) {
      nextMembers = project.members
        .filter((m) => m.artist_id !== artistId)
        .map((m) => ({ artist_id: m.artist_id, role_in_project: m.role_in_project }));
    } else {
      nextMembers = [
        ...project.members.map((m) => ({
          artist_id: m.artist_id,
          role_in_project: m.role_in_project,
        })),
        { artist_id: artistId, role_in_project: role },
      ];
    }
    try {
      await assignTeam(project.id, nextMembers);
      toast.success(existing ? "Removed from lineup" : "Added to lineup");
    } catch {
      // error surfaced via store toast
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {isMobile && (
        <div className="flex items-center gap-2 mb-2 pb-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-0 h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm truncate">{project.name}</span>
        </div>
      )}
      <Tabs
        defaultValue="overview"
        className="flex-1 flex flex-col min-w-0 min-h-0"
      >
        <TabsList className={tabStyles.tabListClasses}>
          <TabsTrigger className={tabStyles.tabTriggerClasses} value="overview">
            Overview
          </TabsTrigger>
          <TabsTrigger className={tabStyles.tabTriggerClasses} value="lineup">
            Lineup ({project.members.length})
          </TabsTrigger>
          <TabsTrigger className={tabStyles.tabTriggerClasses} value="tasks">
            Tasks ({project.tasks.length})
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent
          value="overview"
          className={cn(
            tabStyles.tabContentClasses,
            "flex-1 flex flex-col min-w-0 min-h-0"
          )}
        >
          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4 pr-6 @container">
              {/* Actions sit beside the title on wide windows and wrap below
                  it on narrow ones/phones */}
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="flex-1 min-w-[14rem] space-y-1">
                  <h1 className="text-2xl font-semibold break-words">
                    {project.name}
                  </h1>
                  <StatusBadge
                    status={project.status}
                    label={formatProjectStatus(project.status)}
                  />
                </div>
                <div className="flex flex-row @lg:flex-col items-center @lg:items-end gap-2 shrink-0">
                  <Button
                    variant="default"
                    onClick={() => onMarkComplete(project.id)}
                    className="min-h-[32px] touch-manipulation"
                  >
                    <span>Mark Complete</span>
                  </Button>
                  <Select value={project.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="min-h-[100px]"
                />
              </div>

              {/* Fields flow into more columns as the detail pane widens
                  (container query = pane width, not viewport) so a wide
                  window fills instead of leaving a right-side gutter. */}
              <div className="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Project Type</Label>
                  <Select
                    value={form.project_type || "unset"}
                    onValueChange={(v) =>
                      setForm({ ...form, project_type: v === "unset" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Not set</SelectItem>
                      {PROJECT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                      {form.project_type &&
                        !(PROJECT_TYPES as readonly string[]).includes(
                          form.project_type
                        ) && (
                          <SelectItem value={form.project_type}>
                            {form.project_type}
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Budget
                  </Label>
                  <Input
                    value={form.budget}
                    onChange={(e) =>
                      setForm({ ...form, budget: e.target.value })
                    }
                    placeholder="e.g., 5000"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Start Date
                  </Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm({ ...form, start_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    End Date
                  </Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Event Date
                  </Label>
                  <Input
                    type="date"
                    value={form.event_date}
                    onChange={(e) =>
                      setForm({ ...form, event_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Event Type</Label>
                  <Input
                    value={form.event_type}
                    onChange={(e) =>
                      setForm({ ...form, event_type: e.target.value })
                    }
                    placeholder="e.g., Concert"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Venue
                  </Label>
                  <Input
                    value={form.venue_name}
                    onChange={(e) =>
                      setForm({ ...form, venue_name: e.target.value })
                    }
                    placeholder="e.g., Electric Brixton"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Gig Size</Label>
                  <Select
                    value={
                      form.gig_size_id !== null
                        ? String(form.gig_size_id)
                        : "unset"
                    }
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        gig_size_id: v === "unset" ? null : Number(v),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Not set</SelectItem>
                      {GIG_SIZES.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    City
                  </Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Country</Label>
                  <Input
                    value={form.country}
                    onChange={(e) =>
                      setForm({ ...form, country: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Promoter
                  </Label>
                  <Input
                    value={form.promoter_name}
                    onChange={(e) =>
                      setForm({ ...form, promoter_name: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Google Drive Folder
                </Label>
                <Input
                  value={form.drive_parent_folder_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      drive_parent_folder_id: e.target.value,
                    })
                  }
                  placeholder="Google Drive folder ID"
                />
                {form.drive_parent_folder_id && (
                  <a
                    href={driveFolderUrl(form.drive_parent_folder_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open in Google Drive
                  </a>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Feedback</Label>
                <Textarea
                  value={form.feedback}
                  onChange={(e) =>
                    setForm({ ...form, feedback: e.target.value })
                  }
                  placeholder="Feedback collected on this project..."
                  className="min-h-[60px]"
                />
              </div>

              {/* Read-only status-change history (backend audit log; not a
                  free-text update feed — see FUNCTIONALITY_AUDIT.md). */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Status History
                </Label>
                {statusHistory.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    No status changes recorded yet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {[...statusHistory]
                      .sort((a, b) =>
                        b.changed_at.localeCompare(a.changed_at)
                      )
                      .map((entry) => (
                        <div
                          key={entry.id}
                          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs"
                        >
                          <span className="text-muted-foreground shrink-0 tabular-nums">
                            {new Date(entry.changed_at).toLocaleDateString(
                              undefined,
                              { year: "numeric", month: "short", day: "numeric" }
                            )}
                          </span>
                          <span>
                            {entry.old_status && (
                              <>
                                {formatProjectStatus(entry.old_status)}
                                <span className="text-muted-foreground"> → </span>
                              </>
                            )}
                            <span className="font-medium">
                              {formatProjectStatus(entry.new_status)}
                            </span>
                            {entry.changed_by_username && (
                              <span className="text-muted-foreground">
                                {" "}
                                · {entry.changed_by_username}
                              </span>
                            )}
                          </span>
                          {entry.notes && (
                            <span className="text-muted-foreground">
                              — {entry.notes}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span>Budget: {formatBudget(project.budget)}</span>
                {project.source && <span>Source: {project.source}</span>}
                {project.gig_size_code && (
                  <span>Gig size: {project.gig_size_code}</span>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="default"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="min-h-[36px] touch-manipulation"
                >
                  <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                </Button>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Lineup */}
        <TabsContent
          value="lineup"
          className={cn(
            tabStyles.tabContentClasses,
            "flex-1 flex flex-col min-w-0 min-h-0"
          )}
        >
          <LineupTab
            project={project}
            onToggleMember={handleToggleMember}
            isMobile={isMobile}
          />
        </TabsContent>

        {/* Tasks */}
        <TabsContent
          value="tasks"
          className={cn(
            tabStyles.tabContentClasses,
            "flex-1 flex flex-col min-w-0 min-h-0"
          )}
        >
          <ScrollArea className="flex-1">
            <div className="space-y-3 p-4 pr-6">
              <div className="flex items-center gap-2 mb-1">
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Tasks</h3>
              </div>
              {project.tasks.length === 0 ? (
                <EmptyState title="No tasks for this project" className="py-6" />
              ) : (
                project.tasks.map((task) => (
                  <AquaCard key={task.id}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm">
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {task.description}
                            </div>
                          )}
                          {task.due_date && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Due: {task.due_date}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <StatusBadge status={task.status} />
                          <StatusBadge status={task.priority} tone="gray" />
                        </div>
                      </div>
                    </CardContent>
                  </AquaCard>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LineupTab({
  project,
  onToggleMember,
  isMobile,
}: {
  project: ProjectDetail;
  onToggleMember: (artistId: number, role: string) => void;
  isMobile: boolean;
}) {
  const { artists, getArtistDetail } = useArtistsStore();
  const { isMacTheme } = useOsTheme();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>(DEFAULT_PROJECT_ROLE);
  const [detailArtist, setDetailArtist] = useState<ArtistDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const memberIds = useMemo(
    () => new Set(project.members.map((m) => m.artist_id)),
    [project.members]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter(
      (a) =>
        a.artist_name.toLowerCase().includes(q) ||
        (a.preferred_name ?? "").toLowerCase().includes(q)
    );
  }, [search, artists]);

  const openDetail = async (artistId: number) => {
    setLoadingDetail(true);
    try {
      const detail = await getArtistDetail(artistId);
      setDetailArtist(detail);
    } catch {
      // ignore; store records the error
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <div className="p-4 space-y-4 flex-1 min-h-0 flex flex-col @container">
        {/* Current lineup */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Lineup</h3>
          </div>
          {project.members.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">
              No artists assigned yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 gap-2">
              {project.members.map((member: ProjectMember) => (
                <div
                  key={member.artist_id}
                  className={cn(
                    "flex items-center justify-between gap-2 p-2 rounded-md",
                    isMacTheme ? "aqua-well" : "border"
                  )}
                >
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => openDetail(member.artist_id)}
                  >
                    <div className="font-medium text-sm truncate">
                      {member.artist_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {member.role_in_project}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() =>
                      onToggleMember(member.artist_id, member.role_in_project)
                    }
                    title="Remove from lineup"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add artists */}
        <div className="space-y-2 pt-2 border-t flex-1 min-h-0 flex flex-col">

          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs text-muted-foreground font-medium">All artists</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Input
              placeholder="Search artists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-3">
              {filtered.map((artist) => {
                const assigned = memberIds.has(artist.id);
                return (
                  <div
                    key={artist.id}
                    className={cn(
                      "flex items-center justify-between gap-2 p-2 rounded-md",
                      isMacTheme ? "aqua-well" : "border"
                    )}
                  >
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => openDetail(artist.id)}
                    >
                      <div className="font-medium text-sm truncate">
                        {artist.artist_name}
                      </div>
                      {artist.preferred_name &&
                        artist.preferred_name !== artist.artist_name && (
                          <div className="text-xs text-muted-foreground truncate">
                            {artist.preferred_name}
                          </div>
                        )}
                    </button>
                    <Button
                      variant={assigned ? "secondary" : "default"}
                      size="sm"
                      className="shrink-0 min-h-[32px] touch-manipulation"
                      onClick={() => onToggleMember(artist.id, role)}
                    >
                      {assigned ? (
                        <span>Assigned</span>
                      ) : (
                        <span className="inline-flex items-center">
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </span>
                      )}
                    </Button>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No artists found.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <FormDialog
        isOpen={detailArtist !== null}
        onOpenChange={(open) => {
          if (!open) setDetailArtist(null);
        }}
        title={detailArtist?.artist_name || "Artist"}
        contentClassName={cn(!isMobile && "max-w-md")}
      >
        <div className="py-1">
          {loadingDetail ? (
            <div className="py-4 text-sm text-muted-foreground">Loading...</div>
          ) : detailArtist ? (
            <div className="space-y-3 text-sm">
              {detailArtist.preferred_name && (
                <div className="text-muted-foreground">
                  {detailArtist.preferred_name}
                  {detailArtist.pronouns ? ` (${detailArtist.pronouns})` : ""}
                </div>
              )}
              {detailArtist.bio && <p>{detailArtist.bio}</p>}
              {detailArtist.type_of_act && (
                <div className="flex items-center gap-1.5">
                  <Music className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{detailArtist.type_of_act}</span>
                </div>
              )}
              {detailArtist.genres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {detailArtist.genres.map((g) => (
                    <Badge key={g} variant="secondary" className="text-xs">
                      {g}
                    </Badge>
                  ))}
                </div>
              )}
              {detailArtist.locations.length > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>
                    {detailArtist.locations
                      .map((l) => `${l.city}, ${l.country}`)
                      .join(" • ")}
                  </span>
                </div>
              )}
              {detailArtist.primary_email && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{detailArtist.primary_email}</span>
                </div>
              )}
              {detailArtist.instagram && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Instagram className="h-3.5 w-3.5" />
                  <span className="truncate">{detailArtist.instagram}</span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </FormDialog>
    </div>
  );
}
