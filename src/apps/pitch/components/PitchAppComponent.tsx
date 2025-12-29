import { useState, useEffect } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { PitchMenuBar } from "./PitchMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { helpItems, appMetadata } from "..";
import { useThemeStore } from "@/stores/useThemeStore";
import { useAuth } from "@/hooks/useAuth";
import { useGreenroomAccountStore } from "@/stores/useGreenroomAccountStore";
import { usePitchesStore } from "@/stores/usePitchesStore";
import { serializePitchDescription, parsePitchDescription } from "@/lib/api/pitches";
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
import { Trash2, AlertCircle, Settings } from "lucide-react";
import { toast } from "sonner";

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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pitchToDelete, setPitchToDelete] = useState<number | null>(null);
  const [accountSetupOpen, setAccountSetupOpen] = useState(false);
  const [greenroomUserIdInput, setGreenroomUserIdInput] = useState("");
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keyDates, setKeyDates] = useState("");
  const [venue, setVenue] = useState("");
  const [budget, setBudget] = useState("");
  const [timelines, setTimelines] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { username } = useAuth();
  const { getAccount, setAccount } = useGreenroomAccountStore();
  const currentAccount = getAccount(username);
  const greenroomUserId = currentAccount?.greenroomUserId ?? null;

  const {
    pitches,
    pitchDetails,
    isLoading,
    error,
    fetchPitches,
    createPitch,
    deletePitch,
    getCurrentUserPitches,
    clearError,
  } = usePitchesStore();

  const currentTheme = useThemeStore((state) => state.current);
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  const isMacOSTheme = currentTheme === "macosx";
  const isMobile = useIsMobile();
  const tabStyles = getTabStyles(currentTheme);

  const userPitches = getCurrentUserPitches(greenroomUserId);

  useEffect(() => {
    if (isWindowOpen) {
      fetchPitches().catch((err) => {
        console.error("Failed to fetch pitches:", err);
      });
    }
  }, [isWindowOpen, fetchPitches]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handleAccountSetup = () => {
    const userId = parseInt(greenroomUserIdInput.trim(), 10);
    if (isNaN(userId) || userId <= 0) {
      toast.error("Please enter a valid user ID");
      return;
    }
    if (username) {
      setAccount(username, {
        greenroomUserId: userId,
        displayName: username,
      });
      setAccountSetupOpen(false);
      setGreenroomUserIdInput("");
      toast.success("Greenroom account linked successfully");
    }
  };

  const handleDeleteClick = (pitchId: number) => {
    setPitchToDelete(pitchId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pitchToDelete) return;
    
    try {
      await deletePitch(pitchToDelete);
      toast.success("Pitch deleted successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete pitch";
      toast.error(message);
    }
    
    setDeleteConfirmOpen(false);
    setPitchToDelete(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!name.trim() || !description.trim()) {
      return;
    }

    if (!greenroomUserId) {
      setAccountSetupOpen(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const fullDescription = serializePitchDescription(description.trim(), {
        keyDates: keyDates.trim() || undefined,
        venue: venue.trim() || undefined,
        budget: budget.trim() || undefined,
        timelines: timelines.trim() || undefined,
      });

      await createPitch({
        submitter_user_id: greenroomUserId,
        title: name.trim(),
        description: fullDescription,
        status: "submitted",
      });

      setName("");
      setDescription("");
      setKeyDates("");
      setVenue("");
      setBudget("");
      setTimelines("");
      setSubmitError(null);

      toast.success("Pitch submitted successfully!");
      setActiveTab("pitches");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit pitch";
      setSubmitError(message);
      toast.error(message);
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
            {!greenroomUserId && (
              <div 
                className={cn(
                  "mb-4 p-4 rounded-md border",
                  isMacOSTheme 
                    ? "bg-gradient-to-b from-yellow-50/90 to-yellow-100/90 border-yellow-300"
                    : "bg-yellow-50 border-yellow-200"
                )}
                style={isMacOSTheme ? {
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.6)",
                } : {}}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className={cn(
                    "mt-0.5 shrink-0",
                    isMacOSTheme ? "text-yellow-800" : "text-yellow-600"
                  )} />
                  <div className="flex-1">
                    <p className={cn(
                      "font-medium mb-1",
                      isMacOSTheme ? "text-yellow-900" : "text-yellow-800"
                    )}>
                      Greenroom Account Required
                    </p>
                    <p className={cn(
                      "text-sm mb-3",
                      isMacOSTheme ? "text-yellow-800" : "text-yellow-700"
                    )}>
                      You need to link your Greenroom user ID to submit pitches. This links your submissions to your account.
                    </p>
                    <Button
                      onClick={() => setAccountSetupOpen(true)}
                      size="sm"
                      className={cn(
                        isMacOSTheme && "aqua-button primary"
                      )}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Set Up Account
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
              <div className="mb-1">
                <TabsList className={tabStyles.tabListClasses}>
                  <TabsTrigger className={tabStyles.tabTriggerClasses} value="new">
                    New Pitch
                  </TabsTrigger>
                  <TabsTrigger className={tabStyles.tabTriggerClasses} value="pitches">
                    My Pitches ({userPitches.length})
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
                      disabled={!greenroomUserId}
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
                      disabled={!greenroomUserId}
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
                      disabled={!greenroomUserId}
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
                      disabled={!greenroomUserId}
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
                      disabled={!greenroomUserId}
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
                      disabled={!greenroomUserId}
                    />
                  </div>

                  {submitError && (
                    <div 
                      className={cn(
                        "p-3 rounded-md text-sm",
                        isMacOSTheme 
                          ? "border border-red-300 bg-red-50/90"
                          : "bg-red-50 text-red-900"
                      )}
                    >
                      {submitError}
                    </div>
                  )}

                  <div className={cn(
                    "flex gap-3 pt-4",
                    isMobile && "flex-col"
                  )}>
                    {isMacOSTheme ? (
                      <button
                        type="submit"
                        disabled={isSubmitting || !name.trim() || !description.trim() || !greenroomUserId}
                        className={cn(
                          "aqua-button primary flex-1 touch-manipulation",
                          isMobile && "min-h-[44px] w-full",
                          (isSubmitting || !name.trim() || !description.trim() || !greenroomUserId) && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <span>{isSubmitting ? "Submitting..." : "Submit Pitch"}</span>
                      </button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={isSubmitting || !name.trim() || !description.trim() || !greenroomUserId}
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
                          setSubmitError(null);
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
                          setSubmitError(null);
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
                  {isLoading && userPitches.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className={cn(isMobile ? "text-base" : "text-lg")}>Loading pitches...</p>
                    </div>
                  ) : userPitches.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className={cn("mb-2", isMobile ? "text-base" : "text-lg")}>No pitches yet</p>
                      <p className={cn(isMobile ? "text-xs" : "text-sm")}>Submit your first pitch using the "New Pitch" tab</p>
                    </div>
                  ) : (
                    <div className={cn(
                      "grid gap-4",
                      isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
                    )}>
                      {userPitches.map((pitch) => {
                        const detail = pitchDetails[pitch.id];
                        const { description: pitchDescription, metadata } = parsePitchDescription(pitch.description);
                        const status = pitch.status;
                        const statusDisplay = status === "approved" ? "Approved" : 
                                            status === "rejected" ? "Rejected" :
                                            status === "implemented" ? "Implemented" :
                                            status === "closed" ? "Closed" : "Pending";
                        const statusColor = status === "approved" || status === "implemented"
                          ? (isMacOSTheme ? "bg-green-100 text-green-800 border-green-300" : "bg-green-50 text-green-900")
                          : status === "rejected" || status === "closed"
                          ? (isMacOSTheme ? "bg-red-100 text-red-800 border-red-300" : "bg-red-50 text-red-900")
                          : (isMacOSTheme ? "bg-yellow-100 text-yellow-800 border-yellow-300" : "bg-yellow-50 text-yellow-900");
                        
                        const voteSummary = pitch.total_votes !== undefined && pitch.yes_votes !== undefined
                          ? `${pitch.yes_votes}/${pitch.total_votes} votes`
                          : null;

                        const comments = detail?.comments || [];
                        
                        return (
                          <Card key={pitch.id} className={cn(
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
                                  {pitch.title}
                                </CardTitle>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isMacOSTheme ? (
                                    <span
                                      className={cn(
                                        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium relative overflow-hidden whitespace-nowrap",
                                        status === "approved" || status === "implemented"
                                          ? "bg-gradient-to-b from-green-200/90 to-green-300/90 text-green-900"
                                          : status === "rejected" || status === "closed"
                                          ? "bg-gradient-to-b from-red-200/90 to-red-300/90 text-red-900"
                                          : "bg-gradient-to-b from-yellow-200/90 to-yellow-300/90 text-yellow-900",
                                        isMobile && "text-xs px-1.5"
                                      )}
                                      style={{
                                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.6)",
                                        textShadow: "0 1px 1px rgba(0, 0, 0, 0.1)",
                                        WebkitFontSmoothing: "antialiased",
                                      }}
                                    >
                                      <span className="relative z-10">{statusDisplay}</span>
                                    </span>
                                  ) : (
                                    <Badge 
                                      className={cn(
                                        statusColor,
                                        isMobile && "text-xs px-2 py-0.5"
                                      )}
                                    >
                                      {statusDisplay}
                                    </Badge>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClick(pitch.id);
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
                                {pitchDescription}
                              </CardDescription>
                              <div className={cn(
                                "space-y-1 text-muted-foreground",
                                isMobile ? "text-xs" : "text-sm"
                              )}>
                                {metadata.venue && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-medium">Venue:</span>
                                    <span>{metadata.venue}</span>
                                  </div>
                                )}
                                {metadata.keyDates && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-medium">Date:</span>
                                    <span>{metadata.keyDates}</span>
                                  </div>
                                )}
                                {metadata.budget && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-medium">Budget:</span>
                                    <span>{metadata.budget}</span>
                                  </div>
                                )}
                                {metadata.timelines && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-medium">Timelines:</span>
                                    <span>{metadata.timelines}</span>
                                  </div>
                                )}
                                {voteSummary && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-medium">Votes:</span>
                                    <span>{voteSummary}</span>
                                  </div>
                                )}
                              </div>
                              {comments.length > 0 && (
                                <div className={cn(
                                  "mt-4 pt-4 border-t",
                                  isMacOSTheme ? "border-gray-300" : "border-border"
                                )}>
                                  <div className={cn(
                                    "font-semibold mb-2 text-muted-foreground",
                                    isMobile ? "text-xs" : "text-xs"
                                  )}>
                                    Comments ({comments.length}):
                                  </div>
                                  <div className="space-y-2">
                                    {comments.map((comment) => (
                                      <div
                                        key={comment.id}
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
                                        <div className="font-medium mb-1">{comment.username}</div>
                                        <div>{comment.comment}</div>
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
        <Dialog open={accountSetupOpen} onOpenChange={setAccountSetupOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Up Greenroom Account</DialogTitle>
              <DialogDescription>
                Enter your Greenroom user ID to link your account. This allows you to submit pitches and vote on others.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                type="number"
                placeholder="User ID (e.g., 9)"
                value={greenroomUserIdInput}
                onChange={(e) => setGreenroomUserIdInput(e.target.value)}
                className="w-full"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAccountSetup();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAccountSetupOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAccountSetup}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </WindowFrame>
    </>
  );
}
