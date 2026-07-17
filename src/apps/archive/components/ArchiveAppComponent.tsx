import { useState, useEffect, useMemo, type ReactNode } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { ArchiveMenuBar } from "./ArchiveMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { helpItems, appMetadata } from "../index.tsx";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { usePaymentsStore } from "@/stores/usePaymentsStore";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
} from "../data";
import {
  formatProjectStatus,
  formatBudget,
  toDateInputValue,
  PROJECT_LEAD_ROLE,
} from "../../active-projects/data";
import type {
  ProjectDetail,
  ProjectListItem,
  ProjectUpdate,
} from "@/lib/api/projects";
import type { Payment, PaymentStatus } from "@/lib/api/payments";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AquaCard,
  EmptyState,
  SidebarRow,
  StatusBadge,
  useOsTheme,
} from "@/components/greenroom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getTabStyles } from "@/utils/tabStyles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Users,
  Calendar,
  DollarSign,
  FileText,
  FolderOpen,
  MapPin,
  MessageSquare,
  ListChecks,
  User,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Greenroom stores a bare Google Drive folder ID; build the folder URL from it.
function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

// Short absolute date/time for the read-only status timeline (mirrors the
// live Overview page's formatter).
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

// Titled section panel — the read-only twin of Active Projects' Overview
// SectionCard. A glossy Aqua card (plain shadcn Card elsewhere) with an
// icon + heading row; declares itself a container so inner grids respond to
// the card's own width rather than the viewport.
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

