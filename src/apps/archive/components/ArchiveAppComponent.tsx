import { useState, useEffect } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { ArchiveMenuBar } from "./ArchiveMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { helpItems, appMetadata } from "../index.tsx";
import { useThemeStore } from "@/stores/useThemeStore";
import { ArchivedProject, ProjectPaymentStatus, LineupPaymentStatus } from "../data";
import { DJ, dummyDJs } from "../../active-projects/djDatabase";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getTabStyles } from "@/utils/tabStyles";
import { cn } from "@/lib/utils";
import * as React from "react";
import {
  ArrowLeft,
  MapPin,
  Users,
  Calendar,
  MessageSquare,
  DollarSign,
  Building2,
  Link as LinkIcon,
  Clock,
  FileText,
  Image as ImageIcon,
  Target,
  Music,
  User,
  TrendingUp,
} from "lucide-react";
import { checkIncomingPayment, checkOutgoingPayment } from "../utils/bankTransactions";

const CURRENT_USER_ID = "user-1";

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
  const [projects, setProjects] = useState<ArchivedProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const djs = dummyDJs;
  const [checkingPayment, setCheckingPayment] = useState<string | null>(null);

  const currentTheme = useThemeStore((state) => state.current);
  const isMacOSTheme = currentTheme === "macosx";
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  const tabStyles = getTabStyles(currentTheme);

  // Load projects from localStorage on mount
  useEffect(() => {
    const loadProjects = () => {
      try {
        const savedProjectsJson = localStorage.getItem("archived_projects_list");
        console.log("Loading archived projects from localStorage");
        if (savedProjectsJson) {
          const parsed = JSON.parse(savedProjectsJson);
          if (Array.isArray(parsed)) {
            console.log("Loaded archived projects count:", parsed.length);
            setProjects(parsed);
            if (!isMobile && parsed.length > 0 && !selectedProjectId) {
              setSelectedProjectId(parsed[0].id);
            }
          } else {
            console.warn("Invalid archived projects data in localStorage, resetting");
            localStorage.removeItem("archived_projects_list");
          }
        } else {
          console.log("No archived projects found in localStorage");
        }
      } catch (parseError) {
        console.error("Failed to parse archived projects from localStorage:", parseError);
        localStorage.removeItem("archived_projects_list");
      }
    };

    loadProjects();

    // Listen for updates when projects are archived
    const handleProjectsUpdate = () => {
      console.log("Received archived-projects-updated event, reloading...");
      loadProjects();
    };

    window.addEventListener("archived-projects-updated", handleProjectsUpdate);
    return () => {
      window.removeEventListener("archived-projects-updated", handleProjectsUpdate);
    };
  }, []);

  // Reload projects when window becomes visible/open
  useEffect(() => {
    if (isWindowOpen) {
      const loadProjects = () => {
        try {
          const savedProjectsJson = localStorage.getItem("archived_projects_list");
          if (savedProjectsJson) {
            const parsed = JSON.parse(savedProjectsJson);
            if (Array.isArray(parsed)) {
              console.log("Reloading archived projects on window open, count:", parsed.length);
              setProjects(parsed);
            }
          }
        } catch (e) {
          console.error("Failed to reload archived projects:", e);
        }
      };
      loadProjects();
    }
  }, [isWindowOpen]);

  // Save projects to localStorage whenever they change
  const isInitialLoad = React.useRef(true);
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    if (projects.length > 0 || localStorage.getItem("archived_projects_list")) {
      console.log("Saving archived projects to localStorage, count:", projects.length);
      localStorage.setItem("archived_projects_list", JSON.stringify(projects));
    }
  }, [projects]);

  // Ensure selectedProjectId is set when projects load (only on desktop)
  useEffect(() => {
    if (!isMobile && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, isMobile]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const menuBar = (
    <ArchiveMenuBar
      onClose={onClose}
      onShowHelp={() => setIsHelpDialogOpen(true)}
      onShowAbout={() => setIsAboutDialogOpen(true)}
    />
  );

  const handleUpdateProject = (updates: Partial<ArchivedProject>) => {
    setProjects((prev) => {
      const updated = prev.map((p) =>
        p.id === selectedProject?.id ? { ...p, ...updates } : p
      );
      return updated;
    });
  };

  const handleUpdateLineupPayment = (
    projectId: string,
    djId: string,
    updates: Partial<ArchivedProject["lineupPayments"][0]>
  ) => {
    setProjects((prev) => {
      const updated = prev.map((p) => {
        if (p.id === projectId) {
          const lineupPayments = p.lineupPayments.map((lp) =>
            lp.djId === djId ? { ...lp, ...updates } : lp
          );
          return { ...p, lineupPayments };
        }
        return p;
      });
      return updated;
    });
  };

  const handleAddFeedback = (projectId: string, text: string) => {
    if (!text.trim()) return;
    setProjects((prev) => {
      const updated = prev.map((p) => {
        if (p.id === projectId) {
          const newFeedback = {
            id: `feedback-${Date.now()}`,
            userId: CURRENT_USER_ID,
            timestamp: new Date().toISOString(),
            text: text.trim(),
          };
          return {
            ...p,
            wrapUpFeedback: [...p.wrapUpFeedback, newFeedback],
          };
        }
        return p;
      });
      return updated;
    });
  };

  const handleCheckIncomingPayment = async (project: ArchivedProject) => {
    setCheckingPayment(`project-${project.id}`);
    try {
      const transaction = await checkIncomingPayment(project.id, project.fee);
      if (transaction && transaction.status === "completed") {
        handleUpdateProject({ projectPaymentStatus: "Payment Received" });
      }
    } catch (error) {
      console.error("Failed to check incoming payment:", error);
    } finally {
      setCheckingPayment(null);
    }
  };

  const handleCheckOutgoingPayment = async (
    project: ArchivedProject,
    djId: string
  ) => {
    setCheckingPayment(`outgoing-${project.id}-${djId}`);
    try {
      const transaction = await checkOutgoingPayment(djId, "500"); // Default amount
      if (transaction && transaction.status === "completed") {
        handleUpdateLineupPayment(project.id, djId, {
          status: "Invoice Paid",
          paidAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Failed to check outgoing payment:", error);
    } finally {
      setCheckingPayment(null);
    }
  };

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
          {(!isMobile || !selectedProjectId) && (
            <div
              className={cn(
                "flex flex-col min-h-0",
                isMobile ? "w-full" : "w-64 pr-4 mr-4",
                isMacOSTheme && !isMobile && "border-r border-r-black/10"
              )}
            >
              <h2
                className={cn(
                  "text-lg font-semibold mb-3",
                  isMacOSTheme && "text-shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
                )}
                style={isMacOSTheme ? { textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)" } : {}}
              >
                Archived Projects
              </h2>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2">
                  {projects.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-2">
                      No archived projects yet
                    </div>
                  ) : (
                    projects.map((project) => {
                      const isSelected = selectedProjectId === project.id;
                      return (
                        <button
                          key={project.id}
                          onClick={() => setSelectedProjectId(project.id)}
                          className={cn(
                            "w-full text-left p-3.5 rounded-md transition-all relative overflow-hidden",
                            isMacOSTheme ? "" : isSelected ? "bg-muted" : "hover:bg-muted/50"
                          )}
                          style={
                            isMacOSTheme
                              ? {
                                  borderRadius: "8px",
                                  background: isSelected
                                    ? "linear-gradient(to bottom, rgba(48, 123, 201, 0.25), rgba(152, 189, 228, 0.25))"
                                    : "linear-gradient(to bottom, rgba(255, 255, 255, 0.6), rgba(245, 245, 245, 0.6))",
                                  border: isSelected
                                    ? "1px solid rgba(48, 123, 201, 0.5)"
                                    : "1px solid rgba(0, 0, 0, 0.1)",
                                  boxShadow: isSelected
                                    ? `
                                    0 2px 4px rgba(0, 0, 0, 0.14),
                                    0 1px 1px rgba(0, 0, 0, 0.25),
                                    inset 0 1px 2px rgba(255, 255, 255, 0.7),
                                    inset 0 0 4px rgba(0, 0, 0, 0.05),
                                    inset 0 0 0 0.5px rgba(0, 0, 0, 0.48),
                                    inset 0 0 0 1px rgba(0, 0, 0, 0.08)
                                  `
                                    : `
                                    0 1px 2px rgba(0, 0, 0, 0.1),
                                    inset 0 1px 1px rgba(255, 255, 255, 0.5)
                                  `,
                                  WebkitFontSmoothing: "antialiased",
                                  textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)",
                                }
                              : {}
                          }
                          onMouseEnter={(e) => {
                            if (isMacOSTheme && !isSelected && e.currentTarget) {
                              e.currentTarget.style.background =
                                "linear-gradient(to bottom, rgba(255, 255, 255, 0.8), rgba(250, 250, 250, 0.8))";
                              e.currentTarget.style.boxShadow = `
                              0 2px 4px rgba(0, 0, 0, 0.12),
                              inset 0 1px 1px rgba(255, 255, 255, 0.6)
                            `;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (isMacOSTheme && !isSelected && e.currentTarget) {
                              e.currentTarget.style.background =
                                "linear-gradient(to bottom, rgba(255, 255, 255, 0.6), rgba(245, 245, 245, 0.6))";
                              e.currentTarget.style.boxShadow = `
                              0 1px 2px rgba(0, 0, 0, 0.1),
                              inset 0 1px 1px rgba(255, 255, 255, 0.5)
                            `;
                            }
                          }}
                        >
                          {isMacOSTheme && (
                            <div
                              style={{
                                position: "absolute",
                                left: "4px",
                                right: "4px",
                                top: "2px",
                                height: isSelected ? "16px" : "12px",
                                background:
                                  "linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.2))",
                                borderRadius: "6px 6px 2px 2px",
                                filter: "blur(0.5px)",
                                pointerEvents: "none",
                                zIndex: 1,
                              }}
                            />
                          )}
                          <div className="relative z-10 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div
                                className="font-medium text-sm flex-1"
                                style={
                                  isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.08)" } : {}
                                }
                              >
                                {project.name}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div
                                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                                style={
                                  isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}
                                }
                              >
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span className="truncate">{project.date}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    project.projectPaymentStatus === "Invoice Paid"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {project.projectPaymentStatus}
                                </Badge>
                              </div>
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
          {(!isMobile || selectedProjectId) && (
            <div
              className={cn(
                "flex-1 flex flex-col min-w-0 min-h-0",
                isMacOSTheme ? "bg-transparent" : "bg-background"
              )}
            >
              {projects.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  No archived projects yet. Complete projects from Active Projects to archive them.
                </div>
              ) : selectedProject ? (
                <ProjectDetailView
                  project={selectedProject}
                  djs={djs}
                  onUpdateProject={handleUpdateProject}
                  onUpdateLineupPayment={handleUpdateLineupPayment}
                  onAddFeedback={handleAddFeedback}
                  onCheckIncomingPayment={handleCheckIncomingPayment}
                  onCheckOutgoingPayment={handleCheckOutgoingPayment}
                  checkingPayment={checkingPayment}
                  tabStyles={tabStyles}
                  isMobile={isMobile}
                  onBack={() => setSelectedProjectId(null)}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  Select a project to view details
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
  djs,
  onUpdateProject,
  onUpdateLineupPayment,
  onAddFeedback,
  onCheckIncomingPayment,
  onCheckOutgoingPayment,
  checkingPayment,
  tabStyles,
  isMobile,
  onBack,
}: {
  project: ArchivedProject;
  djs: DJ[];
  onUpdateProject: (updates: Partial<ArchivedProject>) => void;
  onUpdateLineupPayment: (
    projectId: string,
    djId: string,
    updates: Partial<ArchivedProject["lineupPayments"][0]>
  ) => void;
  onAddFeedback: (projectId: string, text: string) => void;
  onCheckIncomingPayment: (project: ArchivedProject) => Promise<void>;
  onCheckOutgoingPayment: (project: ArchivedProject, djId: string) => Promise<void>;
  checkingPayment: string | null;
  tabStyles: ReturnType<typeof getTabStyles>;
  isMobile: boolean;
  onBack: () => void;
}) {
  const currentTheme = useThemeStore((state) => state.current);
  const isMacOSTheme = currentTheme === "macosx";
  const [feedbackText, setFeedbackText] = useState("");
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isTransactionsDialogOpen, setIsTransactionsDialogOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: "",
    amount: "",
    dueDate: "",
    clientName: "",
    clientEmail: "",
    description: "",
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {isMobile && (
        <div className="flex items-center gap-2 mb-2 pb-2 border-b">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-0 h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm truncate">{project.name}</span>
        </div>
      )}
      <Tabs defaultValue="summary" className="flex-1 flex flex-col min-w-0 min-h-0">
        <div
          className={cn(
            "relative",
            isMobile && "overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          )}
          style={
            isMobile
              ? {
                  WebkitOverflowScrolling: "touch",
                }
              : {}
          }
        >
          <TabsList
            className={cn(
              tabStyles.tabListClasses,
              isMobile && "min-w-max"
            )}
          >
            <TabsTrigger className={tabStyles.tabTriggerClasses} value="summary">
              Summary
            </TabsTrigger>
            <TabsTrigger className={tabStyles.tabTriggerClasses} value="payments">
              Payments
            </TabsTrigger>
            <TabsTrigger className={tabStyles.tabTriggerClasses} value="media">
              Pics & Vids
            </TabsTrigger>
            <TabsTrigger className={tabStyles.tabTriggerClasses} value="feedback">
              Feedback
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="summary"
          className={cn(tabStyles.tabContentClasses, "flex-1 flex flex-col min-w-0 min-h-0")}
        >
          <ScrollArea className="flex-1">
            <div className="flex justify-center w-full py-4">
              <div className="w-full max-w-4xl px-4 md:px-6">
                <div className="space-y-6">
                  {/* Hero Section */}
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h1
                            className={cn("text-2xl mb-2 font-semibold", isMacOSTheme ? "" : "")}
                            style={isMacOSTheme ? { textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)" } : {}}
                          >
                            {project.name}
                          </h1>
                          <p
                            className="text-base text-muted-foreground"
                            style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                          >
                            {project.description}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-sm px-3 py-1",
                            project.projectSize === "Large" && "bg-blue-50 text-blue-700 border-blue-200",
                            project.projectSize === "Med" && "bg-purple-50 text-purple-700 border-purple-200",
                            project.projectSize === "Small" && "bg-green-50 text-green-700 border-green-200"
                          )}
                        >
                          {project.projectSize}
                        </Badge>
                      </div>
                    </div>

                    {/* Key Metrics - Mobile Optimized */}
                    <div className="space-y-1.5 md:hidden">
                      <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <Label className="text-xs text-muted-foreground mb-1 block">Event Date</Label>
                          <div className="text-sm font-medium h-8 flex items-center">{project.date}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <Label className="text-xs text-muted-foreground mb-1 block">Venue</Label>
                          <div className="text-sm font-medium h-8 flex items-center">{project.venue}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30">
                        <DollarSign className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <Label className="text-xs text-muted-foreground mb-1 block">Fee</Label>
                          <div className="text-sm font-medium h-8 flex items-center">{project.fee}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30">
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <Label className="text-xs text-muted-foreground mb-1 block">Timings</Label>
                          <div className="text-sm font-medium h-8 flex items-center">{project.timings}</div>
                        </div>
                      </div>
                    </div>

                    {/* Key Metrics Grid - Desktop */}
                    <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="p-2 rounded-md bg-background shrink-0">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label className="text-xs text-muted-foreground mb-1 block">Event Date</Label>
                          <div className="text-sm font-medium">{project.date}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="p-2 rounded-md bg-background shrink-0">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label className="text-xs text-muted-foreground mb-1 block">Venue</Label>
                          <div className="text-sm font-medium">{project.venue}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="p-2 rounded-md bg-background shrink-0">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label className="text-xs text-muted-foreground mb-1 block">Fee</Label>
                          <div className="text-sm font-medium">{project.fee}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="p-2 rounded-md bg-background shrink-0">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label className="text-xs text-muted-foreground mb-1 block">Timings</Label>
                          <div className="text-sm font-medium">{project.timings}</div>
                        </div>
                      </div>
                    </div>

                    {/* Project Details Section */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                          Project Details
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="min-w-0">
                          <Label className="text-xs mb-2 flex items-center gap-2" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                            <Calendar className="h-3 w-3" />
                            Deadline
                          </Label>
                          <div className="text-sm">{project.deadline || "Not set"}</div>
                        </div>
                        <div className="min-w-0">
                          <Label className="text-xs mb-2 flex items-center gap-2" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                            <TrendingUp className="h-3 w-3" />
                            Project Size
                          </Label>
                          <div className="text-sm">{project.projectSize}</div>
                        </div>
                        <div className="min-w-0">
                          <Label className="text-xs mb-2 flex items-center gap-2" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                            <User className="h-3 w-3" />
                            Project Lead
                          </Label>
                          <div className="text-sm">{project.projectLead || "Not set"}</div>
                        </div>
                        <div className="min-w-0">
                          <Label className="text-xs mb-2 flex items-center gap-2" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                            <Users className="h-3 w-3" />
                            Team
                          </Label>
                          <div className="text-sm">{project.team.length > 0 ? project.team.join(", ") : "Not set"}</div>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <Label className="text-xs mb-2 flex items-center gap-2" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                          <LinkIcon className="h-3 w-3" />
                          Google Drive Link
                        </Label>
                        {project.googleDriveLink ? (
                          <a
                            href={project.googleDriveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {project.googleDriveLink}
                          </a>
                        ) : (
                          <div className="text-sm text-muted-foreground">Not set</div>
                        )}
                      </div>
                    </div>

                    {/* Event Info Section */}
                    <div className="pt-4 border-t">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                          Event Information
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="min-w-0">
                          <Label className="text-xs mb-2 flex items-center gap-2" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                            <Building2 className="h-3.5 w-3.5" />
                            Promoter
                          </Label>
                          <div className="text-sm">{project.promoter}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Separator */}
                  <div className="border-t" />

                  {/* Final Lineup Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <h2
                        className="text-lg font-semibold"
                        style={isMacOSTheme ? { textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)" } : {}}
                      >
                        Final Lineup
                      </h2>
                    </div>
                    {project.finalLineup.length === 0 ? (
                      <div className="text-muted-foreground text-sm py-4">
                        No DJs assigned to this project.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {project.finalLineup.map((djId) => {
                          const dj = djs.find((d) => d.id === djId);
                          if (!dj) return null;
                          return (
                            <Card
                              key={dj.id}
                              className={cn(
                                "relative overflow-hidden transition-all w-full min-w-0",
                                isMacOSTheme && "border-none",
                                "ring-2 ring-primary"
                              )}
                              style={
                                isMacOSTheme
                                  ? {
                                      borderRadius: "8px",
                                      background: "linear-gradient(to bottom, rgba(48, 123, 201, 0.1), rgba(152, 189, 228, 0.1))",
                                      boxShadow: `
                                        0 2px 4px rgba(0, 0, 0, 0.14),
                                        0 1px 1px rgba(0, 0, 0, 0.25),
                                        inset 0 1px 2px rgba(255, 255, 255, 0.6),
                                        inset 0 0 4px rgba(0, 0, 0, 0.05),
                                        inset 0 0 0 0.5px rgba(0, 0, 0, 0.48),
                                        inset 0 0 0 1px rgba(0, 0, 0, 0.08)
                                      `,
                                      WebkitFontSmoothing: "antialiased",
                                    }
                                  : {}
                              }
                            >
                              {isMacOSTheme && (
                                <div
                                  style={{
                                    position: "absolute",
                                    left: "4px",
                                    right: "4px",
                                    top: "2px",
                                    height: "16px",
                                    background: "linear-gradient(rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.2))",
                                    borderRadius: "8px 8px 4px 4px",
                                    filter: "blur(0.5px)",
                                    pointerEvents: "none",
                                    zIndex: 1,
                                  }}
                                />
                              )}
                              <CardContent className={cn("relative z-10 w-full min-w-0 box-border", isMacOSTheme && "bg-transparent", isMobile ? "p-3" : "p-4")}>
                                <div className="space-y-2 w-full min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <h4
                                        className="font-semibold text-sm truncate"
                                        style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.08)" } : {}}
                                      >
                                        {dj.name}
                                      </h4>
                                      {dj.artistName && dj.artistName !== dj.name && (
                                        <p
                                          className="text-xs text-muted-foreground truncate"
                                          style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                                        >
                                          {dj.artistName}
                                        </p>
                                      )}
                                    </div>
                                    <Badge variant="default" className="text-xs shrink-0">
                                      Assigned
                                    </Badge>
                                  </div>

                                  <div className="space-y-1.5">
                                    {dj.location && (
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <MapPin className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{dj.location}</span>
                                      </div>
                                    )}

                                    {dj.genre && (
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Music className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{dj.genre}</span>
                                      </div>
                                    )}

                                    {dj.creativeDisciplines && (
                                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                        <User className="h-3 w-3 shrink-0 mt-0.5" />
                                        <span className="line-clamp-2">{dj.creativeDisciplines}</span>
                                      </div>
                                    )}

                                    {dj.timesBooked > 0 && (
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-black/5">
                                        <span>Booked {dj.timesBooked} {dj.timesBooked === 1 ? "time" : "times"}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Separator */}
                  <div className="border-t" />

                  {/* Status Updates Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <h2
                          className="text-lg font-semibold"
                          style={isMacOSTheme ? { textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)" } : {}}
                        >
                          Status Updates
                        </h2>
                      </div>
                      {project.statusUpdates.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {project.statusUpdates.length} {project.statusUpdates.length === 1 ? "update" : "updates"}
                        </Badge>
                      )}
                    </div>
                    {project.statusUpdates.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No status updates</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-64">
                        <div className="space-y-3 pr-4">
                          {project.statusUpdates
                            .sort(
                              (a, b) =>
                                new Date(b.timestamp).getTime() -
                                new Date(a.timestamp).getTime()
                            )
                            .map((update) => (
                              <div
                                key={update.id}
                                className={cn(
                                  "p-3 rounded-lg text-sm relative overflow-hidden transition-all",
                                  isMacOSTheme ? "" : "bg-muted/50"
                                )}
                                style={
                                  isMacOSTheme
                                    ? {
                                        borderRadius: "8px",
                                        background:
                                          "linear-gradient(to bottom, rgba(255, 255, 255, 0.7), rgba(250, 250, 250, 0.7))",
                                        border: "1px solid rgba(0, 0, 0, 0.08)",
                                        boxShadow: `
                                          inset 0 1px 1px rgba(255, 255, 255, 0.6),
                                          inset 0 0 2px rgba(0, 0, 0, 0.03)
                                        `,
                                        textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)",
                                      }
                                    : {}
                                }
                              >
                                {isMacOSTheme && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      left: "4px",
                                      right: "4px",
                                      top: "2px",
                                      height: "12px",
                                      background:
                                        "linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.15))",
                                      borderRadius: "6px 6px 2px 2px",
                                      filter: "blur(0.5px)",
                                      pointerEvents: "none",
                                      zIndex: 1,
                                    }}
                                  />
                                )}
                                <div className="flex items-start gap-3 relative z-10">
                                  <div className="mt-0.5 p-1.5 rounded-full shrink-0 bg-muted">
                                    <FileText className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span
                                        className="text-xs font-medium text-muted-foreground"
                                        style={
                                          isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}
                                        }
                                      >
                                        {new Date(update.timestamp).toLocaleDateString()}
                                      </span>
                                      <span className="text-xs text-muted-foreground/60">•</span>
                                      <span
                                        className="text-xs text-muted-foreground"
                                        style={
                                          isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}
                                        }
                                      >
                                        {new Date(update.timestamp).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                    <p
                                      className="text-sm leading-relaxed"
                                      style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                                    >
                                      {update.text}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent
          value="payments"
          className={cn(tabStyles.tabContentClasses, "flex-1 flex flex-col min-w-0 min-h-0")}
        >
          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4 pr-6">
                  {/* Project Overview */}
                  <div className="space-y-4">
                    <div>
                      <h1
                        className={cn("text-2xl mb-2 font-semibold", isMacOSTheme ? "" : "")}
                        style={isMacOSTheme ? { textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)" } : {}}
                      >
                        {project.name}
                      </h1>
                      <p
                        className="text-base text-muted-foreground"
                        style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                      >
                        {project.description}
                      </p>
                    </div>

                    {/* Daytimers Payment Status */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                        <h3
                          className="text-sm font-semibold"
                          style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                        >
                          Daytimers Payment Status
                        </h3>
                      </div>
                      <div className="space-y-3">
                        <div className="min-w-0">
                          <Label className="text-xs mb-2 block">
                            Status
                          </Label>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                            <Select
                              value={project.projectPaymentStatus}
                              onValueChange={(value: ProjectPaymentStatus) =>
                                onUpdateProject({ projectPaymentStatus: value })
                              }
                            >
                              <SelectTrigger className="flex-1 min-w-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Invoice Not Sent">Invoice Not Sent</SelectItem>
                                <SelectItem value="Invoice Sent">Invoice Sent</SelectItem>
                                <SelectItem value="Payment Received">Payment Received</SelectItem>
                                <SelectItem value="Invoice Paid">Invoice Paid</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              className={cn(
                                isMacOSTheme ? "aqua-button secondary" : "",
                                "shrink-0 w-full sm:w-auto"
                              )}
                              onClick={() => setIsInvoiceDialogOpen(true)}
                            >
                              Generate Invoice
                            </Button>
                            <Button
                              className={cn(
                                isMacOSTheme ? "aqua-button secondary" : "",
                                "shrink-0 w-full sm:w-auto"
                              )}
                              onClick={() => setIsTransactionsDialogOpen(true)}
                            >
                              Check Payments
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <DollarSign className="h-4 w-4 shrink-0" />
                          <span>Fee: {project.fee}</span>
                        </div>
                      </div>
                    </div>

                    {/* Lineup Payment Status */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                        <h3
                          className="text-sm font-semibold"
                          style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                        >
                          Lineup Payment Status
                        </h3>
                      </div>
                      {project.lineupPayments.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-4">
                          No lineup members assigned
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {project.lineupPayments.map((lineupPayment) => {
                            const dj = djs.find((d) => d.id === lineupPayment.djId);
                            const isChecking = checkingPayment === `outgoing-${project.id}-${lineupPayment.djId}`;
                            return (
                              <Card
                                key={lineupPayment.djId}
                                className={cn(
                                  "relative overflow-hidden w-full min-w-0",
                                  isMacOSTheme && "border-none"
                                )}
                                style={
                                  isMacOSTheme
                                    ? {
                                        borderRadius: "8px",
                                        background:
                                          "linear-gradient(to bottom, rgba(255, 255, 255, 0.7), rgba(250, 250, 250, 0.7))",
                                        border: "1px solid rgba(0, 0, 0, 0.08)",
                                        boxShadow: `
                                          0 2px 4px rgba(0, 0, 0, 0.14),
                                          0 1px 1px rgba(0, 0, 0, 0.25),
                                          inset 0 1px 2px rgba(255, 255, 255, 0.6),
                                          inset 0 0 4px rgba(0, 0, 0, 0.05),
                                          inset 0 0 0 0.5px rgba(0, 0, 0, 0.48),
                                          inset 0 0 0 1px rgba(0, 0, 0, 0.08)
                                        `,
                                      }
                                    : {}
                                }
                              >
                                <CardContent className={cn("p-4", isMacOSTheme && "bg-transparent")}>
                                  <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div
                                          className="font-medium"
                                          style={
                                            isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.08)" } : {}
                                          }
                                        >
                                          {dj?.name || `DJ ${lineupPayment.djId}`}
                                        </div>
                                        {dj?.artistName && dj.artistName !== dj.name && (
                                          <div
                                            className="text-sm text-muted-foreground"
                                            style={
                                              isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}
                                            }
                                          >
                                            {dj.artistName}
                                          </div>
                                        )}
                                      </div>
                                      <Badge
                                        variant={
                                          lineupPayment.status === "Invoice Paid" ? "default" : "secondary"
                                        }
                                        className="text-xs shrink-0"
                                      >
                                        {lineupPayment.status}
                                      </Badge>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                                      <Select
                                        value={lineupPayment.status}
                                        onValueChange={(value: LineupPaymentStatus) =>
                                          onUpdateLineupPayment(project.id, lineupPayment.djId, {
                                            status: value,
                                          })
                                        }
                                      >
                                        <SelectTrigger className="flex-1 min-w-0">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Invoice Received">Invoice Received</SelectItem>
                                          <SelectItem value="Invoice Paid">Invoice Paid</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        className={cn(
                                          isMacOSTheme ? "aqua-button secondary" : "",
                                          "shrink-0 w-full sm:w-auto"
                                        )}
                                        onClick={() => setIsTransactionsDialogOpen(true)}
                                        disabled={isChecking}
                                        size="sm"
                                      >
                                        {isChecking ? (
                                          <Clock className="h-4 w-4 animate-spin" />
                                        ) : (
                                          "Check"
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent
          value="media"
          className={cn(tabStyles.tabContentClasses, "flex-1 flex flex-col min-w-0 min-h-0")}
        >
          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4 pr-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <h2
                    className="text-lg font-semibold"
                    style={isMacOSTheme ? { textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)" } : {}}
                  >
                    Pics & Vids
                  </h2>
                </div>
                <div className="space-y-3">
                  <div className="min-w-0">
                    <Label className="text-xs mb-2 flex items-center gap-2">
                      <LinkIcon className="h-3 w-3" />
                      Google Drive Link
                    </Label>
                    <Input
                      type="url"
                      value={project.photosAndVideos}
                      onChange={(e) => onUpdateProject({ photosAndVideos: e.target.value })}
                      placeholder="https://drive.google.com/..."
                      className="w-full"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Add the Google Drive link containing photos and videos from this project.
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent
          value="feedback"
          className={cn(tabStyles.tabContentClasses, "flex-1 flex flex-col min-w-0 min-h-0")}
        >
          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4 pr-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <h2
                      className="text-lg font-semibold"
                      style={isMacOSTheme ? { textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)" } : {}}
                    >
                      Feedback
                    </h2>
                  </div>
                  {project.wrapUpFeedback.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {project.wrapUpFeedback.length}{" "}
                      {project.wrapUpFeedback.length === 1 ? "entry" : "entries"}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 min-w-0">
                  <Textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Add wrap up feedback, learnings, or notes..."
                    className="flex-1 w-full min-h-[100px]"
                  />
                </div>
                <Button
                  className={isMacOSTheme ? "aqua-button secondary" : ""}
                  onClick={() => {
                    onAddFeedback(project.id, feedbackText);
                    setFeedbackText("");
                  }}
                  disabled={!feedbackText.trim()}
                >
                  Add Feedback
                </Button>
                {project.wrapUpFeedback.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No feedback yet</p>
                    <p className="text-xs mt-1">Add your first feedback entry above</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {project.wrapUpFeedback
                      .sort(
                        (a, b) =>
                          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                      )
                      .map((feedback) => (
                        <div
                          key={feedback.id}
                          className={cn(
                            "p-3 rounded-lg text-sm relative overflow-hidden transition-all",
                            isMacOSTheme ? "" : "bg-muted/50"
                          )}
                          style={
                            isMacOSTheme
                              ? {
                                  borderRadius: "8px",
                                  background:
                                    "linear-gradient(to bottom, rgba(255, 255, 255, 0.7), rgba(250, 250, 250, 0.7))",
                                  border: "1px solid rgba(0, 0, 0, 0.08)",
                                  boxShadow: `
                                    inset 0 1px 1px rgba(255, 255, 255, 0.6),
                                    inset 0 0 2px rgba(0, 0, 0, 0.03)
                                  `,
                                  textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)",
                                }
                              : {}
                          }
                        >
                          {isMacOSTheme && (
                            <div
                              style={{
                                position: "absolute",
                                left: "4px",
                                right: "4px",
                                top: "2px",
                                height: "12px",
                                background:
                                  "linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.15))",
                                borderRadius: "6px 6px 2px 2px",
                                filter: "blur(0.5px)",
                                pointerEvents: "none",
                                zIndex: 1,
                              }}
                            />
                          )}
                          <div className="flex items-start gap-3 relative z-10">
                            <div className="mt-0.5 p-1.5 rounded-full shrink-0 bg-muted">
                              <FileText className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span
                                  className="text-xs font-medium text-muted-foreground"
                                  style={
                                    isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}
                                  }
                                >
                                  {new Date(feedback.timestamp).toLocaleDateString()}
                                </span>
                                <span className="text-xs text-muted-foreground/60">•</span>
                                <span
                                  className="text-xs text-muted-foreground"
                                  style={
                                    isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}
                                  }
                                >
                                  {new Date(feedback.timestamp).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p
                                className="text-sm leading-relaxed"
                                style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                              >
                                {feedback.text}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Generate Invoice Dialog */}
      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className={cn(
          isMobile ? "max-w-[calc(100vw-1rem)] mx-2" : "max-w-[600px]",
          isMacOSTheme && "max-h-[90vh]"
        )}>
          {isMacOSTheme ? (
            <>
              <DialogHeader>Generate Invoice</DialogHeader>
              <div className="px-4 sm:px-6 pt-3 pb-2">
                <p className="text-sm text-muted-foreground">
                  Fill out the invoice details to send to the client for DAYTIMERS account payment.
                </p>
              </div>
            </>
          ) : (
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Generate Invoice</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Fill out the invoice details to send to the client for DAYTIMERS account payment.
              </DialogDescription>
            </DialogHeader>
          )}
          <ScrollArea className="max-h-[calc(90vh-180px)] px-4 sm:px-6">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-number" className="text-sm">Invoice Number</Label>
                <Input
                  id="invoice-number"
                  value={invoiceForm.invoiceNumber}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                  placeholder="INV-2024-001"
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm">Amount</Label>
                <Input
                  id="amount"
                  type="text"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                  placeholder={project.fee}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due-date" className="text-sm">Due Date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-name" className="text-sm">Client Name</Label>
                <Input
                  id="client-name"
                  value={invoiceForm.clientName}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, clientName: e.target.value })}
                  placeholder="Client or Company Name"
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email" className="text-sm">Client Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={invoiceForm.clientEmail}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, clientEmail: e.target.value })}
                  placeholder="client@example.com"
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm">Description</Label>
                <Textarea
                  id="description"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  placeholder="Services provided for this project..."
                  rows={4}
                  className="w-full resize-none"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="flex-col sm:flex-row gap-2 px-4 sm:px-6 pb-4 sm:pb-6">
            <Button
              variant="outline"
              onClick={() => setIsInvoiceDialogOpen(false)}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button
              className={cn(
                isMacOSTheme ? "aqua-button secondary" : "",
                "w-full sm:w-auto order-1 sm:order-2"
              )}
              onClick={() => {
                const amount = invoiceForm.amount || project.fee;
                // Validate form
                if (!invoiceForm.invoiceNumber || !amount || !invoiceForm.clientName || !invoiceForm.clientEmail) {
                  return;
                }
                // Update status to "Invoice Sent"
                onUpdateProject({ projectPaymentStatus: "Invoice Sent" });
                // Reset form
                setInvoiceForm({
                  invoiceNumber: "",
                  amount: "",
                  dueDate: "",
                  clientName: "",
                  clientEmail: "",
                  description: "",
                });
                setIsInvoiceDialogOpen(false);
              }}
              disabled={!invoiceForm.invoiceNumber || (!invoiceForm.amount && !project.fee) || !invoiceForm.clientName || !invoiceForm.clientEmail}
            >
              Send Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revolut Transactions Dialog */}
      <Dialog open={isTransactionsDialogOpen} onOpenChange={setIsTransactionsDialogOpen}>
        <DialogContent className={cn(
          isMobile ? "max-w-[calc(100vw-2rem)]" : "max-w-[800px]",
          isMacOSTheme && "max-h-[90vh]"
        )}>
          {isMacOSTheme ? (
            <>
              <DialogHeader>Revolut Bank Transactions</DialogHeader>
              <div className="px-4 sm:px-6 pt-3 pb-2">
                <p className="text-sm text-muted-foreground">
                  Recent transactions for this project payment.
                </p>
              </div>
            </>
          ) : (
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Revolut Bank Transactions</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Recent transactions for this project payment.
              </DialogDescription>
            </DialogHeader>
          )}
          <ScrollArea className="max-h-[calc(90vh-140px)] px-4 sm:px-6">
            <div className="space-y-2 py-4">
              {generateDummyTransactions(project).map((transaction, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 sm:p-4 rounded-lg border w-full min-w-0",
                    isMacOSTheme ? "" : "bg-muted/30"
                  )}
                  style={
                    isMacOSTheme
                      ? {
                          borderRadius: "8px",
                          background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.7), rgba(250, 250, 250, 0.7))",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.6), inset 0 0 2px rgba(0, 0, 0, 0.03)",
                        }
                      : {}
                  }
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3 sm:gap-4 min-w-0">
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                        <span className="font-medium text-sm break-words">{transaction.description}</span>
                        <Badge
                          variant={transaction.status === "completed" ? "default" : "secondary"}
                          className="text-xs shrink-0 w-fit"
                        >
                          {transaction.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1 mt-2">
                        <div className="break-words">Date: {transaction.date}</div>
                        <div className="break-words">Reference: {transaction.reference}</div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right shrink-0 w-full sm:w-auto">
                      <div className={cn(
                        "font-semibold text-sm",
                        transaction.amount.startsWith("-") ? "text-red-600" : "text-green-600"
                      )}>
                        {transaction.amount}
                      </div>
                      <div className="text-xs text-muted-foreground">{transaction.currency}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-6">
            <Button
              className={cn(
                isMacOSTheme ? "aqua-button secondary" : "",
                "w-full sm:w-auto"
              )}
              onClick={() => setIsTransactionsDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Generate dummy Revolut transactions
function generateDummyTransactions(project: ArchivedProject) {
  const transactions = [
    {
      description: `Payment for ${project.name}`,
      amount: project.fee,
      currency: "GBP",
      date: new Date().toLocaleDateString(),
      reference: `REF-${project.id.slice(0, 8).toUpperCase()}`,
      status: "completed" as const,
    },
    {
      description: "Bank Transfer - Incoming",
      amount: project.fee,
      currency: "GBP",
      date: new Date(Date.now() - 86400000).toLocaleDateString(),
      reference: `TXN-${Date.now().toString().slice(-8)}`,
      status: "pending" as const,
    },
    {
      description: "Service Fee",
      amount: "-£5.00",
      currency: "GBP",
      date: new Date(Date.now() - 172800000).toLocaleDateString(),
      reference: `FEE-${Date.now().toString().slice(-8)}`,
      status: "completed" as const,
    },
    {
      description: `Invoice Payment - ${project.name}`,
      amount: project.fee,
      currency: "GBP",
      date: new Date(Date.now() - 259200000).toLocaleDateString(),
      reference: `INV-${project.id.slice(0, 8).toUpperCase()}`,
      status: "completed" as const,
    },
  ];
  return transactions;
}
