import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { ActiveProjectsMenuBar } from "./ActiveProjectsMenuBar";
import HelpGuideDialog from "@/components/help/HelpGuideDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { appMetadata } from "..";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { useArtistsStore } from "@/stores/useArtistsStore";
import { useUsersStore } from "@/stores/useUsersStore";
import { useBookingsStore } from "@/stores/useBookingsStore";
import {
  PROJECT_LEAD_ROLE,
  TEAM_MEMBER_ROLE,
  GIG_SIZES,
  PROJECT_TYPES,
  formatProjectStatus,
  toDateInputValue,
} from "../data";
import type {
  ProjectDetail,
  ProjectLineupEntry,
  ProjectTeamMember,
  ProjectUpdate,
  ProjectSuggestion,
} from "@/lib/api/projects";
import type { ArtistListItem } from "@/lib/api/artists";
import {
  useEffectiveGreenroomAccount,
  useIsGreenroomAdmin,
} from "@/hooks/useGreenroomAccount";
import { CardContent } from "@/components/ui/card";
import {
  AquaCard,
  EmptyState,
  Field,
  FormDialog,
  SidebarRow,
  StatusBadge,
  useOsTheme,
} from "@/components/greenroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Users,
  Calendar,
  Check,
  Music,
  Building2,
  FileText,
  ListChecks,
  Plus,
  X,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  FolderOpen,
  ExternalLink,
  MessageSquare,
  Loader2,
  Search,
  Mic,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Greenroom stores a bare Google Drive folder ID; build the folder URL from it.
function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

// Users paste a full "Open in Drive" link; pull the bare folder ID out of it so
// we keep storing the ID (what the backend expects). Handles the common shapes
// (/folders/<id>, ?id=<id>, /d/<id>) and falls back to the raw input when it's
// already just an ID.
function extractDriveFolderId(input: string): string {
  const value = input.trim();
  if (!value) return "";
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const re of patterns) {
    const match = value.match(re);
    if (match) return match[1];
  }
  return value;
}

