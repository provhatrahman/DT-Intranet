import { useState, useEffect } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { PitchMenuBar } from "./PitchMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { helpItems, appMetadata } from "..";
import { useThemeStore } from "@/stores/useThemeStore";
import { Offer } from "@/apps/incoming-offers/data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getTabStyles } from "@/utils/tabStyles";
import { Trash2 } from "lucide-react";

export function PitchAppComponent({
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
  const [activeTab, setActiveTab] = useState("new");
  const [pitchedProjects, setPitchedProjects] = useState<Offer[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pitchToDelete, setPitchToDelete] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keyDates, setKeyDates] = useState("");
  const [venue, setVenue] = useState("");
  const [budget, setBudget] = useState("");
  const [timelines, setTimelines] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const currentTheme = useThemeStore((state) => state.current);
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  const isMacOSTheme = currentTheme === "macosx";
  const isMobile = useIsMobile();
  const tabStyles = getTabStyles(currentTheme);

  // Load pitched projects from localStorage
  useEffect(() => {
    const loadPitchedProjects = () => {
      try {
        const savedOffersJson = localStorage.getItem("incoming_offers_list");
        if (savedOffersJson) {
          const parsed = JSON.parse(savedOffersJson);
          if (Array.isArray(parsed)) {
            // Filter to only show pitches (source === "pitch")
            const pitches = parsed.filter((offer: Offer) => offer.source === "pitch");
            setPitchedProjects(pitches);
          }
        }
      } catch (error) {
        console.error("Failed to load pitched projects:", error);
        setPitchedProjects([]);
      }
    };

    loadPitchedProjects();

    // Listen for updates from pitch submissions
    const handleOffersUpdate = () => {
      loadPitchedProjects();
    };

    window.addEventListener("offers-updated", handleOffersUpdate);
    return () => {
      window.removeEventListener("offers-updated", handleOffersUpdate);
    };
  }, []);

  const handleDeleteClick = (pitchId: string) => {
    setPitchToDelete(pitchId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!pitchToDelete) return;
    
    try {
      const savedOffersJson = localStorage.getItem("incoming_offers_list");
      if (savedOffersJson) {
        const parsed = JSON.parse(savedOffersJson);
        if (Array.isArray(parsed)) {
          // Remove the pitch from the list
          const updatedOffers = parsed.filter((offer: Offer) => offer.id !== pitchToDelete);
          localStorage.setItem("incoming_offers_list", JSON.stringify(updatedOffers));
          
          // Update local state
          setPitchedProjects((prev) => prev.filter((p) => p.id !== pitchToDelete));
          
          // Trigger update event to notify Inbox app
          window.dispatchEvent(new CustomEvent("offers-updated"));
        }
      }
    } catch (error) {
      console.error("Failed to delete pitch:", error);
    }
    
    setDeleteConfirmOpen(false);
    setPitchToDelete(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!name.trim() || !description.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Create new offer from pitch with unique ID (timestamp + random to avoid collisions)
      const newOffer: Offer = {
        id: `pitch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: name.trim(),
        description: description.trim(),
        promoter: "Internal Pitch",
        venue: venue.trim() || "TBD",
        date: keyDates.trim() || "TBD",
        fee: budget.trim() || "TBD",
        timings: timelines.trim() || "TBD",
        source: "pitch",
        status: "new",
        submittedAt: new Date().toISOString(),
      };

      // Get existing offers from localStorage with error handling
      let existingOffers: Offer[] = [];
      try {
        const existingOffersJson = localStorage.getItem("incoming_offers_list");
        if (existingOffersJson) {
          const parsed = JSON.parse(existingOffersJson);
          // Validate it's an array
          if (Array.isArray(parsed)) {
            existingOffers = parsed;
          } else {
            console.warn("Invalid offers data in localStorage, resetting");
            localStorage.removeItem("incoming_offers_list");
          }
        }
      } catch (parseError) {
        console.error("Failed to parse existing offers from localStorage:", parseError);
        // Clear corrupted data
        localStorage.removeItem("incoming_offers_list");
        existingOffers = [];
      }

      // Filter out any existing offers with the same ID (shouldn't happen, but safety check)
      const existingIds = new Set(existingOffers.map(o => o.id));
      if (existingIds.has(newOffer.id)) {
        // Regenerate ID if collision (extremely unlikely)
        newOffer.id = `pitch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }

      // Add new offer
      const updatedOffers = [...existingOffers, newOffer];
      
      try {
        localStorage.setItem("incoming_offers_list", JSON.stringify(updatedOffers));
      } catch (storageError) {
        console.error("Failed to save offer to localStorage:", storageError);
        throw new Error("Failed to save pitch. Please try again.");
      }

      // Reset form
      setName("");
      setDescription("");
      setKeyDates("");
      setVenue("");
      setBudget("");
      setTimelines("");

      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);

      // Trigger a custom event to notify inbox app to refresh
      window.dispatchEvent(new CustomEvent("offers-updated"));
      
      // Switch to "My Pitches" tab after successful submission
      setActiveTab("pitches");
    } catch (error) {
      console.error("Failed to submit pitch:", error);
      // Could show error message to user here if needed
    } finally {
      setIsSubmitting(false);
    }
  };

  const menuBar = (
    <PitchMenuBar
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
        title="Pitch"
        onClose={onClose}
        isForeground={isForeground}
        appId="pitch"
        skipInitialSound={skipInitialSound}
        instanceId={instanceId}
        onNavigateNext={onNavigateNext}
        onNavigatePrevious={onNavigatePrevious}
        menuBar={isXpTheme ? menuBar : undefined}
        windowConstraints={{
          minWidth: 500,
          minHeight: 600,
        }}
      >
        <div 
          className={cn(
            "flex flex-col h-full text-foreground",
            isMacOSTheme ? "bg-gradient-to-b from-[#ECECEC] to-[#E5E5E5]" : "bg-background"
          )}
        >
          <div 
            className={cn(
              "flex-1 overflow-auto flex flex-col",
              isMobile 
                ? (isMacOSTheme ? "px-4 pt-2 pb-4" : "px-4 pt-2 pb-4 bg-muted/10")
                : (isMacOSTheme ? "px-6 pt-2 pb-6" : "px-6 pt-2 pb-6 bg-muted/10")
            )}
            style={isMacOSTheme ? { background: "transparent" } : undefined}
          >
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
              <div className="mb-1">
                <TabsList className={tabStyles.tabListClasses}>
                  <TabsTrigger className={tabStyles.tabTriggerClasses} value="new">
                    New Pitch
                  </TabsTrigger>
                  <TabsTrigger className={tabStyles.tabTriggerClasses} value="pitches">
                    My Pitches ({pitchedProjects.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent 
                value="new" 
                className={cn(
                  tabStyles.tabContentClasses,
                  "flex-1 overflow-auto min-h-0",
                  isMobile ? (isMacOSTheme ? "p-4" : "p-4") : (isMacOSTheme ? "p-8" : "p-8")
                )}
              >
                <form onSubmit={handleSubmit} className={cn(
                  "mx-auto space-y-6",
                  isMobile ? "max-w-full" : "max-w-2xl"
                )}>
              <div className="space-y-2">
                <Label 
                  htmlFor="name" 
                  className="text-sm font-medium"
                  style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                >
                  Name *
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name"
                  required
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label 
                  htmlFor="description" 
                  className="text-sm font-medium"
                  style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                >
                  Description/Idea *
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your project idea..."
                  required
                  className="w-full min-h-[120px]"
                />
              </div>

              <div className="space-y-2">
                <Label 
                  htmlFor="keyDates" 
                  className="text-sm font-medium"
                  style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                >
                  Key Date(s)
                </Label>
                <Input
                  id="keyDates"
                  value={keyDates}
                  onChange={(e) => setKeyDates(e.target.value)}
                  placeholder="e.g., 2024-07-15 or July 2024"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label 
                  htmlFor="venue" 
                  className="text-sm font-medium"
                  style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                >
                  Venue/Location
                </Label>
                <Input
                  id="venue"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g., Hyde Park, London"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label 
                  htmlFor="budget" 
                  className="text-sm font-medium"
                  style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                >
                  Budget
                </Label>
                <Input
                  id="budget"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g., £5,000"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label 
                  htmlFor="timelines" 
                  className="text-sm font-medium"
                  style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                >
                  Timelines
                </Label>
                <Input
                  id="timelines"
                  value={timelines}
                  onChange={(e) => setTimelines(e.target.value)}
                  placeholder="e.g., 16:00 - 17:00 or Q2 2024"
                  className="w-full"
                />
              </div>

              {submitSuccess && (
                <div 
                  className={cn(
                    "p-3 rounded-md text-sm",
                    isMacOSTheme 
                      ? "border"
                      : "bg-green-50 text-green-900"
                  )}
                  style={isMacOSTheme ? {
                    background: "linear-gradient(to bottom, rgba(220, 252, 231, 0.95), rgba(187, 247, 208, 0.95))",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    boxShadow: `
                      0 2px 4px rgba(0, 0, 0, 0.14),
                      0 1px 1px rgba(0, 0, 0, 0.25),
                      inset 0 1px 2px rgba(255, 255, 255, 0.6),
                      inset 0 0 4px rgba(0, 0, 0, 0.05),
                      inset 0 0 0 0.5px rgba(0, 0, 0, 0.48),
                      inset 0 0 0 1px rgba(0, 0, 0, 0.08)
                    `,
                    borderRadius: "6px",
                    color: "#166534",
                    textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)",
                    WebkitFontSmoothing: "antialiased",
                  } : {}}
                >
                  Pitch submitted successfully! Check Inbox to see it.
                </div>
              )}

              <div className={cn(
                "flex gap-3 pt-4",
                isMobile && "flex-col"
              )}>
                {isMacOSTheme ? (
                  <button
                    type="submit"
                    disabled={isSubmitting || !name.trim() || !description.trim()}
                    className={cn(
                      "aqua-button primary flex-1 touch-manipulation",
                      isMobile && "min-h-[44px] w-full",
                      (isSubmitting || !name.trim() || !description.trim()) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span>{isSubmitting ? "Submitting..." : "Submit Pitch"}</span>
                  </button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting || !name.trim() || !description.trim()}
                    className={cn(
                      "flex-1",
                      isMobile && "min-h-[44px] w-full touch-manipulation"
                    )}
                  >
                    {isSubmitting ? "Submitting..." : "Submit Pitch"}
                  </Button>
                )}
                {isMacOSTheme ? (
                  <button
                    type="button"
                    onClick={() => {
                      setName("");
                      setDescription("");
                      setKeyDates("");
                      setVenue("");
                      setBudget("");
                      setTimelines("");
                      setSubmitSuccess(false);
                    }}
                    className={cn(
                      "aqua-button secondary touch-manipulation",
                      isMobile && "min-h-[44px] w-full"
                    )}
                  >
                    <span>Clear</span>
                  </button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setName("");
                      setDescription("");
                      setKeyDates("");
                      setVenue("");
                      setBudget("");
                      setTimelines("");
                      setSubmitSuccess(false);
                    }}
                    className={cn(
                      isMobile && "min-h-[44px] w-full touch-manipulation"
                    )}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </form>
              </TabsContent>

              <TabsContent 
                value="pitches" 
                className={cn(
                  tabStyles.tabContentClasses,
                  "flex-1 overflow-auto min-h-0",
                  isMobile ? (isMacOSTheme ? "p-4" : "p-4") : (isMacOSTheme ? "p-8" : "p-8")
                )}
              >
                <div className={cn(
                  "mx-auto space-y-4",
                  isMobile ? "max-w-full" : "max-w-4xl"
                )}>
                  {pitchedProjects.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className={cn("mb-2", isMobile ? "text-base" : "text-lg")}>No pitches yet</p>
                      <p className={cn(isMobile ? "text-xs" : "text-sm")}>Submit your first pitch using the "New Pitch" tab</p>
                    </div>
                  ) : (
                    <div className={cn(
                      "grid gap-4",
                      isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
                    )}>
                      {pitchedProjects.map((project) => {
                        const status = project.status === "reviewed" ? "approved" : "pending";
                        const hasFeedback = project.feedback && project.feedback.length > 0;
                        const statusColor = status === "approved" 
                          ? (isMacOSTheme ? "bg-green-100 text-green-800 border-green-300" : "bg-green-50 text-green-900")
                          : (isMacOSTheme ? "bg-yellow-100 text-yellow-800 border-yellow-300" : "bg-yellow-50 text-yellow-900");
                        
                        return (
                          <Card key={project.id} className={cn(
                            isMacOSTheme && "border shadow-sm bg-gradient-to-b from-white/95 to-gray-50/95",
                            "group"
                          )}
                          style={isMacOSTheme ? {
                            borderRadius: "8px",
                            border: "1px solid rgba(0, 0, 0, 0.15)",
                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 1px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
                          } : {}}
                          >
                            <CardHeader className={cn(
                              "px-6 py-2.5",
                              isMobile && "px-4 py-2"
                            )}
                              style={isMacOSTheme ? {
                                background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.6), rgba(245, 245, 245, 0.6))",
                                borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
                                borderRadius: "8px 8px 0 0",
                              } : {}}
                            >
                              <div className="flex items-center gap-3">
                                <CardTitle className={cn(
                                  "font-semibold line-clamp-2 flex-1 min-w-0",
                                  isMobile ? "text-base" : "text-lg"
                                )}
                                style={isMacOSTheme ? {
                                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                                  WebkitFontSmoothing: "antialiased",
                                } : {}}
                                >
                                  {project.name}
                                </CardTitle>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isMacOSTheme ? (
                                    <span
                                      className={cn(
                                        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium relative overflow-hidden whitespace-nowrap",
                                        status === "approved"
                                          ? "bg-gradient-to-b from-green-200/90 to-green-300/90 text-green-900"
                                          : "bg-gradient-to-b from-yellow-200/90 to-yellow-300/90 text-yellow-900",
                                        isMobile && "text-xs px-1.5"
                                      )}
                                      style={{
                                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.6)",
                                        textShadow: "0 1px 1px rgba(0, 0, 0, 0.1)",
                                        WebkitFontSmoothing: "antialiased",
                                      }}
                                    >
                                      <span className="relative z-10">{status === "approved" ? "Approved" : "Pending"}</span>
                                    </span>
                                  ) : (
                                    <Badge 
                                      className={cn(
                                        statusColor,
                                        isMobile && "text-xs px-2 py-0.5"
                                      )}
                                    >
                                      {status === "approved" ? "Approved" : "Pending"}
                                    </Badge>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClick(project.id);
                                    }}
                                    className={cn(
                                      "transition-opacity rounded touch-manipulation flex items-center justify-center",
                                      isMobile 
                                        ? "opacity-100 p-2 min-w-[44px] min-h-[44px]"
                                        : "opacity-0 group-hover:opacity-100 p-1.5 min-w-[32px] min-h-[32px]",
                                      isMacOSTheme
                                        ? "hover:bg-gray-200 active:bg-gray-300 text-gray-600 hover:text-red-600 active:text-red-700"
                                        : "hover:bg-muted active:bg-muted/80 text-muted-foreground hover:text-destructive active:text-destructive"
                                    )}
                                    title="Delete pitch"
                                    aria-label="Delete pitch"
                                  >
                                    <Trash2 className={cn(
                                      isMobile ? "h-5 w-5" : "h-4 w-4",
                                      isMacOSTheme && !isMobile && "text-[12px]"
                                    )} />
                                  </button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className={cn(
                              "px-6 pt-4 pb-6 space-y-2",
                              isMobile && "px-4 pt-3 pb-4"
                            )}
                              style={isMacOSTheme ? {
                                textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)",
                                WebkitFontSmoothing: "antialiased",
                              } : {}}
                            >
                              <CardDescription className={cn(
                                "line-clamp-3",
                                isMobile && "text-sm"
                              )}>
                                {project.description}
                              </CardDescription>
                              <div className={cn(
                                "space-y-1 text-muted-foreground",
                                isMobile ? "text-xs" : "text-sm"
                              )}>
                                {project.venue !== "TBD" && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-medium">Venue:</span>
                                    <span>{project.venue}</span>
                                  </div>
                                )}
                                {project.date !== "TBD" && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-medium">Date:</span>
                                    <span>{project.date}</span>
                                  </div>
                                )}
                                {project.fee !== "TBD" && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-medium">Budget:</span>
                                    <span>{project.fee}</span>
                                  </div>
                                )}
                                {project.timings !== "TBD" && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-medium">Timelines:</span>
                                    <span>{project.timings}</span>
                                  </div>
                                )}
                              </div>
                              {hasFeedback && (
                                <div className={cn(
                                  "mt-4 pt-4 border-t",
                                  isMacOSTheme ? "border-gray-300" : "border-border"
                                )}>
                                  <div className={cn(
                                    "font-semibold mb-2 text-muted-foreground",
                                    isMobile ? "text-xs" : "text-xs"
                                  )}>
                                    Anonymous Feedback:
                                  </div>
                                  <div className="space-y-2">
                                    {project.feedback!.map((feedback, index) => (
                                      <div
                                        key={index}
                                        className={cn(
                                          "rounded-md",
                                          isMobile ? "text-xs p-2.5" : "text-sm p-3",
                                          isMacOSTheme
                                            ? "bg-gradient-to-b from-gray-50/90 to-gray-100/90 border border-gray-200/80"
                                            : "bg-muted/50"
                                        )}
                                        style={isMacOSTheme ? {
                                          boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.05)",
                                          textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)",
                                        } : {}}
                                      >
                                        {feedback}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <HelpDialog
          isOpen={isHelpDialogOpen}
          onOpenChange={setIsHelpDialogOpen}
          helpItems={helpItems}
          appId="pitch" 
        />
        <AboutDialog
          isOpen={isAboutDialogOpen}
          onOpenChange={setIsAboutDialogOpen}
          metadata={appMetadata}
          appId="pitch"
        />
        <ConfirmDialog
          isOpen={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          onConfirm={handleDeleteConfirm}
          title="Delete Pitch"
          description="Are you sure you want to delete this pitch? This action cannot be undone and it will be removed from the Inbox."
        />
      </WindowFrame>
    </>
  );
}
