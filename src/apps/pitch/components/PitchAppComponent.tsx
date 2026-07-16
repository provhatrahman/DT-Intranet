import { useState, useEffect } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { PitchMenuBar } from "./PitchMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { helpItems, appMetadata } from "..";
import { useAuth } from "@/hooks/useAuth";
import { useGreenroomAccountStore } from "@/stores/useGreenroomAccountStore";
import { useEffectiveGreenroomAccount } from "@/hooks/useGreenroomAccount";
import { usePitchesStore } from "@/stores/usePitchesStore";
import { serializePitchDescription, parsePitchDescription } from "@/lib/api/pitches";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AquaCard,
  EmptyState,
  Field,
  FormDialog,
  NoticePanel,
  StatusBadge,
  useOsTheme,
} from "@/components/greenroom";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getTabStyles } from "@/utils/tabStyles";
import { Trash2, AlertCircle, Settings, Lightbulb } from "lucide-react";
import { toast } from "sonner";

const PITCH_STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  implemented: "Implemented",
  closed: "Closed",
  under_review: "Under Review",
  draft: "Draft",
  submitted: "Submitted",
};

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
  const { setAccount } = useGreenroomAccountStore();
  const effectiveAccount = useEffectiveGreenroomAccount();
  const greenroomUserId = effectiveAccount.userId;

  const {
    pitches,
    pitchDetails,
    isLoading,
    error,
    fetchPitches,
    refreshPitch,
    createPitch,
    deletePitch,
    closePitch,
    getCurrentUserPitches,
    clearError,
  } = usePitchesStore();

  const { themeId, isMacTheme, isXpTheme } = useOsTheme();
  // Viewport-width based (not touch): a touch-enabled desktop keeps the
  // desktop layout instead of the full-width, stacked mobile layout.
  const isMobile = useMediaQuery("(max-width: 768px)");
  const tabStyles = getTabStyles(themeId);

  const userPitches = getCurrentUserPitches(greenroomUserId);

  useEffect(() => {
    if (isWindowOpen) {
      fetchPitches().catch((err) => {
        console.error("Failed to fetch pitches:", err);
      });
    }
  }, [isWindowOpen, fetchPitches]);

  // Load details (votes + comments) for the current user's pitches. The list
  // endpoint only returns summary fields, so without this the comment block on
  // each card would never populate. Mirrors the Incoming Offers app.
  useEffect(() => {
    if (!greenroomUserId) return;
    const missingDetailIds = pitchDetails
      ? userPitches.map((p) => p.id).filter((id) => !pitchDetails[id])
      : userPitches.map((p) => p.id);
    if (missingDetailIds.length === 0) return;
    Promise.all(
      missingDetailIds.map((id) =>
        refreshPitch(id).catch((err) =>
          console.error(`Failed to load pitch ${id}:`, err)
        )
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitches, pitchDetails, greenroomUserId, refreshPitch]);

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
      // The backend blocks deletion once a pitch has votes or comments (and
      // exposes no way to remove them), so fall back to withdrawing it.
      const message = error instanceof Error ? error.message : "Failed to delete pitch";
      if (message.toLowerCase().includes("votes or comments")) {
        try {
          await closePitch(pitchToDelete);
          toast.info(
            "This pitch already has votes or comments so it can't be deleted — it was withdrawn (closed) instead."
          );
        } catch (closeError) {
          const closeMessage =
            closeError instanceof Error
              ? closeError.message
              : "Failed to withdraw pitch";
          toast.error(closeMessage);
        }
      } else {
        toast.error(message);
      }
    }

    setDeleteConfirmOpen(false);
    setPitchToDelete(null);
  };

  const clearForm = () => {
    setName("");
    setDescription("");
    setKeyDates("");
    setVenue("");
    setBudget("");
    setTimelines("");
    setSubmitError(null);
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
        submitter_user_id: greenroomUserId!,
        title: name.trim(),
        description: fullDescription,
        status: "submitted",
      });

      clearForm();
      toast.success("Pitch submitted successfully!");
      setActiveTab("pitches");
    } catch (error) {
      let message = error instanceof Error ? error.message : "Failed to submit pitch";

      // Provide more context for user ID errors
      if (message.toLowerCase().includes("user id") || message.toLowerCase().includes("submitter")) {
        message = `${message} (User ID: ${greenroomUserId}, Source: ${effectiveAccount.source})`;
      }

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
            "flex flex-col h-full w-full text-foreground",
            !isMacTheme && "bg-background"
          )}
        >
          <div
            className={cn(
              "flex-1 overflow-auto flex flex-col @container",
              isMobile ? "px-4 pt-2 pb-4" : "px-6 pt-2 pb-6",
              !isMacTheme && "bg-muted/10"
            )}
          >
            {!greenroomUserId && (
              <NoticePanel
                tone="warning"
                icon={AlertCircle}
                title="Greenroom Account Required"
                className="mb-4"
              >
                <p className="mb-3">
                  You need to link your Greenroom user ID to submit pitches.
                  This links your submissions to your account.
                </p>
                <Button
                  variant="default"
                  onClick={() => setAccountSetupOpen(true)}
                  size="sm"
                  className="min-h-[32px] touch-manipulation"
                >
                  <span className="inline-flex items-center">
                    <Settings className="h-4 w-4 mr-2" />
                    Set Up Account
                  </span>
                </Button>
              </NoticePanel>
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
                  isMobile ? "p-4" : "p-8"
                )}
              >
                <form
                  onSubmit={handleSubmit}
                  className={cn(
                    "mx-auto space-y-5",
                    isMobile ? "max-w-full" : "max-w-2xl"
                  )}
                >
                  <Field label="Name" htmlFor="name" required className="space-y-2">
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Project name"
                      required
                      className="w-full"
                      disabled={!greenroomUserId}
                    />
                  </Field>

                  <Field
                    label="Description/Idea"
                    htmlFor="description"
                    required
                    className="space-y-2"
                  >
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe your project idea..."
                      required
                      className="w-full min-h-[120px]"
                      disabled={!greenroomUserId}
                    />
                  </Field>

                  {/* Optional metadata pairs up on wide windows, stacks on
                      narrow ones (container query = window width, not
                      viewport) */}
                  <div className="grid grid-cols-1 @lg:grid-cols-2 gap-x-4 gap-y-5">
                    <Field label="Key Date(s)" htmlFor="keyDates" className="space-y-2">
                      <Input
                        id="keyDates"
                        value={keyDates}
                        onChange={(e) => setKeyDates(e.target.value)}
                        placeholder="e.g., 2024-07-15 or July 2024"
                        className="w-full"
                        disabled={!greenroomUserId}
                      />
                    </Field>

                    <Field label="Venue/Location" htmlFor="venue" className="space-y-2">
                      <Input
                        id="venue"
                        value={venue}
                        onChange={(e) => setVenue(e.target.value)}
                        placeholder="e.g., Hyde Park, London"
                        className="w-full"
                        disabled={!greenroomUserId}
                      />
                    </Field>

                    <Field label="Budget" htmlFor="budget" className="space-y-2">
                      <Input
                        id="budget"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="e.g., £5,000"
                        className="w-full"
                        disabled={!greenroomUserId}
                      />
                    </Field>

                    <Field label="Timelines" htmlFor="timelines" className="space-y-2">
                      <Input
                        id="timelines"
                        value={timelines}
                        onChange={(e) => setTimelines(e.target.value)}
                        placeholder="e.g., 16:00 - 17:00 or Q2 2024"
                        className="w-full"
                        disabled={!greenroomUserId}
                      />
                    </Field>
                  </div>

                  {submitError && (
                    <NoticePanel tone="error" icon={AlertCircle}>
                      {submitError}
                    </NoticePanel>
                  )}

                  <div
                    className={cn(
                      "flex gap-3 pt-4",
                      isMobile && "flex-col"
                    )}
                  >
                    <Button
                      type="submit"
                      variant="default"
                      disabled={
                        isSubmitting ||
                        !name.trim() ||
                        !description.trim() ||
                        !greenroomUserId
                      }
                      className={cn(
                        "flex-1 touch-manipulation",
                        isMobile && "min-h-[44px] w-full"
                      )}
                    >
                      <span>{isSubmitting ? "Submitting..." : "Submit Pitch"}</span>
                    </Button>
                    <Button
                      type="button"
                      variant={isMacTheme ? "secondary" : "outline"}
                      onClick={clearForm}
                      className={cn(
                        "touch-manipulation",
                        isMobile && "min-h-[44px] w-full"
                      )}
                    >
                      <span>Clear</span>
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent
                value="pitches"
                className={cn(
                  tabStyles.tabContentClasses,
                  "flex-1 overflow-auto min-h-0 @container",
                  isMobile ? "p-4" : "p-8"
                )}
              >
                <div className="mx-auto space-y-4 max-w-4xl">
                  {isLoading && userPitches.length === 0 ? (
                    <EmptyState title="Loading pitches..." />
                  ) : userPitches.length === 0 ? (
                    <EmptyState
                      icon={Lightbulb}
                      title="No pitches yet"
                      hint='Submit your first pitch using the "New Pitch" tab'
                    />
                  ) : (
                    <div className="grid gap-4 grid-cols-1 @3xl:grid-cols-2">
                      {userPitches.map((pitch) => {
                        const detail = pitchDetails[pitch.id];
                        const { description: pitchDescription, metadata } =
                          parsePitchDescription(pitch.description);

                        const voteSummary =
                          pitch.total_votes !== undefined &&
                          pitch.yes_votes !== undefined
                            ? `${pitch.yes_votes}/${pitch.total_votes} votes`
                            : null;

                        // Feedback shown to the submitter combines two
                        // sources: comments left when a pitch is rejected
                        // (detail.comments) and the optional comments voters
                        // attach to their yes/no vote in the Inbox
                        // (detail.votes[].comment). Vote comments carry a
                        // sentiment badge so the submitter sees which way each
                        // reviewer voted and why.
                        const voteComments = (detail?.votes || [])
                          .filter((v) => v.comment && v.comment.trim())
                          .map((v) => ({
                            key: `vote-${v.user_id}`,
                            userId: v.user_id,
                            text: v.comment as string,
                            sentiment:
                              v.vote_value === 1
                                ? ("yes" as const)
                                : v.vote_value === -1
                                ? ("no" as const)
                                : null,
                          }));
                        const plainComments = (detail?.comments || []).map(
                          (c) => ({
                            key: `comment-${c.id}`,
                            userId: c.user_id,
                            text: c.comment,
                            sentiment: null,
                          })
                        );
                        // Anonymise feedback for the submitter — they see the
                        // comment and the vote sentiment, but never who left
                        // it. Each distinct reviewer gets a stable "Anonymous N"
                        // label (first-seen order) so multiple comments stay
                        // distinguishable without revealing identity.
                        const anonLabels = new Map<number, string>();
                        const feedback = [...voteComments, ...plainComments].map(
                          (item) => {
                            if (!anonLabels.has(item.userId)) {
                              anonLabels.set(
                                item.userId,
                                `Anonymous ${anonLabels.size + 1}`
                              );
                            }
                            return {
                              ...item,
                              displayName: anonLabels.get(item.userId)!,
                            };
                          }
                        );

                        return (
                          <AquaCard key={pitch.id} className="group overflow-hidden">
                            <CardHeader
                              className={cn(
                                "px-6 py-2.5",
                                isMobile && "px-4 py-2",
                                isMacTheme
                                  ? "border-b border-black/10"
                                  : "border-b"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <CardTitle
                                  className={cn(
                                    "font-semibold line-clamp-2 flex-1 min-w-0",
                                    isMobile ? "text-base" : "text-lg"
                                  )}
                                >
                                  {pitch.title}
                                </CardTitle>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <StatusBadge
                                    status={pitch.status}
                                    label={
                                      PITCH_STATUS_LABELS[pitch.status] ??
                                      "Submitted"
                                    }
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClick(pitch.id);
                                    }}
                                    className={cn(
                                      "transition-opacity rounded touch-manipulation flex items-center justify-center",
                                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                      isMobile
                                        ? "opacity-100 p-2 min-w-[44px] min-h-[44px]"
                                        : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 min-w-[32px] min-h-[32px]",
                                      isMacTheme
                                        ? "hover:bg-black/10 active:bg-black/15 text-gray-600 hover:text-red-600 active:text-red-700"
                                        : "hover:bg-muted active:bg-muted/80 text-muted-foreground hover:text-destructive active:text-destructive"
                                    )}
                                    title="Delete pitch"
                                    aria-label="Delete pitch"
                                  >
                                    <Trash2
                                      className={isMobile ? "h-5 w-5" : "h-4 w-4"}
                                    />
                                  </button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent
                              className={cn(
                                "px-6 pt-4 pb-6 space-y-2",
                                isMobile && "px-4 pt-3 pb-4"
                              )}
                            >
                              <CardDescription
                                className={cn("line-clamp-3", isMobile && "text-sm")}
                              >
                                {pitchDescription}
                              </CardDescription>
                              <div
                                className={cn(
                                  "space-y-1 text-muted-foreground",
                                  isMobile ? "text-xs" : "text-sm"
                                )}
                              >
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
                              {feedback.length > 0 && (
                                <div
                                  className={cn(
                                    "mt-4 pt-4 border-t",
                                    isMacTheme ? "border-black/10" : "border-border"
                                  )}
                                >
                                  <div className="font-semibold mb-2 text-xs text-muted-foreground">
                                    Feedback ({feedback.length}):
                                  </div>
                                  <div className="space-y-2">
                                    {feedback.map((item) => (
                                      <div
                                        key={item.key}
                                        className={cn(
                                          "rounded-md",
                                          isMobile ? "text-xs p-2.5" : "text-sm p-3",
                                          isMacTheme ? "aqua-well" : "bg-muted/50"
                                        )}
                                      >
                                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                          <span className="font-medium">
                                            {item.displayName}
                                          </span>
                                          {item.sentiment && (
                                            <span
                                              className={cn(
                                                "text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wide",
                                                item.sentiment === "yes"
                                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                                  : "bg-red-500/15 text-red-700 dark:text-red-400"
                                              )}
                                            >
                                              {item.sentiment === "yes"
                                                ? "Voted Yes"
                                                : "Voted No"}
                                            </span>
                                          )}
                                        </div>
                                        <div>{item.text}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </AquaCard>
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
          description="Are you sure you want to delete this pitch? It will be removed from the Inbox. If it already has votes or comments the backend cannot delete it, so it will be withdrawn (closed) instead."
        />
        <FormDialog
          isOpen={accountSetupOpen}
          onOpenChange={setAccountSetupOpen}
          title="Set Up Greenroom Account"
          description="Enter your Greenroom user ID to link your account. This allows you to submit pitches and vote on others."
          footer={
            <>
              <Button
                variant="retro"
                onClick={() => setAccountSetupOpen(false)}
                className="w-full sm:w-auto min-h-[36px]"
              >
                <span>Cancel</span>
              </Button>
              <Button
                variant={isMacTheme ? "default" : "retro"}
                onClick={handleAccountSetup}
                className="w-full sm:w-auto min-h-[36px]"
              >
                <span>Save</span>
              </Button>
            </>
          }
        >
          <div className="py-1">
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
        </FormDialog>
      </WindowFrame>
    </>
  );
}
