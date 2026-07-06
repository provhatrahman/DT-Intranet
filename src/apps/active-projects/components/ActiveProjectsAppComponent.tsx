import { useState, useEffect, useMemo } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { ActiveProjectsMenuBar } from "./ActiveProjectsMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { helpItems, appMetadata } from "..";
import { DevDataBanner, DevDataChip } from "@/components/shared/DevDataBanner";
import { useThemeStore } from "@/stores/useThemeStore";
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
import type { ProjectDetail, ProjectMember } from "@/lib/api/projects";
import type { ArtistDetail } from "@/lib/api/artists";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useIsMobile } from "@/hooks/useIsMobile";
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
} from "lucide-react";

function statusBadgeClasses(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 border-green-200";
    case "completed":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "on_hold":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "cancelled":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
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
  const isMobile = useIsMobile();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );

  const currentTheme = useThemeStore((state) => state.current);
  const isMacOSTheme = currentTheme === "macosx";
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  const tabStyles = getTabStyles(currentTheme);

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
          <DevDataBanner
            sources={[
              { label: "projects", status: "live", detail: "/api/projects/" },
              { label: "artists", status: "live", detail: "/api/artists/" },
              { label: "gig scores", status: "hidden", detail: "analytics 500 — not shown" },
            ]}
          />
        <div
          className={cn(
            "flex flex-1 w-full min-h-0",
            isMacOSTheme
              ? "p-4 pt-2 bg-gradient-to-b from-[#ECECEC] to-[#E5E5E5]"
              : "p-4 bg-background"
          )}
        >
          {/* Project List Sidebar */}
          {(!isMobile || selectedProjectId === null) && (
            <div
              className={cn(
                "flex flex-col min-h-0",
                isMobile ? "w-full" : "w-64 pr-4 mr-4",
                isMacOSTheme && !isMobile && "border-r border-r-black/10"
              )}
            >
              <h2 className="text-lg font-semibold mb-3">Projects</h2>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2">
                  {isLoading && activeProjects.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-2">
                      Loading projects...
                    </div>
                  ) : activeProjects.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-2">
                      No active projects. Approve offers from the Inbox to
                      create projects.
                    </div>
                  ) : (
                    activeProjects.map((project) => {
                      const isSelected = selectedProjectId === project.id;
                      return (
                        <button
                          key={project.id}
                          onClick={() => setSelectedProjectId(project.id)}
                          className={cn(
                            "w-full text-left p-3 rounded-md transition-all border",
                            isSelected
                              ? "bg-muted border-primary/40"
                              : "hover:bg-muted/50 border-transparent"
                          )}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium text-sm flex-1">
                                {project.name}
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs shrink-0",
                                  statusBadgeClasses(project.status)
                                )}
                              >
                                {formatProjectStatus(project.status)}
                              </Badge>
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
                              <DevDataChip status="live" label="API" detail="/api/projects/" />
                            </div>
                          </div>
                        </button>
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
                isMacOSTheme ? "bg-transparent" : "bg-background"
              )}
            >
              {activeProjects.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  No active projects.
                </div>
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
    feedback: p.feedback ?? "",
  });

  const [form, setForm] = useState(() => projectToForm(project));
  const [isSaving, setIsSaving] = useState(false);

  // Reset the form when switching projects.
  useEffect(() => {
    setForm(projectToForm(project));
  }, [project]);

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
            <div className="space-y-6 p-4 pr-6 max-w-3xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <h1 className="text-2xl font-semibold break-words">
                    {project.name}
                  </h1>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", statusBadgeClasses(project.status))}
                  >
                    {formatProjectStatus(project.status)}
                  </Badge>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Button onClick={() => onMarkComplete(project.id)}>
                    Mark Complete
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span>Budget: {formatBudget(project.budget)}</span>
                {project.source && <span>Source: {project.source}</span>}
                {project.gig_size_code && (
                  <span>Gig size: {project.gig_size_code}</span>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Changes"}
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
                <div className="text-sm text-muted-foreground py-4">
                  No tasks for this project.
                </div>
              ) : (
                project.tasks.map((task) => (
                  <Card key={task.id}>
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
                          <Badge variant="secondary" className="text-xs">
                            {task.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
      <div className="p-4 space-y-4 flex-1 min-h-0 flex flex-col">
        {/* Current lineup */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Lineup</h3>
            <DevDataChip status="live" label="assign-team" detail="/api/projects/" />
            <DevDataChip status="hidden" label="gig score" detail="analytics 500" />
          </div>
          {project.members.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">
              No artists assigned yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {project.members.map((member: ProjectMember) => (
                <div
                  key={member.artist_id}
                  className="flex items-center justify-between gap-2 p-2 rounded-md border"
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
                    <DevDataChip status="live" label="artist" detail="/api/artists/" className="mt-0.5" />
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
            <DevDataChip status="live" label="/api/artists/" />
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
                    className="flex items-center justify-between gap-2 p-2 rounded-md border"
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
                      className="shrink-0"
                      onClick={() => onToggleMember(artist.id, role)}
                    >
                      {assigned ? (
                        "Assigned"
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </>
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

      <Dialog
        open={detailArtist !== null}
        onOpenChange={(open) => {
          if (!open) setDetailArtist(null);
        }}
      >
        <DialogContent
          className={cn(isMobile ? "max-w-[calc(100vw-2rem)]" : "max-w-md")}
        >
          <DialogHeader>
            <DialogTitle>
              {detailArtist?.artist_name || "Artist"}
            </DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
