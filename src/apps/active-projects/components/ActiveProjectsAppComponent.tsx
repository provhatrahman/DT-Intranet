import { useState, useEffect } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { ActiveProjectsMenuBar } from "./ActiveProjectsMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { helpItems, appMetadata } from "..";
import { useThemeStore } from "@/stores/useThemeStore";
import { ActiveProject, dummyProjects, StatusUpdate } from "../data";
import { DJ, dummyDJs, searchDJs, addDJ } from "../djDatabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
import { useIsMobile } from "@/hooks/useIsMobile";
import { getTabStyles } from "@/utils/tabStyles";
import { cn } from "@/lib/utils";
import * as React from "react";
import { ArrowLeft, MapPin, Users, Calendar, MessageSquare, Music, User, Clock, DollarSign, Building2, Link as LinkIcon, Target, AlertCircle, CheckCircle2, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";

const CURRENT_USER_ID = "user-1"; // Dummy user ID for voting

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
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState<ActiveProject[]>(dummyProjects);
  // Start with no selection on mobile to show list first
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    window.innerWidth < 768 ? null : dummyProjects[0]?.id || null
  );
  const [djs, setDJs] = useState<DJ[]>(dummyDJs);
  const [djSearchQuery, setDJSearchQuery] = useState("");
  const [showAddDJDialog, setShowAddDJDialog] = useState(false);
  const [newDJForm, setNewDJForm] = useState<Partial<DJ>>({});
  const [djSearchPage, setDJSearchPage] = useState(1);
  const [lineupPage, setLineupPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const currentTheme = useThemeStore((state) => state.current);
  const isMacOSTheme = currentTheme === "macosx";
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  const tabStyles = getTabStyles(currentTheme);

  // Ensure selectedProjectId is set when projects load (only on desktop)
  useEffect(() => {
    if (!isMobile && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, isMobile]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const menuBar = (
    <ActiveProjectsMenuBar
      onClose={onClose}
      onShowHelp={() => setIsHelpDialogOpen(true)}
      onShowAbout={() => setIsAboutDialogOpen(true)}
    />
  );

  const handleAddStatusUpdate = (projectId: string, text: string) => {
    if (!text.trim()) return;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          const newUpdate: StatusUpdate = {
            id: `status-${Date.now()}`,
            timestamp: new Date().toISOString(),
            text: text.trim(),
            userId: CURRENT_USER_ID,
          };
          return {
            ...p,
            statusUpdates: [...p.statusUpdates, newUpdate],
          };
        }
        return p;
      })
    );
  };

  const handleAddCurationSuggestion = (
    projectId: string,
    name: string,
    workLink?: string
  ) => {
    if (!name.trim()) return;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            curationSuggestions: [
              ...p.curationSuggestions,
              {
                id: `curation-${Date.now()}`,
                name: name.trim(),
                workLink: workLink?.trim() || undefined,
                votes: {},
              },
            ],
          };
        }
        return p;
      })
    );
  };

  const handleVoteCuration = (
    projectId: string,
    suggestionId: string,
    userId: string
  ) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            curationSuggestions: p.curationSuggestions.map((s) => {
              if (s.id === suggestionId) {
                const hasVoted = s.votes[userId] || false;
                return {
                  ...s,
                  votes: {
                    ...s.votes,
                    [userId]: !hasVoted,
                  },
                };
              }
              return s;
            }),
          };
        }
        return p;
      })
    );
  };

  const handleAssignDJ = (projectId: string, djId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          if (p.finalLineup.includes(djId)) {
            return {
              ...p,
              finalLineup: p.finalLineup.filter((id) => id !== djId),
            };
          } else {
            return {
              ...p,
              finalLineup: [...p.finalLineup, djId],
            };
          }
        }
        return p;
      })
    );
  };

  const handleAddNewDJ = () => {
    if (
      !newDJForm.name ||
      !newDJForm.artistName ||
      !newDJForm.location ||
      !newDJForm.creativeDisciplines
    ) {
      return;
    }
    const newDJ = addDJ({
      name: newDJForm.name,
      artistName: newDJForm.artistName,
      contactDetails: newDJForm.contactDetails || "",
      location: newDJForm.location,
      creativeDisciplines: newDJForm.creativeDisciplines,
      linksToWork: newDJForm.linksToWork || "",
      genre: newDJForm.genre || "",
      timesBooked: 0,
      mostRecentEvent: "",
      mostRecentEventDate: "",
    });
    setDJs((prev) => [...prev, newDJ]);
    setNewDJForm({});
    setShowAddDJDialog(false);
  };

  const filteredDJs = searchDJs(djSearchQuery, djs);
  
  // Reset pagination when search query changes
  useEffect(() => {
    setDJSearchPage(1);
  }, [djSearchQuery]);
  
  // Reset lineup pagination when project changes
  useEffect(() => {
    setLineupPage(1);
  }, [selectedProjectId]);

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
              Projects
            </h2>
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2">
                {projects.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2">
                    No projects available
                  </div>
                ) : (
                  projects.map((project) => {
                    const isSelected = selectedProjectId === project.id;
                    const latestStatusUpdate = project.statusUpdates.length > 0
                      ? project.statusUpdates.sort(
                          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                        )[0]
                      : null;
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
                            e.currentTarget.style.background = "linear-gradient(to bottom, rgba(255, 255, 255, 0.8), rgba(250, 250, 250, 0.8))";
                            e.currentTarget.style.boxShadow = `
                              0 2px 4px rgba(0, 0, 0, 0.12),
                              inset 0 1px 1px rgba(255, 255, 255, 0.6)
                            `;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (isMacOSTheme && !isSelected && e.currentTarget) {
                            e.currentTarget.style.background = "linear-gradient(to bottom, rgba(255, 255, 255, 0.6), rgba(245, 245, 245, 0.6))";
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
                              background: "linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.2))",
                              borderRadius: "6px 6px 2px 2px",
                              filter: "blur(0.5px)",
                              pointerEvents: "none",
                              zIndex: 1,
                            }}
                          />
                        )}
                        <div className="relative z-10 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm flex-1" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.08)" } : {}}>
                              {project.name}
                            </div>
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                "text-xs shrink-0",
                                project.projectSize === "Large" && "bg-blue-100 text-blue-800",
                                project.projectSize === "Med" && "bg-green-100 text-green-800",
                                project.projectSize === "Small" && "bg-gray-100 text-gray-800"
                              )}
                            >
                              {project.projectSize}
                            </Badge>
                          </div>
                          
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span className="truncate">{project.date}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{project.venue}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">{project.projectLead}</span>
                            </div>
                            
                            {latestStatusUpdate && (
                              <div className="flex items-start gap-1.5 pt-1 border-t border-black/5">
                                <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-muted-foreground line-clamp-2" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                                    {latestStatusUpdate.text}
                                  </div>
                                </div>
                              </div>
                            )}
                            {(project.curationSuggestions.length > 0 || project.finalLineup.length > 0) && (
                              <div className="flex items-center gap-3 pt-1 border-t border-black/5">
                                {project.curationSuggestions.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                                    <Music className="h-3 w-3" />
                                    <span>{project.curationSuggestions.length}</span>
                                  </div>
                                )}
                                {project.finalLineup.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                                    <Users className="h-3 w-3" />
                                    <span>{project.finalLineup.length}</span>
                                  </div>
                                )}
                              </div>
                            )}
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
            <div className={cn(
              "flex-1 flex flex-col min-w-0 min-h-0",
              isMacOSTheme ? "bg-transparent" : "bg-background"
            )}>
            {projects.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                No projects available. Projects are created from incoming offers.
              </div>
            ) : selectedProject ? (
              <ProjectDetailView
                project={selectedProject}
                djs={filteredDJs}
                allDJs={djs}
                djSearchQuery={djSearchQuery}
                onDJSearchChange={setDJSearchQuery}
                onAddStatusUpdate={handleAddStatusUpdate}
                onAddCurationSuggestion={handleAddCurationSuggestion}
                onVoteCuration={handleVoteCuration}
                onAssignDJ={handleAssignDJ}
                onUpdateProject={(updates) =>
                  setProjects((prev) =>
                    prev.map((p) =>
                      p.id === selectedProject.id ? { ...p, ...updates } : p
                    )
                  )
                }
                showAddDJDialog={showAddDJDialog}
                onShowAddDJDialog={setShowAddDJDialog}
                newDJForm={newDJForm}
                onNewDJFormChange={setNewDJForm}
                onAddNewDJ={handleAddNewDJ}
                tabStyles={tabStyles}
                isMobile={isMobile}
                onBack={() => setSelectedProjectId(null)}
                djSearchPage={djSearchPage}
                onDJSearchPageChange={setDJSearchPage}
                lineupPage={lineupPage}
                onLineupPageChange={setLineupPage}
                itemsPerPage={ITEMS_PER_PAGE}
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
          appId="active-projects"
        />
        <AboutDialog
          isOpen={isAboutDialogOpen}
          onOpenChange={setIsAboutDialogOpen}
          metadata={appMetadata}
          appId="active-projects"
        />
      </WindowFrame>
    </>
  );
}

