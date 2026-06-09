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
  formatProjectStatus,
  formatBudget,
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
    updateStatus,
    clearError,
  } = useProjectsStore();
  const { artists, fetchArtists } = useArtistsStore();

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
      await updateStatus(pendingCompleteProjectId, {
        status: "completed",
        end_date: new Date().toISOString().split("T")[0],
      });
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
                      const leadArtist = artists.find(
                        (a) => a.id === project.lead_artist_id
                      );
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
                                  {project.start_date || "No date"}
                                </span>
                              </div>
                              {leadArtist && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <User className="h-3 w-3 shrink-0" />
                                  <span className="truncate">
                                    {leadArtist.artist_name}
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
  const { artists } = useArtistsStore();
  const { updateProject, assignTeam } = useProjectsStore();

  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    project_type: project.project_type ?? "",
    start_date: project.start_date ?? "",
    end_date: project.end_date ?? "",
    budget: project.budget ?? "",
    lead_artist_id: project.lead_artist_id,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Reset the form when switching projects.
  useEffect(() => {
    setForm({
      name: project.name,
      description: project.description ?? "",
      project_type: project.project_type ?? "",
      start_date: project.start_date ?? "",
      end_date: project.end_date ?? "",
      budget: project.budget ?? "",
      lead_artist_id: project.lead_artist_id,
    });
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
        lead_artist_id: form.lead_artist_id,
      });
      toast.success("Project saved");
    } catch {
      // error surfaced via store toast
    } finally {
      setIsSaving(false);
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
                <Button onClick={() => onMarkComplete(project.id)}>
                  Mark Complete
                </Button>
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
                  <Input
                    value={form.project_type}
                    onChange={(e) =>
                      setForm({ ...form, project_type: e.target.value })
                    }
                    placeholder="e.g., Concert, Album"
                  />
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
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Lead Artist
                </Label>
                <Select
                  value={
                    form.lead_artist_id ? String(form.lead_artist_id) : "none"
                  }
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      lead_artist_id: value === "none" ? null : Number(value),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead artist" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No lead artist</SelectItem>
                    {artists.map((artist) => (
                      <SelectItem key={artist.id} value={String(artist.id)}>
                        {artist.artist_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>Budget: {formatBudget(project.budget)}</span>
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