// Titled section panel for the Overview tab: a glossy Aqua card (plain shadcn
// Card on other themes) with an icon + heading row. Declares itself a
// container so inner grids respond to the card's own width — this keeps
// column counts sane when cards sit side by side on wide windows.
function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AquaCard className={className}>
      <CardContent className="p-4 @container">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-semibold truncate">{title}</h3>
        </div>
        <div className="space-y-4">{children}</div>
      </CardContent>
    </AquaCard>
  );
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
  const { fetchUsers } = useUsersStore();
  // Bookings are needed only to tell which on_hold projects are still an open
  // (pending) offer living in the Inbox, so we can keep those out of here.
  const { bookings, fetchBookings } = useBookingsStore();

  // Fetch projects, artists, staff users, and bookings when the window opens.
  useEffect(() => {
    if (isWindowOpen) {
      fetchActiveProjects().catch((err) => {
        console.error("Failed to fetch projects:", err);
      });
      fetchArtists().catch((err) => {
        console.error("Failed to fetch artists:", err);
      });
      fetchUsers().catch((err) => {
        console.error("Failed to fetch users:", err);
      });
      fetchBookings().catch((err) => {
        console.error("Failed to fetch bookings:", err);
      });
    }
  }, [isWindowOpen, fetchActiveProjects, fetchArtists, fetchUsers, fetchBookings]);

  // A logged offer's backing project sits on_hold. A pending offer lives in
  // the Inbox and a declined offer is dead, so neither should surface here —
  // hide any on_hold project whose booking is pending or declined. on_hold
  // projects with no such offer (e.g. a live project the team parked) still
  // show.
  const unacceptedOfferProjectIds = useMemo(
    () =>
      new Set(
        bookings
          .filter((b) => b.status === "pending" || b.status === "declined")
          .map((b) => b.project_id)
      ),
    [bookings]
  );
  const visibleProjects = useMemo(
    () =>
      activeProjects.filter(
        (p) => p.status === "active" || !unacceptedOfferProjectIds.has(p.id)
      ),
    [activeProjects, unacceptedOfferProjectIds]
  );

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // Default selection on desktop.
  useEffect(() => {
    if (!isMobile && visibleProjects.length > 0 && selectedProjectId === null) {
      setSelectedProjectId(visibleProjects[0].id);
    }
  }, [visibleProjects, selectedProjectId, isMobile]);

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
                  {isLoading && visibleProjects.length === 0 ? (
                    <EmptyState title="Loading projects..." className="py-6" />
                  ) : visibleProjects.length === 0 ? (
                    <EmptyState
                      title="No active projects"
                      hint="Approve offers from the Inbox to create projects."
                      className="py-6"
                    />
                  ) : (
                    visibleProjects.map((project) => {
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
              {visibleProjects.length === 0 ? (
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

        <HelpGuideDialog
          isOpen={isHelpDialogOpen}
          onOpenChange={setIsHelpDialogOpen}
          guideId="active-projects"
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
            visibleProjects.find((p) => p.id === pendingCompleteProjectId)?.name ||
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
  const { updateProject, updateStatus } = useProjectsStore();
  // Only (frontend-designated) admins can complete/archive a project.
  // See src/config/greenroomAdmins.ts — this gates the UI only; the Greenroom
  // API is anonymous and does not enforce it server-side.
  const isAdmin = useIsGreenroomAdmin();

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
  // Snapshot of the values last persisted to the backend. The debounced
  // auto-save compares against this so it only fires on genuine edits (and not,
  // e.g., when the form is reset on a project switch).
  const savedRef = useRef(form);

  // Reset the form only when switching to a *different* project. Keying on the
  // id (not the whole object) means an auto-save's own refresh won't clobber
  // fields the user is still editing.
  useEffect(() => {
    const next = projectToForm(project);
    setForm(next);
    savedRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Auto-save: there's no Save button — edits persist on their own a short
  // moment after the user stops changing fields.
  useEffect(() => {
    if (JSON.stringify(form) === JSON.stringify(savedRef.current)) return;
    const timer = setTimeout(async () => {
      const snapshot = form;
      setIsSaving(true);
      try {
        await updateProject(project.id, {
          name: snapshot.name,
          description: snapshot.description,
          project_type: snapshot.project_type || undefined,
          start_date: snapshot.start_date || undefined,
          end_date: snapshot.end_date || undefined,
          budget: snapshot.budget || undefined,
          event_date: snapshot.event_date || undefined,
          event_type: snapshot.event_type || undefined,
          venue_name: snapshot.venue_name || undefined,
          city: snapshot.city || undefined,
          country: snapshot.country || undefined,
          promoter_name: snapshot.promoter_name || undefined,
          gig_size_id: snapshot.gig_size_id ?? undefined,
          drive_parent_folder_id: snapshot.drive_parent_folder_id || undefined,
          feedback: snapshot.feedback || undefined,
        });
        savedRef.current = snapshot;
      } catch {
        // error surfaced via store toast; savedRef is left as-is so the next
        // edit retries the save.
      } finally {
        setIsSaving(false);
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // Edits not yet persisted — pending the debounce timer or a failed save.
  // Drives the Saved / Unsaved changes / Saving… indicator in the header.
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedRef.current);

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
          <TabsTrigger className={tabStyles.tabTriggerClasses} value="curation">
            Curation
          </TabsTrigger>
          <TabsTrigger className={tabStyles.tabTriggerClasses} value="lineup">
            Final Lineup ({project.lineup.length})
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
            <div className="space-y-4 p-4 pr-6 @container">
              {/* Actions sit beside the title on wide windows and wrap below
                  it on narrow ones/phones */}
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="flex-1 min-w-[14rem] space-y-1.5">
                  {/* Mirrors the Name field live so edits are reflected
                      immediately, not only after the auto-save round-trips. */}
                  <h1 className="text-2xl font-semibold break-words">
                    {form.name.trim() || project.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <StatusBadge
                      status={project.status}
                      label={formatProjectStatus(project.status)}
                    />
                    {/* Autosave state — there's no Save button, so keep the
                        current state visible at the top of the page. */}
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {isSaving ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Saving…</span>
                        </>
                      ) : isDirty ? (
                        <span>Unsaved changes</span>
                      ) : (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Saved</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex flex-row @lg:flex-col items-center @lg:items-end gap-2 shrink-0">
                  {isAdmin && (
                    <Button
                      variant="default"
                      onClick={() => onMarkComplete(project.id)}
                      className="min-h-[32px] touch-manipulation"
                    >
                      <span>Mark Complete</span>
                    </Button>
                  )}
                  <Select value={project.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      {/* Completing archives the project — admins only, matching
                          the Mark Complete button gate above. */}
                      {(isAdmin || project.status === "completed") && (
                        <SelectItem value="completed">Completed</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <SectionCard icon={FileText} title="Details">
                <Field label="Name">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    className="min-h-[100px]"
                  />
                </Field>
                {/* Fields flow into more columns as the card widens
                    (container query = card width, not viewport) so a wide
                    window fills instead of leaving a right-side gutter. */}
                <div className="grid grid-cols-1 @lg:grid-cols-3 gap-4">
                  <Field label="Project Type">
                    <Select
                      value={form.project_type || "unset"}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          project_type: v === "unset" ? "" : v,
                        })
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
                  </Field>
                  <Field label="Gig Size">
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
                  </Field>
                  <Field label="Budget">
                    <Input
                      value={form.budget}
                      onChange={(e) =>
                        setForm({ ...form, budget: e.target.value })
                      }
                      placeholder="e.g., 5000"
                      inputMode="decimal"
                    />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard icon={Calendar} title="Schedule">
                <div className="grid grid-cols-1 @lg:grid-cols-3 gap-4">
                  <Field label="Start Date">
                    <Input
                      type="date"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="End Date">
                    <Input
                      type="date"
                      value={form.end_date}
                      onChange={(e) =>
                        setForm({ ...form, end_date: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Event Date">
                    <Input
                      type="date"
                      value={form.event_date}
                      onChange={(e) =>
                        setForm({ ...form, event_date: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard icon={MapPin} title="Venue & Promoter">
                <div className="grid grid-cols-1 @lg:grid-cols-2 gap-4">
                  <Field label="Venue">
                    <Input
                      value={form.venue_name}
                      onChange={(e) =>
                        setForm({ ...form, venue_name: e.target.value })
                      }
                      placeholder="e.g., Electric Brixton"
                    />
                  </Field>
                  <Field label="City">
                    <Input
                      value={form.city}
                      onChange={(e) =>
                        setForm({ ...form, city: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Country">
                    <Input
                      value={form.country}
                      onChange={(e) =>
                        setForm({ ...form, country: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Promoter">
                    <Input
                      value={form.promoter_name}
                      onChange={(e) =>
                        setForm({ ...form, promoter_name: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard icon={FolderOpen} title="Files">
                <Field label="Google Drive Folder">
                  <div className="flex flex-col @md:flex-row gap-2">
                    <Input
                      value={form.drive_parent_folder_id}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          drive_parent_folder_id: extractDriveFolderId(
                            e.target.value
                          ),
                        })
                      }
                      placeholder="Paste a Google Drive folder link"
                      className="flex-1"
                    />
                    {form.drive_parent_folder_id && (
                      <Button
                        asChild
                        variant="secondary"
                        className="shrink-0 min-h-[32px] touch-manipulation"
                      >
                        <a
                          href={driveFolderUrl(form.drive_parent_folder_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="inline-flex items-center">
                            <ExternalLink className="h-4 w-4 mr-1.5" />
                            Open in Drive
                          </span>
                        </a>
                      </Button>
                    )}
                  </div>
                </Field>
              </SectionCard>

              {/* Team is short and Updates grows long — sit them side by side
                  once the pane is wide enough to spare the columns. */}
              <div className="grid grid-cols-1 @4xl:grid-cols-2 gap-4 items-start">
                <SectionCard icon={Users} title="Project Team">
                  <ProjectTeamCard project={project} />
                </SectionCard>
                <SectionCard icon={MessageSquare} title="Status Updates">
                  <ProjectUpdatesCard projectId={project.id} />
                </SectionCard>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Curation */}
        <TabsContent
          value="curation"
          className={cn(
            tabStyles.tabContentClasses,
            "flex-1 flex flex-col min-w-0 min-h-0"
          )}
        >
          <CurationTab projectId={project.id} />
        </TabsContent>

        {/* Final Lineup */}
        <TabsContent
          value="lineup"
          className={cn(
            tabStyles.tabContentClasses,
            "flex-1 flex flex-col min-w-0 min-h-0"
          )}
        >
          <FinalLineupTab project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Relative-ish timestamp for the update timeline: a short absolute date/time.
function formatUpdateTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Internal staff assigned to the project: a single Project Lead plus any number
// of team members. Backed by the project_team table (users), distinct from the
// artist Lineup. Changes persist immediately (no Save button) via the store.
function ProjectTeamCard({ project }: { project: ProjectDetail }) {
  const { addTeamMember, removeTeamMember } = useProjectsStore();
  const { users } = useUsersStore();
  const { isMacTheme } = useOsTheme();
  const [isBusy, setIsBusy] = useState(false);
  const [addValue, setAddValue] = useState("");

  const lead = project.team.find((m) => m.role === PROJECT_LEAD_ROLE) ?? null;
  const teamMembers = project.team.filter((m) => m.role !== PROJECT_LEAD_ROLE);

  const assignedIds = useMemo(
    () => new Set(project.team.map((m) => m.user_id)),
    [project.team]
  );
  // Users not yet on the team — candidates for the "add member" picker.
  const availableForTeam = users.filter((u) => !assignedIds.has(u.id));

  const memberLabel = (m: ProjectTeamMember) =>
    m.username ?? `User ${m.user_id}`;

  const handleSetLead = async (value: string) => {
    const newId = value === "none" ? null : Number(value);
    if (newId !== null && lead?.user_id === newId) return;
    setIsBusy(true);
    try {
      if (newId === null) {
        if (lead) await removeTeamMember(project.id, lead.user_id);
      } else {
        // Demote the current lead to a team member (keep them on the project),
        // then promote the chosen user. The backend upserts on (project, user),
        // so re-roling an existing team member into the lead just updates them.
        if (lead) await addTeamMember(project.id, lead.user_id, TEAM_MEMBER_ROLE);
        await addTeamMember(project.id, newId, PROJECT_LEAD_ROLE);
      }
    } catch {
      // error surfaced via store toast
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddMember = async (value: string) => {
    const userId = Number(value);
    setAddValue("");
    if (!userId) return;
    setIsBusy(true);
    try {
      await addTeamMember(project.id, userId, TEAM_MEMBER_ROLE);
    } catch {
      // error surfaced via store toast
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    setIsBusy(true);
    try {
      await removeTeamMember(project.id, userId);
    } catch {
      // error surfaced via store toast
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Project Lead — a single user */}
      <Field label="Project Lead">
        <Select
          value={lead ? String(lead.user_id) : "none"}
          onValueChange={handleSetLead}
          disabled={isBusy}
        >
          <SelectTrigger className="w-full @md:w-60">
            <SelectValue placeholder="No lead assigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No lead assigned</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>
                {u.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Team members — many users */}
      <Field label="Team Members">
        <div className="space-y-2">
          {teamMembers.length === 0 ? (
            <div className="text-sm text-muted-foreground py-1">
              No team members assigned yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 @lg:grid-cols-2 gap-2">
              {teamMembers.map((member) => (
                <div
                  key={member.user_id}
                  className={cn(
                    "flex items-center justify-between gap-2 p-2 rounded-md",
                    isMacTheme ? "aqua-well" : "border"
                  )}
                >
                  <span className="flex-1 min-w-0 text-sm font-medium truncate">
                    {memberLabel(member)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => handleRemoveMember(member.user_id)}
                    disabled={isBusy}
                    title="Remove from team"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Select
            value={addValue}
            onValueChange={handleAddMember}
            disabled={isBusy || availableForTeam.length === 0}
          >
            <SelectTrigger className="w-full @md:w-60">
              <SelectValue
                placeholder={
                  availableForTeam.length === 0
                    ? "All users assigned"
                    : "Add team member…"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableForTeam.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Field>
    </div>
  );
}

// A simple chronological log of free-text progress updates, shown at the bottom
// of the Overview tab. Anyone can post; the author is the effective Greenroom
// account (the API has no auth, so we send user_id in the body).
function ProjectUpdatesCard({ projectId }: { projectId: number }) {
  const { fetchUpdates, postUpdate } = useProjectsStore();
  const { userId } = useEffectiveGreenroomAccount();
  const { isMacTheme } = useOsTheme();
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchUpdates(projectId)
      .then((rows) => {
        if (!cancelled) setUpdates(rows);
      })
      .catch(() => {
        // error surfaced via store toast
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, fetchUpdates]);

  const handlePost = async () => {
    const body = draft.trim();
    if (!body || isPosting) return;
    setIsPosting(true);
    try {
      const created = await postUpdate(projectId, body, userId);
      // POST returns the created row (newest first), so prepend it.
      setUpdates((prev) => [created, ...prev]);
      setDraft("");
    } catch {
      // error surfaced via store toast
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Post a quick status update…"
          className="min-h-[72px]"
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter posts, matching common comment-box behaviour.
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handlePost();
            }
          }}
        />
        <div className="flex items-center justify-end gap-3">
          <span className="hidden @md:inline text-[11px] text-muted-foreground">
            Ctrl/⌘ + Enter to post
          </span>
          <Button
            variant="default"
            size="sm"
            onClick={handlePost}
            disabled={!draft.trim() || isPosting}
            className="min-h-[32px] touch-manipulation"
          >
            <span>{isPosting ? "Posting…" : "Post Update"}</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground py-2">
          Loading updates…
        </div>
      ) : updates.length === 0 ? (
        <EmptyState
          title="No status updates yet"
          hint="Post the first one above."
          className="py-6"
        />
      ) : (
        <div className="space-y-2">
          {/* Inset wells (not raised cards) so the timeline reads as content
              inside the Status Updates panel rather than nested cards. */}
          {updates.map((update) => (
            <div
              key={update.id}
              className={cn(
                "p-3 rounded-lg",
                isMacTheme ? "aqua-well" : "bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium">
                  {update.username ?? "Unknown"}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatUpdateTime(update.created_at)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">
                {update.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Suggestion links are stored as typed; add a scheme when it's missing so the
// anchor doesn't resolve relative to the app.
function externalUrl(link: string): string {
  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

// Curation: a longlist of artist names for the project. Anyone can type a name
// (with an optional link to their work) to add it, thumbs up/down any name, or
// remove one. Names are free text — not artists-table rows — and votes are one
// per user per name (pressing the same thumb again clears it).
function CurationTab({ projectId }: { projectId: number }) {
  const { fetchSuggestions, addSuggestion, voteSuggestion, deleteSuggestion } =
    useProjectsStore();
  const { userId } = useEffectiveGreenroomAccount();
  const { isMacTheme } = useOsTheme();
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState("");
  const [linkDraft, setLinkDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectSuggestion | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchSuggestions(projectId)
      .then((rows) => {
        if (!cancelled) setSuggestions(rows);
      })
      .catch(() => {
        // error surfaced via store toast
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, fetchSuggestions]);

  const handleAdd = async () => {
    const name = nameDraft.trim();
    if (!name || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const created = await addSuggestion(
        projectId,
        { artist_name: name, link: linkDraft.trim() || undefined },
        userId
      );
      setSuggestions((prev) => [...prev, created]);
      setNameDraft("");
      setLinkDraft("");
      toast.success("Added to the longlist");
    } catch {
      // error surfaced via store toast (e.g. name already suggested)
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (
    suggestion: ProjectSuggestion,
    value: 1 | -1
  ) => {
    if (userId == null) {
      toast.error("Link your Greenroom account to vote");
      return;
    }
    const current =
      suggestion.votes.find((v) => v.user_id === userId)?.vote_value ?? 0;
    // Pressing the thumb you already cast clears the vote.
    const next = current === value ? 0 : value;
    try {
      const updated = await voteSuggestion(
        projectId,
        suggestion.id,
        userId,
        next
      );
      // Replace in place — the list only re-ranks on the next load so rows
      // don't jump around under the cursor mid-voting.
      setSuggestions((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
    } catch {
      // error surfaced via store toast
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    try {
      await deleteSuggestion(projectId, pendingDelete.id);
      setSuggestions((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      toast.success("Removed from the longlist");
    } catch {
      // error surfaced via store toast
    }
    setPendingDelete(null);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 p-4 pr-6 @container">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">
                Curation{suggestions.length > 0 ? ` (${suggestions.length})` : ""}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              A longlist of artists for this project. Add a name, vote names up
              or down — the list ranks by votes.
            </p>
          </div>

          <div className="flex flex-col @md:flex-row gap-2">
            <Input
              placeholder="Artist name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="flex-1"
            />
            <Input
              placeholder="Link to their work (optional)"
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="flex-1"
            />
            <Button
              variant="default"
              onClick={handleAdd}
              disabled={!nameDraft.trim() || isSubmitting}
              className="shrink-0 min-h-[32px] touch-manipulation"
            >
              <span className="inline-flex items-center">
                <Plus className="h-4 w-4 mr-1" />
                {isSubmitting ? "Adding…" : "Add"}
              </span>
            </Button>
          </div>

          {isLoading ? (
            <div className="text-xs text-muted-foreground py-2">
              Loading longlist…
            </div>
          ) : suggestions.length === 0 ? (
            <EmptyState
              title="No names on the longlist yet"
              hint="Add the first artist above."
              className="py-6"
            />
          ) : (
            <div className="space-y-2">
              {suggestions.map((suggestion) => {
                const myVote =
                  userId != null
                    ? suggestion.votes.find((v) => v.user_id === userId)
                        ?.vote_value ?? 0
                    : 0;
                return (
                  <div
                    key={suggestion.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md",
                      isMacTheme ? "aqua-well" : "border"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-sm truncate">
                          {suggestion.artist_name}
                        </span>
                        {suggestion.link && (
                          <a
                            href={externalUrl(suggestion.link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={suggestion.link}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {suggestion.curated_by_username
                          ? `Suggested by ${suggestion.curated_by_username}`
                          : "Suggested"}
                      </div>
                    </div>
                    <Button
                      variant={myVote === 1 ? "secondary" : "ghost"}
                      size="sm"
                      className="h-8 px-2 shrink-0 touch-manipulation"
                      onClick={() => handleVote(suggestion, 1)}
                      title={myVote === 1 ? "Clear your vote" : "Thumbs up"}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      <span className="ml-1 text-xs tabular-nums">
                        {suggestion.up_votes}
                      </span>
                    </Button>
                    <Button
                      variant={myVote === -1 ? "secondary" : "ghost"}
                      size="sm"
                      className="h-8 px-2 shrink-0 touch-manipulation"
                      onClick={() => handleVote(suggestion, -1)}
                      title={myVote === -1 ? "Clear your vote" : "Thumbs down"}
                    >
                      <ThumbsDown className="h-4 w-4" />
                      <span className="ml-1 text-xs tabular-nums">
                        {suggestion.down_votes}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={() => setPendingDelete(suggestion)}
                      title="Remove from longlist"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Remove Suggestion"
        description={`Remove "${pendingDelete?.artist_name ?? ""}" from the longlist? Its votes are removed too.`}
      />
    </div>
  );
}

// Compact fact row for an artist: each datapoint prefixed with a small icon
// (mic = type of act, note = genres, pin = city) instead of plain-text
// separators, so rows scan at a glance.
function ArtistFacts({ artist }: { artist: ArtistListItem }) {
  const facts: { icon: LucideIcon; text: string; title?: string }[] = [];
  if (artist.type_of_act) {
    facts.push({ icon: Mic, text: artist.type_of_act });
  }
  if (artist.genres.length > 0) {
    const shown = artist.genres.slice(0, 3).join(", ");
    facts.push({
      icon: Music,
      text:
        artist.genres.length > 3
          ? `${shown} +${artist.genres.length - 3}`
          : shown,
      title: artist.genres.join(", "),
    });
  }
  if (artist.locations.length > 0) {
    facts.push({
      icon: MapPin,
      text: artist.locations[0].city,
      title: artist.locations
        .map((l) => `${l.city} (${l.country})`)
        .join(", "),
    });
  }
  if (facts.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground min-w-0">
      {facts.map(({ icon: Icon, text, title }, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 min-w-0"
          title={title ?? text}
        >
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{text}</span>
        </span>
      ))}
    </div>
  );
}

// Final Lineup: the confirmed artists on the bill (project_lineup rows — real
// artists-table references, unlike the Curation longlist's free-text names).
// Search the artist database to add, or create a new artist via the quick-add
// dialog (which also drops them straight into the lineup). Changes persist
// immediately via the store; removal is one click to restore, so no confirm.
function FinalLineupTab({ project }: { project: ProjectDetail }) {
  const { addToLineup, removeFromLineup } = useProjectsStore();
  const {
    artists,
    fetchArtists,
    createArtist,
    isLoading: isLoadingArtists,
  } = useArtistsStore();
  const { userId } = useEffectiveGreenroomAccount();
  const { isMacTheme } = useOsTheme();

  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    fetchArtists().catch(() => {
      // error surfaced via store state
    });
  }, [fetchArtists]);

  const lineup = project.lineup;
  const lineupArtistIds = useMemo(
    () => new Set(lineup.map((e) => e.artist_id)),
    [lineup]
  );
  const artistById = useMemo(
    () => new Map(artists.map((a) => [a.id, a])),
    [artists]
  );

  // Live client-side filter over the whole roster (a few hundred rows, so no
  // debounce/server round-trip needed). Matches names and genres; an empty
  // query shows the entire database so it's browsable without searching.
  const query = search.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query) return artists;
    return artists.filter(
      (a) =>
        a.artist_name.toLowerCase().includes(query) ||
        (a.preferred_name ?? "").toLowerCase().includes(query) ||
        a.genres.some((g) => g.toLowerCase().includes(query))
    );
  }, [artists, query]);

  // Both actions apply optimistically in the store (and roll back on error),
  // so there is no per-row spinner or button lockout — rows move between the
  // lists instantly and several adds can be fired in quick succession. Errors
  // surface via the store's app-level toast.
  const handleAdd = (artistId: number, artistName: string) => {
    addToLineup(project.id, artistId, artistName, userId).catch(() => {});
  };

  const handleRemove = (entry: ProjectLineupEntry) => {
    removeFromLineup(project.id, entry.artist_id).catch(() => {});
  };

  const rowClasses = cn(
    "flex items-center gap-2 p-2 rounded-md",
    isMacTheme ? "aqua-well" : "border"
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 p-4 pr-6 @container">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">
                Final Lineup{lineup.length > 0 ? ` (${lineup.length})` : ""}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              The confirmed artists on the bill. Add them from the artist
              database below — or create a new artist if they're not in it yet.
            </p>
          </div>

          {/* Confirmed lineup — rows animate in/out as artists are added and
              removed (optimistic store updates make this effectively instant) */}
          {lineup.length === 0 ? (
            <EmptyState
              title="No artists on the lineup yet"
              hint="Add artists from the database below, or create a new one."
              className="py-6"
            />
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {lineup.map((entry) => {
                  const artist = artistById.get(entry.artist_id);
                  return (
                    <motion.div
                      key={entry.artist_id}
                      layout
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className={cn(rowClasses, "overflow-hidden")}
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="font-medium text-sm truncate">
                          {entry.artist_name}
                        </div>
                        {artist && <ArtistFacts artist={artist} />}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(entry)}
                        title="Remove from lineup"
                        className="h-8 w-8 p-0 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {/* Artist database: always browsable; the search box filters it */}
          <div className="space-y-1 pt-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">
                Artist Database
                {artists.length > 0 ? ` (${artists.length})` : ""}
              </h3>
            </div>
          </div>

          <div className="flex flex-col @md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Filter by name or genre…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(true)}
              className="shrink-0 min-h-[32px] touch-manipulation"
            >
              <span className="inline-flex items-center">
                <Plus className="h-4 w-4 mr-1" />
                New Artist
              </span>
            </Button>
          </div>

          {isLoadingArtists && artists.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">
              Loading artist database…
            </div>
          ) : results.length === 0 ? (
            query ? (
              <div
                className={cn(
                  "flex items-center justify-between gap-2 p-3 rounded-md",
                  isMacTheme ? "aqua-well" : "border"
                )}
              >
                <span className="text-sm text-muted-foreground">
                  No artists match "{search.trim()}"
                </span>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsAddDialogOpen(true)}
                  className="shrink-0 touch-manipulation"
                >
                  <span className="inline-flex items-center">
                    <Plus className="h-4 w-4 mr-1" />
                    Create "{search.trim()}"
                  </span>
                </Button>
              </div>
            ) : (
              <EmptyState title="No artists in the database yet" className="py-6" />
            )
          ) : (
            <div className="space-y-2">
              {query && (
                <div className="text-xs text-muted-foreground">
                  {results.length} match{results.length === 1 ? "" : "es"}
                </div>
              )}
              {results.map((artist) => {
                const inLineup = lineupArtistIds.has(artist.id);
                return (
                  <div key={artist.id} className={rowClasses}>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="font-medium text-sm truncate">
                        {artist.artist_name}
                        {artist.preferred_name && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            ({artist.preferred_name})
                          </span>
                        )}
                      </div>
                      <ArtistFacts artist={artist} />
                    </div>
                    {inLineup ? (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.15 }}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0 pr-1"
                      >
                        <Check className="h-3.5 w-3.5" />
                        In lineup
                      </motion.span>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleAdd(artist.id, artist.artist_name)}
                        className="shrink-0 touch-manipulation"
                      >
                        <span className="inline-flex items-center">
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </span>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      <QuickAddArtistDialog
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        initialName={search.trim()}
        onCreate={async (payload) => {
          const newId = await createArtist(payload);
          await addToLineup(project.id, newId, payload.artist_name, userId);
          setSearch("");
          toast.success(`${payload.artist_name} created and added to the lineup`);
        }}
      />
    </div>
  );
}

// Grouped fieldset for the quick-add form: an inset Aqua well on the macosx
// theme (bordered panel elsewhere) with a small icon + title header, matching
// the SectionCard language used across the app.
function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  const { isMacTheme } = useOsTheme();
  return (
    <div
      className={cn(
        "p-3 rounded-md space-y-3",
        isMacTheme ? "aqua-well" : "border"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

// Quick-add form: the minimum needed to identify an artist mid-lineup-building.
// The full profile (pronouns, heritage, remaining socials…) can be completed
// later. Genres/locations are free text — the backend get-or-creates them
// case-insensitively, so existing entries are reused rather than duplicated.
function QuickAddArtistDialog({
  isOpen,
  onOpenChange,
  initialName,
  onCreate,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onCreate: (payload: {
    artist_name: string;
    type_of_act?: string;
    primary_email?: string;
    instagram?: string;
    genres?: string[];
    locations?: { city: string; country: string }[];
  }) => Promise<void>;
}) {
  const emptyForm = {
    artist_name: "",
    type_of_act: "",
    genres: "",
    city: "",
    country: "UK",
    primary_email: "",
    instagram: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Seed the name from the lineup search box each time the dialog opens, so
  // "no match → Create" carries the typed name over.
  useEffect(() => {
    if (isOpen) {
      setForm({ ...emptyForm, artist_name: initialName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const canSubmit = form.artist_name.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const genres = form.genres
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);
      const city = form.city.trim();
      await onCreate({
        artist_name: form.artist_name.trim(),
        type_of_act: form.type_of_act.trim() || undefined,
        primary_email: form.primary_email.trim() || undefined,
        instagram: form.instagram.trim() || undefined,
        genres: genres.length > 0 ? genres : undefined,
        locations: city
          ? [{ city, country: form.country.trim() || "UK" }]
          : undefined,
      });
      onOpenChange(false);
    } catch {
      // error surfaced via store toast; keep the dialog open to retry
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="New Artist"
      description="Add an artist to the database and this project's lineup. Only the name is required — the full profile can be completed later."
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button variant="default" onClick={handleSubmit} disabled={!canSubmit}>
            <span className="inline-flex items-center">
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              {isSubmitting ? "Creating…" : "Create & Add to Lineup"}
            </span>
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormSection icon={Mic} title="Artist">
          <Field label="Artist name" required>
            <Input
              value={form.artist_name}
              onChange={(e) =>
                setForm({ ...form, artist_name: e.target.value })
              }
              placeholder="Stage name"
              autoFocus
            />
          </Field>
          <Field label="Type of act">
            <Input
              value={form.type_of_act}
              onChange={(e) =>
                setForm({ ...form, type_of_act: e.target.value })
              }
              placeholder="DJ, Live Act…"
            />
          </Field>
          <Field label="Genres">
            <Input
              value={form.genres}
              onChange={(e) => setForm({ ...form, genres: e.target.value })}
              placeholder="Techno, House — comma-separated"
            />
          </Field>
        </FormSection>
        <FormSection icon={MapPin} title="Location">
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="London"
              />
            </Field>
            <Field label="Country">
              <Input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </Field>
          </div>
        </FormSection>
        <FormSection icon={Mail} title="Contact">
          <Field label="Email">
            <Input
              type="email"
              value={form.primary_email}
              onChange={(e) =>
                setForm({ ...form, primary_email: e.target.value })
              }
              placeholder="artist@example.com"
            />
          </Field>
          <Field label="Instagram">
            <Input
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
              placeholder="@handle or URL"
            />
          </Field>
        </FormSection>
      </div>
    </FormDialog>
  );
}