function ProjectDetailView({
  project,
  djs,
  allDJs,
  djSearchQuery,
  onDJSearchChange,
  onAddStatusUpdate,
  onAddCurationSuggestion,
  onVoteCuration,
  onAssignDJ,
  onUpdateProject,
  showAddDJDialog,
  onShowAddDJDialog,
  newDJForm,
  onNewDJFormChange,
  onAddNewDJ,
  tabStyles,
  isMobile,
  onBack,
  djSearchPage,
  onDJSearchPageChange,
  lineupPage,
  onLineupPageChange,
  itemsPerPage,
}: {
  project: ActiveProject;
  djs: DJ[];
  allDJs: DJ[];
  djSearchQuery: string;
  onDJSearchChange: (query: string) => void;
  onAddStatusUpdate: (projectId: string, text: string) => void;
  onAddCurationSuggestion: (
    projectId: string,
    name: string,
    workLink?: string
  ) => void;
  onVoteCuration: (
    projectId: string,
    suggestionId: string,
    userId: string
  ) => void;
  onAssignDJ: (projectId: string, djId: string) => void;
  onUpdateProject: (updates: Partial<ActiveProject>) => void;
  showAddDJDialog: boolean;
  onShowAddDJDialog: (show: boolean) => void;
  newDJForm: Partial<DJ>;
  onNewDJFormChange: (form: Partial<DJ>) => void;
  onAddNewDJ: () => void;
  tabStyles: ReturnType<typeof getTabStyles>;
  isMobile: boolean;
  onBack: () => void;
  djSearchPage: number;
  onDJSearchPageChange: (page: number) => void;
  lineupPage: number;
  onLineupPageChange: (page: number) => void;
  itemsPerPage: number;
}) {
  const currentTheme = useThemeStore((state) => state.current);
  const isMacOSTheme = currentTheme === "macosx";
  const [statusUpdateText, setStatusUpdateText] = useState("");
  const [curationName, setCurationName] = useState("");
  const [curationLink, setCurationLink] = useState("");

  // Pagination logic for DJ search results
  const totalDJPages = Math.ceil(djs.length / itemsPerPage);
  const startDJIndex = (djSearchPage - 1) * itemsPerPage;
  const endDJIndex = startDJIndex + itemsPerPage;
  const paginatedDJs = djs.slice(startDJIndex, endDJIndex);

  // Pagination logic for final lineup
  const totalLineupPages = Math.ceil(project.finalLineup.length / itemsPerPage);
  const startLineupIndex = (lineupPage - 1) * itemsPerPage;
  const endLineupIndex = startLineupIndex + itemsPerPage;
  const paginatedLineup = project.finalLineup.slice(startLineupIndex, endLineupIndex);

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
      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-w-0 min-h-0">
        <TabsList className={tabStyles.tabListClasses}>
          <TabsTrigger className={tabStyles.tabTriggerClasses} value="overview">
            Overview
          </TabsTrigger>
          <TabsTrigger
            className={tabStyles.tabTriggerClasses}
            value="curation"
          >
            Curation
          </TabsTrigger>
          <TabsTrigger
            className={tabStyles.tabTriggerClasses}
            value="lineup"
          >
            Final Lineup
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="overview"
          className={cn(tabStyles.tabContentClasses, "flex-1 flex flex-col min-w-0 min-h-0")}
        >
          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4 pr-6">
              {/* Hero Section */}
              <div className="space-y-4">
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

                {/* Key Metrics - Mobile Optimized */}
                <div className="space-y-1.5 md:hidden">
                  <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground">Event Date: </span>
                      <span className="text-sm font-medium">{project.date}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground">Venue: </span>
                      <span className="text-sm font-medium">{project.venue}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30">
                    <DollarSign className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground">Fee: </span>
                      <span className="text-sm font-medium">{project.fee}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground">Timings: </span>
                      <span className="text-sm font-medium">{project.timings}</span>
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
                      <div className="text-xs text-muted-foreground mb-1">Event Date</div>
                      <div className="text-sm font-medium break-words">{project.date}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="p-2 rounded-md bg-background shrink-0">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">Venue</div>
                      <div className="text-sm font-medium break-words">{project.venue}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="p-2 rounded-md bg-background shrink-0">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">Fee</div>
                      <div className="text-sm font-medium break-words">{project.fee}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="p-2 rounded-md bg-background shrink-0">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">Timings</div>
                      <div className="text-sm font-medium break-words">{project.timings}</div>
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
                      <div className="relative w-full">
                        <Input
                          type="date"
                          value={project.deadline}
                          onChange={(e) =>
                            onUpdateProject({ deadline: e.target.value })
                          }
                          className="w-full"
                        />
                        {project.deadline && (() => {
                          const daysUntilDeadline = Math.ceil(
                            (new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                          );
                          return daysUntilDeadline >= 0 && daysUntilDeadline <= 7 ? (
                            <div className="absolute right-2 top-2">
                              <AlertCircle className={cn(
                                "h-4 w-4",
                                daysUntilDeadline <= 3 ? "text-red-500" : "text-yellow-500"
                              )} />
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs mb-2 flex items-center gap-2" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                        <TrendingUp className="h-3 w-3" />
                        Project Size
                      </Label>
                      <Select
                        value={project.projectSize}
                        onValueChange={(value) =>
                          onUpdateProject({
                            projectSize: value as "Small" | "Med" | "Large",
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Small">Small</SelectItem>
                          <SelectItem value="Med">Med</SelectItem>
                          <SelectItem value="Large">Large</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs mb-2 flex items-center gap-2" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                        <User className="h-3 w-3" />
                        Project Lead
                      </Label>
                      <Input
                        value={project.projectLead}
                        onChange={(e) =>
                          onUpdateProject({ projectLead: e.target.value })
                        }
                        className="w-full"
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs mb-2 flex items-center gap-2" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                        <Users className="h-3 w-3" />
                        Team
                      </Label>
                      <Input
                        value={project.team.join(", ")}
                        onChange={(e) =>
                          onUpdateProject({
                            team: e.target.value.split(",").map((t) => t.trim()),
                          })
                        }
                        placeholder="Comma-separated names"
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Label className="text-xs mb-2 flex items-center gap-2" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                      <LinkIcon className="h-3 w-3" />
                      Google Drive Link
                    </Label>
                    <Input
                      type="url"
                      value={project.googleDriveLink}
                      onChange={(e) =>
                        onUpdateProject({ googleDriveLink: e.target.value })
                      }
                      placeholder="https://drive.google.com/..."
                      className="w-full"
                    />
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
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/20">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <span className="text-xs text-muted-foreground">Promoter:</span>
                        <span className="ml-2 font-medium" style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                          {project.promoter}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
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
                <div className="flex gap-2 min-w-0">
                  <Input
                    value={statusUpdateText}
                    onChange={(e) => setStatusUpdateText(e.target.value)}
                    placeholder="Add a status update..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onAddStatusUpdate(project.id, statusUpdateText);
                        setStatusUpdateText("");
                      }
                    }}
                    className="flex-1 w-full"
                  />
                  <Button
                    className={isMacOSTheme ? "aqua-button secondary shrink-0" : "shrink-0"}
                    onClick={() => {
                      onAddStatusUpdate(project.id, statusUpdateText);
                      setStatusUpdateText("");
                    }}
                    disabled={!statusUpdateText.trim()}
                  >
                    Add
                  </Button>
                </div>
                {project.statusUpdates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No status updates yet</p>
                    <p className="text-xs mt-1">Add your first update above</p>
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
                        .map((update, index) => {
                          const isRecent = index === 0 && (() => {
                            const hoursSinceUpdate = (new Date().getTime() - new Date(update.timestamp).getTime()) / (1000 * 60 * 60);
                            return hoursSinceUpdate < 24;
                          })();
                          return (
                            <div
                              key={update.id}
                              className={cn(
                                "p-3 rounded-lg text-sm relative overflow-hidden transition-all",
                                isMacOSTheme ? "" : "bg-muted/50",
                                isRecent && "ring-2 ring-primary/20"
                              )}
                              style={
                                isMacOSTheme
                                  ? {
                                      borderRadius: "8px",
                                      background: isRecent 
                                        ? "linear-gradient(to bottom, rgba(255, 255, 255, 0.85), rgba(250, 250, 250, 0.85))"
                                        : "linear-gradient(to bottom, rgba(255, 255, 255, 0.7), rgba(250, 250, 250, 0.7))",
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
                                    background: "linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.15))",
                                    borderRadius: "6px 6px 2px 2px",
                                    filter: "blur(0.5px)",
                                    pointerEvents: "none",
                                    zIndex: 1,
                                  }}
                                />
                              )}
                              <div className="flex items-start gap-3 relative z-10">
                                <div className={cn(
                                  "mt-0.5 p-1.5 rounded-full shrink-0",
                                  isRecent ? "bg-primary/10" : "bg-muted"
                                )}>
                                  <CheckCircle2 className={cn(
                                    "h-3 w-3",
                                    isRecent ? "text-primary" : "text-muted-foreground"
                                  )} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span 
                                      className="text-xs font-medium text-muted-foreground"
                                      style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                                    >
                                      {new Date(update.timestamp).toLocaleDateString()}
                                    </span>
                                    <span className="text-xs text-muted-foreground/60">•</span>
                                    <span 
                                      className="text-xs text-muted-foreground"
                                      style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                                    >
                                      {new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {isRecent && (
                                      <>
                                        <span className="text-xs text-muted-foreground/60">•</span>
                                        <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
                                          Recent
                                        </Badge>
                                      </>
                                    )}
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
                          );
                        })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent
          value="curation"
          className={cn(tabStyles.tabContentClasses, "flex-1 flex flex-col min-w-0 min-h-0")}
        >
          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4 pr-6">
              {/* Add Curation Suggestion Section */}
              <div className="space-y-4">
                <h2
                  className="text-lg font-semibold"
                  style={isMacOSTheme ? { textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)" } : {}}
                >
                  Add Curation Suggestion
                </h2>
                <div className="space-y-4">
                  <div className="min-w-0">
                    <Label style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                      Name
                    </Label>
                    <Input
                      value={curationName}
                      onChange={(e) => setCurationName(e.target.value)}
                      placeholder="Artist name"
                      className="w-full mt-2"
                    />
                  </div>
                  <div className="min-w-0">
                    <Label style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                      Work Link (Optional)
                    </Label>
                    <Input
                      type="url"
                      value={curationLink}
                      onChange={(e) => setCurationLink(e.target.value)}
                      placeholder="https://..."
                      className="w-full mt-2"
                    />
                  </div>
                  <Button
                    className={isMacOSTheme ? "aqua-button secondary" : ""}
                    onClick={() => {
                      onAddCurationSuggestion(
                        project.id,
                        curationName,
                        curationLink
                      );
                      setCurationName("");
                      setCurationLink("");
                    }}
                  >
                    Add Suggestion
                  </Button>
                </div>
              </div>

              {/* Separator */}
              <div className="border-t" />

              {/* Suggestions Section */}
              <div className="space-y-4">
                <h3 
                  className="font-semibold text-lg"
                  style={isMacOSTheme ? { textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)" } : {}}
                >
                  Suggestions
                </h3>
                {project.curationSuggestions.length === 0 ? (
                  <div className="text-muted-foreground text-sm py-8">
                    No suggestions yet. Add one above.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {project.curationSuggestions.map((suggestion) => {
                      const voteCount = Object.values(suggestion.votes).filter(
                        (v) => v
                      ).length;
                      const hasVoted = suggestion.votes[CURRENT_USER_ID] || false;
                      return (
                        <div
                          key={suggestion.id}
                          className={cn(
                            "p-4 rounded-lg relative overflow-hidden transition-all min-w-0",
                            isMacOSTheme ? "" : "bg-muted/50"
                          )}
                          style={
                            isMacOSTheme
                              ? {
                                  borderRadius: "8px",
                                  background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.7), rgba(250, 250, 250, 0.7))",
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
                                background: "linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.15))",
                                borderRadius: "6px 6px 2px 2px",
                                filter: "blur(0.5px)",
                                pointerEvents: "none",
                                zIndex: 1,
                              }}
                            />
                          )}
                          <div className="flex items-center justify-between gap-4 relative z-10 min-w-0">
                            <div className="flex-1 min-w-0">
                              <div 
                                className="font-medium"
                                style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.08)" } : {}}
                              >
                                {suggestion.name}
                              </div>
                              {suggestion.workLink && (
                                <a
                                  href={suggestion.workLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:underline block mt-1"
                                  style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                                >
                                  View Work
                                </a>
                              )}
                            </div>
                            <Button
                              variant={isMacOSTheme ? "aqua_select" : "outline"}
                              size="sm"
                              onClick={() =>
                                onVoteCuration(
                                  project.id,
                                  suggestion.id,
                                  CURRENT_USER_ID
                                )
                              }
                              className={cn(
                                "shrink-0",
                                hasVoted && !isMacOSTheme ? "bg-blue-100" : ""
                              )}
                              data-state={hasVoted ? "on" : "off"}
                            >
                              👍 {voteCount}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent
          value="lineup"
          className={cn(tabStyles.tabContentClasses, "flex-1 flex flex-col min-w-0 min-h-0")}
        >
          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4 pr-6">
              {/* Final Lineup Section */}
              <div className="space-y-4">
                <h2
                  className="text-lg font-semibold"
                  style={isMacOSTheme ? { textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)" } : {}}
                >
                  Final Lineup
                </h2>
                {project.finalLineup.length === 0 ? (
                  <div className="text-muted-foreground text-sm py-4">
                    No DJs assigned yet. Search and assign below.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {project.finalLineup.map((djId) => {
                      const dj = allDJs.find((d) => d.id === djId);
                      if (!dj) return null;
                      return (
                        <Card
                          key={dj.id}
                          className={cn(
                            "relative overflow-hidden transition-all cursor-pointer w-full min-w-0",
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
                          onClick={() => onAssignDJ(project.id, dj.id)}
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

              {/* Search DJ Database Section */}
              <div className="space-y-4">
                <h2
                  className="text-lg font-semibold"
                  style={isMacOSTheme ? { textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)" } : {}}
                >
                  Search DJ Database
                </h2>
                <div className="space-y-3 min-w-0">
                  <Input
                    value={djSearchQuery}
                    onChange={(e) => onDJSearchChange(e.target.value)}
                    placeholder="Search by name, artist name, location..."
                    className="w-full"
                  />
                  <Button
                    variant={isMacOSTheme ? "aqua_select" : "outline"}
                    onClick={() => onShowAddDJDialog(!showAddDJDialog)}
                  >
                    {showAddDJDialog ? "Cancel" : "Add New DJ"}
                  </Button>
                </div>
                
                {/* Add New DJ Form */}
                {showAddDJDialog && (
                  <div className={cn(
                    "p-4 rounded-lg space-y-4 border",
                    isMacOSTheme ? "" : "bg-muted/30"
                  )}
                  style={
                    isMacOSTheme
                      ? {
                          borderRadius: "8px",
                          background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.7), rgba(250, 250, 250, 0.7))",
                          border: "1px solid rgba(0, 0, 0, 0.08)",
                          boxShadow: `
                            inset 0 1px 1px rgba(255, 255, 255, 0.6),
                            inset 0 0 2px rgba(0, 0, 0, 0.03)
                          `,
                        }
                      : {}
                  }>
                    <h3
                      className="text-sm font-semibold"
                      style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                    >
                      Add New DJ to Database
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <Label className="text-xs mb-2 flex items-center gap-2">
                          <User className="h-3 w-3" />
                          Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={newDJForm.name || ""}
                          onChange={(e) => onNewDJFormChange({ ...newDJForm, name: e.target.value })}
                          placeholder="Real name"
                          className="w-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <Label className="text-xs mb-2 flex items-center gap-2">
                          <Music className="h-3 w-3" />
                          Artist Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={newDJForm.artistName || ""}
                          onChange={(e) => onNewDJFormChange({ ...newDJForm, artistName: e.target.value })}
                          placeholder="Stage/artist name"
                          className="w-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <Label className="text-xs mb-2 flex items-center gap-2">
                          <MapPin className="h-3 w-3" />
                          Location <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={newDJForm.location || ""}
                          onChange={(e) => onNewDJFormChange({ ...newDJForm, location: e.target.value })}
                          placeholder="City, Country"
                          className="w-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <Label className="text-xs mb-2 flex items-center gap-2">
                          <User className="h-3 w-3" />
                          Creative Disciplines <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={newDJForm.creativeDisciplines || ""}
                          onChange={(e) => onNewDJFormChange({ ...newDJForm, creativeDisciplines: e.target.value })}
                          placeholder="e.g., DJ / Producer / Live performer"
                          className="w-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <Label className="text-xs mb-2 flex items-center gap-2">
                          <Music className="h-3 w-3" />
                          Genre
                        </Label>
                        <Input
                          value={newDJForm.genre || ""}
                          onChange={(e) => onNewDJFormChange({ ...newDJForm, genre: e.target.value })}
                          placeholder="e.g., Techno, House, Multi genre"
                          className="w-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <Label className="text-xs mb-2 flex items-center gap-2">
                          <LinkIcon className="h-3 w-3" />
                          Contact Details
                        </Label>
                        <Input
                          value={newDJForm.contactDetails || ""}
                          onChange={(e) => onNewDJFormChange({ ...newDJForm, contactDetails: e.target.value })}
                          placeholder="Email or contact info"
                          className="w-full"
                        />
                      </div>
                      <div className="min-w-0 md:col-span-2">
                        <Label className="text-xs mb-2 flex items-center gap-2">
                          <LinkIcon className="h-3 w-3" />
                          Links to Work
                        </Label>
                        <Input
                          value={newDJForm.linksToWork || ""}
                          onChange={(e) => onNewDJFormChange({ ...newDJForm, linksToWork: e.target.value })}
                          placeholder="Website, SoundCloud, Bandcamp, etc."
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        className={isMacOSTheme ? "aqua-button secondary" : ""}
                        onClick={() => {
                          onAddNewDJ();
                        }}
                        disabled={
                          !newDJForm.name ||
                          !newDJForm.artistName ||
                          !newDJForm.location ||
                          !newDJForm.creativeDisciplines
                        }
                      >
                        Add DJ
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          onNewDJFormChange({});
                          onShowAddDJDialog(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Separator */}
              <div className="border-t" />

              {/* DJ Database Results Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2
                    className="text-lg font-semibold"
                    style={isMacOSTheme ? { textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)" } : {}}
                  >
                    DJ Database Results
                  </h2>
                  {djs.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {djs.length} {djs.length === 1 ? "DJ" : "DJs"}
                    </Badge>
                  )}
                </div>
                {paginatedDJs.length > 0 && (
                  <div className={cn(
                    "text-sm text-muted-foreground p-3 rounded-md",
                    isMacOSTheme ? "" : "bg-muted/30"
                  )}
                  style={
                    isMacOSTheme
                      ? {
                          background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.5), rgba(250, 250, 250, 0.5))",
                          border: "1px solid rgba(0, 0, 0, 0.06)",
                          textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)",
                        }
                      : {}
                  }>
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Tap or click an artist card to assign them to the final lineup
                    </span>
                  </div>
                )}
                {paginatedDJs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No DJs found</p>
                    <p className="text-xs mt-1">
                      {djSearchQuery ? "Try adjusting your search query" : "Add a new DJ above"}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full min-w-0", isMobile && "gap-3")}>
                      {paginatedDJs.map((dj) => {
                        const isAssigned = project.finalLineup.includes(dj.id);
                        return (
                          <Card
                            key={dj.id}
                            className={cn(
                              "relative overflow-hidden transition-all cursor-pointer w-full min-w-0",
                              isMacOSTheme && "border-none",
                              isAssigned && "ring-2 ring-primary"
                            )}
                            style={
                              isMacOSTheme
                                ? {
                                    borderRadius: "8px",
                                    background: isAssigned
                                      ? "linear-gradient(to bottom, rgba(48, 123, 201, 0.1), rgba(152, 189, 228, 0.1))"
                                      : "linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(245, 245, 245, 0.95))",
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
                            onClick={() => onAssignDJ(project.id, dj.id)}
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
                                  {isAssigned && (
                                    <Badge variant="default" className="text-xs shrink-0">
                                      Assigned
                                    </Badge>
                                  )}
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
                    
                    {totalDJPages > 1 && (
                      <div className={cn("flex items-center justify-between pt-4 border-t w-full min-w-0 flex-wrap gap-2", isMobile && "flex-col items-stretch")}>
                        <div className={cn("text-sm text-muted-foreground shrink-0", isMobile && "text-center mb-2")}>
                          Showing {startDJIndex + 1}-{Math.min(endDJIndex, djs.length)} of {djs.length}
                        </div>
                        <div className="flex items-center justify-center gap-2 shrink-0 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDJSearchPageChange(Math.max(1, djSearchPage - 1))}
                            disabled={djSearchPage === 1}
                            className={isMacOSTheme ? "aqua-button secondary" : ""}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          <div className="text-sm text-muted-foreground px-2">
                            Page {djSearchPage} of {totalDJPages}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDJSearchPageChange(Math.min(totalDJPages, djSearchPage + 1))}
                            disabled={djSearchPage === totalDJPages}
                            className={isMacOSTheme ? "aqua-button secondary" : ""}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
