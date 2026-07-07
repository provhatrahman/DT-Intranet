import { useState, useEffect } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { ArchiveMenuBar } from "./ArchiveMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { helpItems, appMetadata } from "../index.tsx";
import { DevDataBanner, DevDataChip } from "@/components/shared/DevDataBanner";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { usePaymentsStore } from "@/stores/usePaymentsStore";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
} from "../data";
import { formatProjectStatus, formatBudget } from "../../active-projects/data";
import type { ProjectDetail, ProjectListItem } from "@/lib/api/projects";
import type { Payment, PaymentStatus } from "@/lib/api/payments";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AquaCard,
  EmptyState,
  InfoTile,
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
import { useIsMobile } from "@/hooks/useIsMobile";
import { getTabStyles } from "@/utils/tabStyles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Users,
  Calendar,
  DollarSign,
  Building2,
  Target,
  User,
} from "lucide-react";

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
  const isMobile = useIsMobile();
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
          <DevDataBanner
            sources={[
              { label: "projects", status: "live", detail: "?status=completed|cancelled|archived" },
              { label: "payments", status: "live", detail: "/api/payments/" },
              { label: "archive", status: "live", detail: "POST /projects/{id}/archive/" },
            ]}
          />
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
                            <DevDataChip status="live" label="API" detail="/api/projects/" />
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
  const { isMacTheme } = useOsTheme();

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

        {/* Summary */}
        <TabsContent
          value="summary"
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
                  {project.description && (
                    <p className="text-base text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-row @lg:flex-col items-center @lg:items-end gap-2 shrink-0">
                  <StatusBadge
                    status={project.status}
                    label={formatProjectStatus(project.status)}
                  />
                  {canArchive && (
                    <Button
                      size="sm"
                      variant={isMacTheme ? "secondary" : "outline"}
                      onClick={handleArchive}
                      disabled={isArchiving}
                      className="min-h-[32px] touch-manipulation"
                    >
                      <span>{isArchiving ? "Archiving..." : "File to Archive"}</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Two columns when the window is wide enough, one when narrow
                  (container query = window width, not viewport) */}
              <div className="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 gap-4 pt-4 border-t">
                <InfoTile icon={Calendar} label="Start Date">
                  {project.start_date || "Not set"}
                </InfoTile>
                <InfoTile icon={Calendar} label="End Date">
                  {project.end_date || "Not set"}
                </InfoTile>
                <InfoTile icon={DollarSign} label="Budget">
                  {formatBudget(project.budget)}
                </InfoTile>
                <InfoTile icon={Building2} label="Project Type">
                  {project.project_type || "Not set"}
                </InfoTile>
                <InfoTile icon={Calendar} label="Event Date">
                  {project.event_date || "Not set"}
                </InfoTile>
                <InfoTile icon={Building2} label="Venue / Location">
                  {[project.venue_name, project.city, project.country]
                    .filter(Boolean)
                    .join(", ") || "Not set"}
                </InfoTile>
                <InfoTile icon={User} label="Promoter">
                  {project.promoter_name || "Not set"}
                </InfoTile>
                <InfoTile icon={Target} label="Source / Gig Size">
                  {[project.source, project.gig_size_code]
                    .filter(Boolean)
                    .join(" / ") || "Not set"}
                </InfoTile>
              </div>

              {project.feedback && (
                <div className="space-y-2 pt-4 border-t">
                  <h2 className="text-lg font-semibold">Feedback</h2>
                  <p className="text-sm text-muted-foreground">
                    {project.feedback}
                  </p>
                </div>
              )}

              {/* Final Lineup */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2 flex-wrap">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Final Lineup</h2>
                  <DevDataChip status="live" label="members" detail="/api/projects/" />
                  <DevDataChip status="hidden" label="gig score" detail="analytics 500" />
                </div>
                {project.members.length === 0 ? (
                  <div className="text-muted-foreground text-sm py-2">
                    No artists assigned to this project.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 gap-3">
                    {project.members.map((member) => (
                      <AquaCard key={member.artist_id}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">
                                {member.artist_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {member.role_in_project}
                              </div>
                              <DevDataChip status="live" label="artist" detail="/api/artists/" className="mt-0.5" />
                            </div>
                          </div>
                        </CardContent>
                      </AquaCard>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasks */}
              {project.tasks.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">Tasks</h2>
                  </div>
                  <div className="space-y-2">
                    {project.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-center justify-between gap-2 p-2 rounded-md",
                          isMacTheme ? "aqua-well" : "bg-muted/30"
                        )}
                      >
                        <span className="text-sm truncate">{task.title}</span>
                        <StatusBadge status={task.status} className="shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
                <DevDataChip status="live" label="/api/payments/" />
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
                            <DevDataChip status="live" label="payment" detail="/api/payments/" className="mt-0.5" />
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
