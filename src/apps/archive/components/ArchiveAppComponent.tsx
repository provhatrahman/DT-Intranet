import { useState, useEffect } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { ArchiveMenuBar } from "./ArchiveMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { helpItems, appMetadata } from "../index.tsx";
import { useThemeStore } from "@/stores/useThemeStore";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { usePaymentsStore } from "@/stores/usePaymentsStore";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
} from "../data";
import { formatProjectStatus, formatBudget } from "../../active-projects/data";
import type { ProjectDetail, ProjectListItem } from "@/lib/api/projects";
import type { Payment, PaymentStatus } from "@/lib/api/payments";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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

function statusBadgeClasses(status: string): string {
  switch (status) {
    case "completed":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "cancelled":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
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
  const isMobile = useIsMobile();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );

  const currentTheme = useThemeStore((state) => state.current);
  const isMacOSTheme = currentTheme === "macosx";
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  const tabStyles = getTabStyles(currentTheme);

  const {
    isLoadingAll,
    error,
    fetchAllProjects,
    getArchivedProjects,
    projectDetails,
    refreshProject,
    clearError,
  } = useProjectsStore();

  const archivedProjects = getArchivedProjects();

  useEffect(() => {
    if (isWindowOpen) {
      fetchAllProjects().catch((err) => {
        console.error("Failed to fetch archived projects:", err);
      });
    }
  }, [isWindowOpen, fetchAllProjects]);

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
        <div
          className={cn(
            "flex h-full w-full min-h-0",
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
              <h2 className="text-lg font-semibold mb-3">Archived Projects</h2>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2">
                  {isLoadingAll && archivedProjects.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-2">
                      Loading...
                    </div>
                  ) : archivedProjects.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-2">
                      No archived projects yet. Complete projects from Active
                      Projects to archive them.
                    </div>
                  ) : (
                    archivedProjects.map((project: ProjectListItem) => {
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
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {project.end_date || project.start_date || "No date"}
                              </span>
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
              {archivedProjects.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  No archived projects yet.
                </div>
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
  const { fetchWrapup, saveWrapup } = useProjectsStore();
  const { paymentsByProject, fetchPaymentsForProject, updatePayment } =
    usePaymentsStore();

  const [summary, setSummary] = useState("");
  const [lessons, setLessons] = useState("");
  const [hasExistingWrapup, setHasExistingWrapup] = useState(false);
  const [isSavingWrapup, setIsSavingWrapup] = useState(false);

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
            <div className="space-y-6 p-4 pr-6 max-w-3xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <h1 className="text-2xl font-semibold break-words">
                    {project.name}
                  </h1>
                  {project.description && (
                    <p className="text-base text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn("text-sm shrink-0", statusBadgeClasses(project.status))}
                >
                  {formatProjectStatus(project.status)}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-xs text-muted-foreground block">
                      Start Date
                    </Label>
                    <div className="text-sm font-medium">
                      {project.start_date || "Not set"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-xs text-muted-foreground block">
                      End Date
                    </Label>
                    <div className="text-sm font-medium">
                      {project.end_date || "Not set"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-xs text-muted-foreground block">
                      Budget
                    </Label>
                    <div className="text-sm font-medium">
                      {formatBudget(project.budget)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-xs text-muted-foreground block">
                      Project Type
                    </Label>
                    <div className="text-sm font-medium">
                      {project.project_type || "Not set"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Final Lineup */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Final Lineup</h2>
                </div>
                {project.members.length === 0 ? (
                  <div className="text-muted-foreground text-sm py-2">
                    No artists assigned to this project.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {project.members.map((member) => (
                      <Card key={member.artist_id}>
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
                            </div>
                          </div>
                        </CardContent>
                      </Card>
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
                        className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30"
                      >
                        <span className="text-sm truncate">{task.title}</span>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {task.status}
                        </Badge>
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
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Payments</h3>
              </div>
              {payments.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">
                  No payments recorded for this project.
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <Card key={payment.id}>
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
                    </Card>
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
            <div className="space-y-4 p-4 pr-6 max-w-3xl">
              <h2 className="text-lg font-semibold">Wrap-up</h2>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Summary</Label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Overall summary of how the project went..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Lessons Learned</Label>
                <Textarea
                  value={lessons}
                  onChange={(e) => setLessons(e.target.value)}
                  placeholder="What did we learn? What would we do differently?"
                  className="min-h-[100px]"
                />
              </div>
              <Button
                onClick={handleSaveWrapup}
                disabled={isSavingWrapup || (!summary.trim() && !lessons.trim())}
              >
                {isSavingWrapup
                  ? "Saving..."
                  : hasExistingWrapup
                  ? "Update Wrap-up"
                  : "Save Wrap-up"}
              </Button>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