// A solidified, unchangeable field: the same label the Overview form uses,
// but the value is rendered as a locked well instead of an editable control.
function ReadOnlyField({
  label,
  value,
  multiline,
  className,
}: {
  label: string;
  value: ReactNode;
  multiline?: boolean;
  className?: string;
}) {
  const { isMacTheme } = useOsTheme();
  const isEmpty =
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "");
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-sm">{label}</Label>
      <div
        className={cn(
          "text-sm px-3 py-2 rounded-md break-words",
          multiline ? "min-h-[64px] whitespace-pre-wrap" : "min-h-[36px] flex items-center",
          isMacTheme ? "aqua-well" : "bg-muted/40 border"
        )}
      >
        {isEmpty ? (
          <span className="text-muted-foreground">Not set</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

export function ArchiveAppComponent({
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
  // Viewport-width based (not touch): a touch-enabled desktop keeps the
  // two-pane master-detail layout instead of collapsing to a single pane.
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );

  const { themeId, isMacTheme, isXpTheme } = useOsTheme();
  const tabStyles = getTabStyles(themeId);

  const {
    archivedProjects,
    isLoadingArchived,
    error,
    fetchArchivedProjects,
    projectDetails,
    refreshProject,
    clearError,
  } = useProjectsStore();

  useEffect(() => {
    if (isWindowOpen) {
      fetchArchivedProjects().catch((err) => {
        console.error("Failed to fetch archived projects:", err);
      });
    }
  }, [isWindowOpen, fetchArchivedProjects]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  useEffect(() => {
    if (
      !isMobile &&
      archivedProjects.length > 0 &&
      selectedProjectId === null
    ) {
      setSelectedProjectId(archivedProjects[0].id);
    }
  }, [archivedProjects, selectedProjectId, isMobile]);

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
    <ArchiveMenuBar
      onClose={onClose}
      onShowHelp={() => setIsHelpDialogOpen(true)}
      onShowAbout={() => setIsAboutDialogOpen(true)}
    />
  );

  if (!isWindowOpen) return null;

  return (
    <>
      {!isXpTheme && isForeground && menuBar}
      <WindowFrame
        title="Archive"
        onClose={onClose}
        isForeground={isForeground}
        appId="archive"
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
              <h2 className="text-lg font-semibold mb-3">Archived Projects</h2>
              {/* Radix wraps content in a display:table div that grows to the
                  content's intrinsic width; force block so rows can't exceed
                  the fixed sidebar width. */}
              <ScrollArea className="flex-1 min-h-0 [&_[data-radix-scroll-area-viewport]>div]:block!">
                <div className="space-y-2">
                  {isLoadingArchived && archivedProjects.length === 0 ? (
                    <EmptyState title="Loading..." className="py-6" />
                  ) : archivedProjects.length === 0 ? (
                    <EmptyState
                      title="No archived projects yet"
                      hint="Complete projects from Active Projects to archive them."
                      className="py-6"
                    />
                  ) : (
                    archivedProjects.map((project: ProjectListItem) => {
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
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {(project.end_date || project.start_date || "").slice(0, 10) ||
                                  "No date"}
                              </span>
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
              {archivedProjects.length === 0 ? (
                <EmptyState title="No archived projects yet" className="flex-1" />
              ) : selectedProject ? (
                <ProjectDetailView
                  project={selectedProject}
                  tabStyles={tabStyles}
                  isMobile={isMobile}
                  onBack={() => setSelectedProjectId(null)}
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
          appId="archive"
        />
        <AboutDialog
          isOpen={isAboutDialogOpen}
          onOpenChange={setIsAboutDialogOpen}
          metadata={appMetadata}
          appId="archive"
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
}: {
  project: ProjectDetail;
  tabStyles: ReturnType<typeof getTabStyles>;
  isMobile: boolean;
  onBack: () => void;
}) {
  const { fetchWrapup, saveWrapup, archiveProject, fetchArchivedProjects } =
    useProjectsStore();
  const { paymentsByProject, fetchPaymentsForProject, updatePayment } =
    usePaymentsStore();

  const [summary, setSummary] = useState("");
  const [lessons, setLessons] = useState("");
  const [hasExistingWrapup, setHasExistingWrapup] = useState(false);
  const [isSavingWrapup, setIsSavingWrapup] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Completed and cancelled projects can be formally filed via the backend's
  // archive endpoint, which sets status "archived" and records history.
  const canArchive =
    project.status === "completed" || project.status === "cancelled";

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await archiveProject(project.id);
      await fetchArchivedProjects();
      toast.success("Project filed to archive");
    } catch {
      // store records error
    } finally {
      setIsArchiving(false);
    }
  };

  const payments = paymentsByProject[project.id] ?? [];

  // Load wrap-up and payments when the project changes.
  useEffect(() => {
    let cancelled = false;
    fetchWrapup(project.id)
      .then((wrapup) => {
        if (cancelled) return;
        setSummary(wrapup?.summary ?? "");
        setLessons(wrapup?.lessons_learned ?? "");
        setHasExistingWrapup(wrapup !== null);
      })
      .catch(() => {
        // store records error
      });
    fetchPaymentsForProject(project.id).catch(() => {
      // store records error
    });
    return () => {
      cancelled = true;
    };
  }, [project.id, fetchWrapup, fetchPaymentsForProject]);

  const handleSaveWrapup = async () => {
    setIsSavingWrapup(true);
    try {
      await saveWrapup(
        project.id,
        { summary, lessons_learned: lessons },
        hasExistingWrapup
      );
      setHasExistingWrapup(true);
      toast.success("Wrap-up saved");
    } catch {
      // store records error
    } finally {
      setIsSavingWrapup(false);
    }
  };

  const handlePaymentStatusChange = async (
    payment: Payment,
    status: PaymentStatus
  ) => {
    try {
      await updatePayment(payment.id, project.id, { status });
      toast.success("Payment status updated");
    } catch {
      // store records error
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
      <Tabs defaultValue="summary" className="flex-1 flex flex-col min-w-0 min-h-0">
        <TabsList className={tabStyles.tabListClasses}>
          <TabsTrigger className={tabStyles.tabTriggerClasses} value="summary">
            Summary
          </TabsTrigger>
          <TabsTrigger className={tabStyles.tabTriggerClasses} value="payments">
            Payments ({payments.length})
          </TabsTrigger>
          <TabsTrigger className={tabStyles.tabTriggerClasses} value="feedback">
            Wrap-up
          </TabsTrigger>
        </TabsList>

        {/* Summary — a solidified, read-only twin of the Active Projects
            Overview page: the same field cards, but the values are locked
            (the project is archived), followed by the printed Final Lineup. */}
        <TabsContent
          value="summary"
          className={cn(
            tabStyles.tabContentClasses,
            "flex-1 flex flex-col min-w-0 min-h-0"
          )}
        >
          <ScrollArea className="flex-1">
            <ProjectSummary
              project={project}
              canArchive={canArchive}
              isArchiving={isArchiving}
              onArchive={handleArchive}
            />
          </ScrollArea>
        </TabsContent>

        {/* Payments */}
        <TabsContent
          value="payments"
          className={cn(
            tabStyles.tabContentClasses,
            "flex-1 flex flex-col min-w-0 min-h-0"
          )}
        >
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4 pr-6">
              <div className="flex items-center gap-2 flex-wrap">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Payments</h3>
              </div>
              {payments.length === 0 ? (
                <EmptyState
                  icon={DollarSign}
                  title="No payments recorded for this project"
                  className="py-8"
                />
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <AquaCard key={payment.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-sm">
                              {payment.artist_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {payment.invoice_number
                                ? `Invoice ${payment.invoice_number}`
                                : "No invoice number"}
                            </div>
                          </div>
                          <div className="text-sm font-semibold shrink-0">
                            {payment.currency} {payment.amount}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                          <Select
                            value={payment.status}
                            onValueChange={(value: PaymentStatus) =>
                              handlePaymentStatusChange(payment, value)
                            }
                          >
                            <SelectTrigger className="flex-1 min-w-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {PAYMENT_STATUS_LABELS[status]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {payment.due_date && (
                            <span className="text-xs text-muted-foreground">
                              Due: {payment.due_date}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </AquaCard>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Wrap-up / Feedback */}
        <TabsContent
          value="feedback"
          className={cn(
            tabStyles.tabContentClasses,
            "flex-1 flex flex-col min-w-0 min-h-0"
          )}
        >
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4 pr-6 @container">
              <h2 className="text-lg font-semibold">Wrap-up</h2>
              {/* Side-by-side on wide panes so both areas fill the width while
                  each stays a readable line length; stacked when narrow. */}
              <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Summary</Label>
                  <Textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Overall summary of how the project went..."
                    className="min-h-[140px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Lessons Learned</Label>
                  <Textarea
                    value={lessons}
                    onChange={(e) => setLessons(e.target.value)}
                    placeholder="What did we learn? What would we do differently?"
                    className="min-h-[140px]"
                  />
                </div>
              </div>
              <Button
                variant="default"
                onClick={handleSaveWrapup}
                disabled={isSavingWrapup || (!summary.trim() && !lessons.trim())}
                className="min-h-[36px] touch-manipulation"
              >
                <span>
                  {isSavingWrapup
                    ? "Saving..."
                    : hasExistingWrapup
                    ? "Update Wrap-up"
                    : "Save Wrap-up"}
                </span>
              </Button>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// The solidified Overview: read-only field cards mirroring the Active Projects
// Overview page, then the printed Final Lineup. Nothing here is editable — an
// archived project is a fixed record.
function ProjectSummary({
  project,
  canArchive,
  isArchiving,
  onArchive,
}: {
  project: ProjectDetail;
  canArchive: boolean;
  isArchiving: boolean;
  onArchive: () => void;
}) {
  const { isMacTheme } = useOsTheme();

  const gigSize = project.gig_size_code ?? "";

  const lead =
    project.team.find((m) => m.role === PROJECT_LEAD_ROLE) ?? null;
  const teamMembers = project.team.filter((m) => m.role !== PROJECT_LEAD_ROLE);

  return (
    <div className="space-y-4 p-4 pr-6 @container">
      {/* Actions sit beside the title on wide windows and wrap below it on
          narrow ones/phones */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex-1 min-w-[14rem] space-y-1.5">
          <h1 className="text-2xl font-semibold break-words">{project.name}</h1>
          <StatusBadge
            status={project.status}
            label={formatProjectStatus(project.status)}
          />
        </div>
        {canArchive && (
          <div className="flex flex-row @lg:flex-col items-center @lg:items-end gap-2 shrink-0">
            <Button
              size="sm"
              variant={isMacTheme ? "secondary" : "outline"}
              onClick={onArchive}
              disabled={isArchiving}
              className="min-h-[32px] touch-manipulation"
            >
              <span>{isArchiving ? "Archiving..." : "File to Archive"}</span>
            </Button>
          </div>
        )}
      </div>

      <SectionCard icon={FileText} title="Details">
        <ReadOnlyField label="Name" value={project.name} />
        <ReadOnlyField
          label="Description"
          value={project.description}
          multiline
        />
        <div className="grid grid-cols-1 @lg:grid-cols-3 gap-4">
          <ReadOnlyField label="Project Type" value={project.project_type} />
          <ReadOnlyField label="Gig Size" value={gigSize} />
          <ReadOnlyField label="Budget" value={formatBudget(project.budget)} />
        </div>
      </SectionCard>

      <SectionCard icon={Calendar} title="Schedule">
        <div className="grid grid-cols-1 @lg:grid-cols-3 gap-4">
          <ReadOnlyField
            label="Start Date"
            value={toDateInputValue(project.start_date)}
          />
          <ReadOnlyField
            label="End Date"
            value={toDateInputValue(project.end_date)}
          />
          <ReadOnlyField
            label="Event Date"
            value={toDateInputValue(project.event_date)}
          />
        </div>
      </SectionCard>

      <SectionCard icon={MapPin} title="Venue & Promoter">
        <div className="grid grid-cols-1 @lg:grid-cols-2 gap-4">
          <ReadOnlyField label="Venue" value={project.venue_name} />
          <ReadOnlyField label="City" value={project.city} />
          <ReadOnlyField label="Country" value={project.country} />
          <ReadOnlyField label="Promoter" value={project.promoter_name} />
        </div>
      </SectionCard>

      {project.drive_parent_folder_id && (
        <SectionCard icon={FolderOpen} title="Files">
          <div className="flex flex-col @md:flex-row @md:items-center gap-2">
            <div
              className={cn(
                "flex-1 text-sm px-3 py-2 rounded-md min-h-[36px] flex items-center break-all",
                isMacTheme ? "aqua-well" : "bg-muted/40 border"
              )}
            >
              {project.drive_parent_folder_id}
            </div>
            <Button
              asChild
              variant="secondary"
              className="shrink-0 min-h-[32px] touch-manipulation"
            >
              <a
                href={driveFolderUrl(project.drive_parent_folder_id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="inline-flex items-center">
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Open in Drive
                </span>
              </a>
            </Button>
          </div>
        </SectionCard>
      )}

      {/* Team is short and Updates grow long — sit them side by side once the
          pane is wide enough to spare the columns. Both are read-only here. */}
      <div className="grid grid-cols-1 @4xl:grid-cols-2 gap-4 items-start">
        <SectionCard icon={Users} title="Project Team">
          <ReadOnlyField
            label="Project Lead"
            value={lead?.username ?? (lead ? `User ${lead.user_id}` : "")}
          />
          <div className="space-y-1">
            <Label className="text-sm">Team Members</Label>
            {teamMembers.length === 0 ? (
              <div className="text-sm text-muted-foreground py-1">
                No team members were assigned.
              </div>
            ) : (
              <div className="grid grid-cols-1 @lg:grid-cols-2 gap-2">
                {teamMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md text-sm font-medium",
                      isMacTheme ? "aqua-well" : "border"
                    )}
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {member.username ?? `User ${member.user_id}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
        <SectionCard icon={MessageSquare} title="Status Updates">
          <ArchivedUpdates projectId={project.id} />
        </SectionCard>
      </div>

      {project.feedback && (
        <SectionCard icon={MessageSquare} title="Feedback">
          <p className="text-sm whitespace-pre-wrap break-words">
            {project.feedback}
          </p>
        </SectionCard>
      )}

      {/* Printed Final Lineup — a fixed, presentation-style rendering of the
          confirmed bill (the running order the project shipped with). */}
      <PrintedLineup project={project} />
    </div>
  );
}

// Read-only status timeline for an archived project: the same updates as the
// live Overview page, minus the posting box (nothing new gets posted to a
// filed project).
function ArchivedUpdates({ projectId }: { projectId: number }) {
  const { fetchUpdates } = useProjectsStore();
  const { isMacTheme } = useOsTheme();
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchUpdates(projectId)
      .then((rows) => {
        if (!cancelled) setUpdates(rows);
      })
      .catch(() => {
        // store records error
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, fetchUpdates]);

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground py-2">Loading updates…</div>
    );
  }
  if (updates.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-1">
        No status updates were posted.
      </div>
    );
  }
  return (
    <div className="space-y-2">
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
  );
}

// The printed Final Lineup: the confirmed bill as a fixed document. Prefers
// project.lineup (the real project_lineup rows the Active Projects app now
// manages); falls back to the legacy `members` list for projects archived
// before the lineup feature existed.
function PrintedLineup({ project }: { project: ProjectDetail }) {
  const entries = useMemo(() => {
    if (project.lineup.length > 0) {
      return [...project.lineup]
        .sort((a, b) => {
          const ao = a.display_order ?? Number.MAX_SAFE_INTEGER;
          const bo = b.display_order ?? Number.MAX_SAFE_INTEGER;
          return ao - bo;
        })
        .map((e) => ({ key: `l-${e.artist_id}`, name: e.artist_name, role: "" }));
    }
    return project.members.map((m) => ({
      key: `m-${m.artist_id}`,
      name: m.artist_name,
      role: m.role_in_project,
    }));
  }, [project.lineup, project.members]);

  const eventDate = toDateInputValue(project.event_date);
  const venueLine =
    [project.venue_name, project.city, project.country]
      .filter(Boolean)
      .join(", ") || "";
  const subheading = [eventDate, venueLine].filter(Boolean).join("  ·  ");

  return (
    <AquaCard>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-semibold">Final Lineup</h3>
        </div>

        {entries.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No artists were on the final lineup."
            className="py-6"
          />
        ) : (
          // A document-style bill: centred header, then the numbered running
          // order in the confirmed sequence.
          <div className="mx-auto max-w-xl">
            <div className="text-center space-y-1 pb-4 mb-4 border-b">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Final Lineup
              </div>
              <div className="text-lg font-semibold break-words">
                {project.name}
              </div>
              {subheading && (
                <div className="text-sm text-muted-foreground">{subheading}</div>
              )}
            </div>
            <ol className="space-y-2.5">
              {entries.map((entry, i) => (
                <li
                  key={entry.key}
                  className="flex items-baseline gap-3 leading-snug"
                >
                  <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {i + 1}.
                  </span>
                  <span className="min-w-0">
                    <span className="text-base font-medium break-words">
                      {entry.name}
                    </span>
                    {entry.role && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        — {entry.role}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </AquaCard>
  );
}
