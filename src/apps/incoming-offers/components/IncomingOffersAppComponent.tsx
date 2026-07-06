import { useState, useEffect, useMemo, useCallback } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { IncomingOffersMenuBar } from "./IncomingOffersMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { FeedbackDialog } from "@/components/dialogs/FeedbackDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import {
  ProjectDetailsFormDialog,
  ProjectDetailsFormValues,
  EMPTY_PROJECT_DETAILS,
  toUpdatePayload,
} from "./ProjectDetailsFormDialog";
import { LogOfferDialog, LogOfferFormValues } from "./LogOfferDialog";
import { helpItems, appMetadata } from "..";
import { useThemeStore } from "@/stores/useThemeStore";
import { useEffectiveGreenroomAccount } from "@/hooks/useGreenroomAccount";
import { usePitchesStore } from "@/stores/usePitchesStore";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { useBookingsStore } from "@/stores/useBookingsStore";
import { useArtistsStore } from "@/stores/useArtistsStore";
import { parsePitchDescription } from "@/lib/api/pitches";
import { toDateInputValue } from "../../active-projects/data";
import { Offer, PitchVoteCounts, PitchVoteChoice } from "../data";
import { DevDataBanner } from "@/components/shared/DevDataBanner";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import * as React from "react";

// Pitch statuses that count as "awaiting a decision" and belong in the Inbox.
const INBOX_PITCH_STATUSES = ["submitted", "under_review"];

// Extracts an ISO date from free-text pitch metadata if there is one, so the
// details form can be prefilled; otherwise the user fills it in.
function extractIsoDate(text: string | undefined): string {
  const match = text?.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function digitsOnly(text: string | undefined): string {
  const digits = (text ?? "").replace(/[^0-9]/g, "");
  return digits;
}

export function IncomingOffersAppComponent({
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
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState<
    "date-asc" | "date-desc" | "fee" | "submitted-asc" | "submitted-desc"
  >("submitted-desc");

  // Feedback dialog: comment attached to a "no" vote, or reason for rejecting
  // a pitch outright.
  const [feedbackMode, setFeedbackMode] = useState<"vote-no" | "reject-pitch">(
    "vote-no"
  );
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [pendingFeedbackOfferId, setPendingFeedbackOfferId] = useState<
    string | null
  >(null);

  // Approve flow
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [pendingApproveOfferId, setPendingApproveOfferId] = useState<
    string | null
  >(null);
  const [isApproving, setIsApproving] = useState(false);

  // Post-approve details form
  const [detailsProjectId, setDetailsProjectId] = useState<number | null>(null);
  const [detailsInitialValues, setDetailsInitialValues] =
    useState<ProjectDetailsFormValues>(EMPTY_PROJECT_DETAILS);
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Decline booking confirm
  const [pendingDeclineBookingId, setPendingDeclineBookingId] = useState<
    number | null
  >(null);

  // Log external offer
  const [isLogOfferOpen, setIsLogOfferOpen] = useState(false);
  const [isLoggingOffer, setIsLoggingOffer] = useState(false);

  const effectiveAccount = useEffectiveGreenroomAccount();
  const greenroomUserId = effectiveAccount.userId;

  const {
    pitches,
    pitchDetails,
    fetchPitches,
    refreshPitch,
    voteOnPitch,
    approvePitch,
    updatePitch,
    addComment,
  } = usePitchesStore();
  const {
    createProject,
    updateProject,
    updateStatus,
    refreshProject,
    fetchActiveProjects,
  } = useProjectsStore();
  const {
    bookings,
    fetchBookings,
    setBookingStatus,
    createBooking,
  } = useBookingsStore();
  const { artists, fetchArtists } = useArtistsStore();

  const currentTheme = useThemeStore((state) => state.current);
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  const isMacOSTheme = currentTheme === "macosx";

  useEffect(() => {
    if (isWindowOpen) {
      fetchPitches().catch((err) => {
        console.error("Failed to fetch pitches:", err);
      });
      fetchBookings().catch((err) => {
        console.error("Failed to fetch bookings:", err);
      });
      fetchArtists().catch((err) => {
        console.error("Failed to fetch artists:", err);
      });
    }
  }, [isWindowOpen, fetchPitches, fetchBookings, fetchArtists]);

  // Load details (votes) for the pitches shown in the inbox so vote counts
  // and the current user's vote reflect the backend.
  useEffect(() => {
    const inboxPitchIds = pitches
      .filter((p) => INBOX_PITCH_STATUSES.includes(p.status))
      .map((p) => p.id)
      .filter((id) => !pitchDetails[id]);
    if (inboxPitchIds.length === 0) return;
    Promise.all(
      inboxPitchIds.map((id) =>
        refreshPitch(id).catch((err) =>
          console.error(`Failed to load pitch ${id}:`, err)
        )
      )
    );
  }, [pitches, pitchDetails, refreshPitch]);

  const offers = useMemo(() => {
    const pitchOffers: Offer[] = pitches
      .filter((pitch) => INBOX_PITCH_STATUSES.includes(pitch.status))
      .map((pitch) => {
        const { description: pitchDescription, metadata } =
          parsePitchDescription(pitch.description);
        return {
          id: `pitch-${pitch.id}`,
          source: "pitch" as const,
          name: pitch.title,
          description: pitchDescription,
          promoter: "Internal Pitch",
          venue: metadata.venue || "TBD",
          date: metadata.keyDates || "TBD",
          fee: metadata.budget || "TBD",
          timings: metadata.timelines || "TBD",
          submittedAt: pitch.date_submitted,
          pitchId: pitch.id,
          pitchStatus: pitch.status,
        };
      });

    const bookingOffers: Offer[] = bookings
      .filter((b) => b.status === "pending")
      .map((b) => ({
        id: `booking-${b.booking_id}`,
        source: "booking" as const,
        name: b.project_name,
        description: b.notes || `Offer for ${b.artist_name}`,
        promoter: [b.city, b.country].filter(Boolean).join(", ") || "Unknown",
        venue: [b.city, b.country].filter(Boolean).join(", ") || "TBD",
        date: b.event_date || "TBD",
        fee: b.agreed_fee || "TBD",
        timings: "TBD",
        bookingId: b.booking_id,
        projectId: b.project_id,
        artistName: b.artist_name,
      }));

    return [...bookingOffers, ...pitchOffers];
  }, [pitches, bookings]);

  // Real vote rollups per pitch offer, from the backend's one-vote-per-user
  // model (1 = yes, -1 = no, 0 = abstain).
  const voteCounts = useMemo(() => {
    const counts: Record<string, PitchVoteCounts> = {};
    offers.forEach((offer) => {
      if (offer.source !== "pitch" || !offer.pitchId) return;
      const detail = pitchDetails[offer.pitchId];
      const rollup: PitchVoteCounts = { yes: 0, no: 0, abstain: 0 };
      detail?.votes?.forEach((vote) => {
        if (vote.vote_value === 1) rollup.yes++;
        else if (vote.vote_value === -1) rollup.no++;
        else rollup.abstain++;
      });
      counts[offer.id] = rollup;
    });
    return counts;
  }, [offers, pitchDetails]);

  const getUserVote = useCallback(
    (pitchId: number): PitchVoteChoice | null => {
      if (!greenroomUserId) return null;
      const detail = pitchDetails[pitchId];
      const vote = detail?.votes?.find((v) => v.user_id === greenroomUserId);
      if (!vote) return null;
      if (vote.vote_value === 1) return "yes";
      if (vote.vote_value === -1) return "no";
      return "abstain";
    },
    [pitchDetails, greenroomUserId]
  );

  const handleVote = async (offer: Offer, choice: PitchVoteChoice) => {
    if (!offer.pitchId) return;
    if (!greenroomUserId) {
      toast.error("Please set up your Greenroom account to vote on pitches");
      return;
    }
    const current = getUserVote(offer.pitchId);

    // Voting "no" collects an optional comment first.
    if (choice === "no" && current !== "no") {
      setFeedbackMode("vote-no");
      setPendingFeedbackOfferId(offer.id);
      setFeedbackText("");
      setIsFeedbackDialogOpen(true);
      return;
    }

    // Clicking your current choice clears the vote back to abstain (the
    // backend has no vote deletion; 0 is the neutral value).
    const voteValue: 1 | -1 | 0 =
      current === choice ? 0 : choice === "yes" ? 1 : choice === "no" ? -1 : 0;

    try {
      await voteOnPitch(offer.pitchId, {
        user_id: greenroomUserId,
        vote_value: voteValue,
        comment: "",
      });
      toast.success("Vote recorded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to vote";
      toast.error(message);
    }
  };

  const handleFeedbackSubmit = async (feedback: string) => {
    const offer = offers.find((o) => o.id === pendingFeedbackOfferId);
    setIsFeedbackDialogOpen(false);
    setFeedbackText("");
    setPendingFeedbackOfferId(null);
    if (!offer?.pitchId || !greenroomUserId) return;

    try {
      if (feedbackMode === "vote-no") {
        await voteOnPitch(offer.pitchId, {
          user_id: greenroomUserId,
          vote_value: -1,
          comment: feedback,
        });
        toast.success("Vote recorded");
      } else {
        // Reject the pitch outright: record the reason as a comment (visible
        // to the submitter in the Pitch app) and set status to rejected.
        if (feedback.trim()) {
          await addComment(offer.pitchId, {
            user_id: greenroomUserId,
            comment: feedback.trim(),
          });
        }
        await updatePitch(offer.pitchId, { status: "rejected" });
        await fetchPitches();
        toast.success(`"${offer.name}" rejected`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit";
      toast.error(message);
    }
  };

  const handleRejectClick = (offer: Offer) => {
    if (!greenroomUserId) {
      toast.error("Please set up your Greenroom account first");
      return;
    }
    setFeedbackMode("reject-pitch");
    setPendingFeedbackOfferId(offer.id);
    setFeedbackText("");
    setIsFeedbackDialogOpen(true);
  };

  const handleApproveClick = (offerId: string) => {
    setPendingApproveOfferId(offerId);
    setIsApproveDialogOpen(true);
  };

  const handleApproveConfirm = async () => {
    const offer = offers.find((o) => o.id === pendingApproveOfferId);
    if (!offer) {
      setIsApproveDialogOpen(false);
      setPendingApproveOfferId(null);
      return;
    }

    setIsApproving(true);
    try {
      if (offer.source === "pitch" && offer.pitchId) {
        // The backend creates the project (title + description only) and
        // links/closes the pitch. Everything else is filled in next via the
        // details dialog.
        const projectId = await approvePitch(offer.pitchId);
        const { metadata, description } = parsePitchDescription(
          pitchDetails[offer.pitchId]?.description ??
            pitches.find((p) => p.id === offer.pitchId)?.description ??
            ""
        );
        setDetailsInitialValues({
          ...EMPTY_PROJECT_DETAILS,
          name: offer.name,
          description,
          budget: digitsOnly(metadata.budget),
          event_date: extractIsoDate(metadata.keyDates),
          venue_name: metadata.venue ?? "",
        });
        setDetailsProjectId(projectId);
      } else if (offer.source === "booking" && offer.bookingId && offer.projectId) {
        await setBookingStatus(offer.bookingId, "confirmed");
        // Bring the linked project into Active Projects if it isn't already.
        const project = await refreshProject(offer.projectId);
        if (project.status !== "active") {
          await updateStatus(offer.projectId, "active");
        }
        setDetailsInitialValues({
          name: project.name,
          description: project.description ?? "",
          project_type: project.project_type ?? "",
          budget: project.budget ?? "",
          event_date: toDateInputValue(project.event_date),
          start_date: toDateInputValue(project.start_date),
          end_date: toDateInputValue(project.end_date),
          venue_name: project.venue_name ?? "",
          city: project.city ?? "",
          country: project.country ?? "",
          promoter_name: project.promoter_name ?? "",
          gig_size_id: project.gig_size_id,
        });
        setDetailsProjectId(offer.projectId);
      }
      await fetchActiveProjects();
      toast.success(`"${offer.name}" approved`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to approve offer";
      toast.error(message);
    } finally {
      setIsApproving(false);
      setIsApproveDialogOpen(false);
      setPendingApproveOfferId(null);
    }
  };

  const handleDetailsSave = async (values: ProjectDetailsFormValues) => {
    if (detailsProjectId === null) return;
    setIsSavingDetails(true);
    try {
      await updateProject(detailsProjectId, toUpdatePayload(values));
      await fetchActiveProjects();
      toast.success("Project details saved");
      setDetailsProjectId(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save details";
      toast.error(message);
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleDeclineBookingConfirm = async () => {
    if (pendingDeclineBookingId === null) return;
    try {
      await setBookingStatus(pendingDeclineBookingId, "declined");
      toast.success("Offer declined");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to decline offer";
      toast.error(message);
    } finally {
      setPendingDeclineBookingId(null);
    }
  };

  const handleLogOffer = async (values: LogOfferFormValues) => {
    if (values.artist_id === null) return;
    setIsLoggingOffer(true);
    try {
      // The project holds the event data and starts on_hold; approving the
      // offer later confirms the booking and activates the project.
      const projectId = await createProject({
        name: values.name.trim(),
        status: "on_hold",
        description: values.description.trim() || undefined,
        source: values.source,
        event_date: values.event_date || undefined,
        venue_name: values.venue_name.trim() || undefined,
        city: values.city.trim() || undefined,
        country: values.country.trim() || undefined,
        promoter_name: values.promoter_name.trim() || undefined,
      });
      await createBooking({
        artist_id: values.artist_id,
        project_id: projectId,
        status: "pending",
        agreed_fee: values.agreed_fee.trim() || undefined,
        notes: values.notes.trim() || undefined,
      });
      toast.success("Offer logged");
      setIsLogOfferOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to log offer";
      toast.error(message);
    } finally {
      setIsLoggingOffer(false);
    }
  };

  const filteredOffers = offers
    .filter(
      (offer) =>
        offer.name.toLowerCase().includes(filter.toLowerCase()) ||
        offer.promoter.toLowerCase().includes(filter.toLowerCase()) ||
        offer.venue.toLowerCase().includes(filter.toLowerCase()) ||
        (offer.artistName ?? "").toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "date-asc") return a.date.localeCompare(b.date);
      if (sortBy === "date-desc") return b.date.localeCompare(a.date);
      if (sortBy === "submitted-asc") {
        const aDate = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bDate = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return aDate - bDate;
      }
      if (sortBy === "submitted-desc") {
        const aDate = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const bDate = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return bDate - aDate;
      }
      return (Number(digitsOnly(b.fee)) || 0) - (Number(digitsOnly(a.fee)) || 0);
    });

  const pendingApproveOffer = offers.find(
    (o) => o.id === pendingApproveOfferId
  );

  const menuBar = (
    <IncomingOffersMenuBar
      onClose={onClose}
      onShowHelp={() => setIsHelpDialogOpen(true)}
      onShowAbout={() => setIsAboutDialogOpen(true)}
      onLogOffer={() => setIsLogOfferOpen(true)}
    />
  );

  if (!isWindowOpen) return null;

  return (
    <>
      {!isXpTheme && isForeground && menuBar}
      <WindowFrame
        title="Inbox"
        onClose={onClose}
        isForeground={isForeground}
        appId="incoming-offers"
        skipInitialSound={skipInitialSound}
        instanceId={instanceId}
        onNavigateNext={onNavigateNext}
        onNavigatePrevious={onNavigatePrevious}
        menuBar={isXpTheme ? menuBar : undefined}
        windowConstraints={{
          minWidth: 400,
          minHeight: 400,
        }}
      >
        <div
          className={cn(
            "flex flex-col h-full text-foreground",
            isMacOSTheme
              ? "bg-gradient-to-b from-[#ECECEC] to-[#E5E5E5]"
              : "bg-background"
          )}
        >
          <DevDataBanner
            sources={[
              { label: "pitches", status: "live", detail: "/api/pitches/" },
              { label: "bookings", status: "live", detail: "/api/bookings/" },
              { label: "projects", status: "live", detail: "/api/projects/ (events merged in)" },
            ]}
          />
          {/* Toolbar */}
          <div
            className={cn(
              "flex items-center gap-4 p-4 border-b",
              isMacOSTheme ? "" : "bg-muted/30"
            )}
            style={
              isMacOSTheme
                ? {
                    backgroundImage: "var(--os-pinstripe-window)",
                    borderBottom:
                      "var(--os-metrics-titlebar-border-width, 1px) solid var(--os-color-titlebar-border-inactive, rgba(0, 0, 0, 0.2))",
                    opacity: 0.95,
                  }
                : undefined
            }
          >
            <div className="relative flex-1 max-w-sm">
              <Input
                placeholder="Search offers..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full"
              />
            </div>
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as typeof sortBy)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-asc">Event Date (Ascending)</SelectItem>
                <SelectItem value="date-desc">Event Date (Descending)</SelectItem>
                <SelectItem value="submitted-asc">
                  Submitted (Oldest First)
                </SelectItem>
                <SelectItem value="submitted-desc">
                  Submitted (Newest First)
                </SelectItem>
                <SelectItem value="fee">Sort by Fee</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setIsLogOfferOpen(true)}>Log Offer</Button>
          </div>

          {/* Grid */}
          <div
            className={cn(
              "flex-1 overflow-auto p-4",
              isMacOSTheme ? "" : "bg-muted/10"
            )}
            style={isMacOSTheme ? { background: "transparent" } : undefined}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOffers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  userVote={
                    offer.pitchId ? getUserVote(offer.pitchId) : null
                  }
                  counts={voteCounts[offer.id]}
                  onVote={(choice) => handleVote(offer, choice)}
                  onApprove={() => handleApproveClick(offer.id)}
                  onReject={() =>
                    offer.source === "pitch"
                      ? handleRejectClick(offer)
                      : setPendingDeclineBookingId(offer.bookingId ?? null)
                  }
                />
              ))}
              {filteredOffers.length === 0 && (
                <div
                  className="col-span-full text-center py-10 text-muted-foreground"
                  style={
                    isMacOSTheme
                      ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" }
                      : {}
                  }
                >
                  No offers found.
                </div>
              )}
            </div>
          </div>
        </div>

        <HelpDialog
          isOpen={isHelpDialogOpen}
          onOpenChange={setIsHelpDialogOpen}
          helpItems={helpItems}
          appId="incoming-offers"
        />
        <AboutDialog
          isOpen={isAboutDialogOpen}
          onOpenChange={setIsAboutDialogOpen}
          metadata={appMetadata}
          appId="incoming-offers"
        />
        <FeedbackDialog
          isOpen={isFeedbackDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsFeedbackDialogOpen(false);
              setFeedbackText("");
              setPendingFeedbackOfferId(null);
            } else {
              setIsFeedbackDialogOpen(true);
            }
          }}
          onSubmit={handleFeedbackSubmit}
          title={
            feedbackMode === "vote-no" ? "Vote No" : "Reject Pitch"
          }
          description={
            feedbackMode === "vote-no"
              ? "Optionally explain your no vote. The comment is stored with your vote."
              : "Provide feedback for why this pitch is being rejected. It will be added as a comment for the submitter, and the pitch will be marked rejected."
          }
          value={feedbackText}
          onChange={setFeedbackText}
          submitLabel={feedbackMode === "vote-no" ? "Submit Vote" : "Reject Pitch"}
        />
        <ConfirmDialog
          isOpen={isApproveDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              if (!isApproving) {
                setIsApproveDialogOpen(false);
                setPendingApproveOfferId(null);
              }
            } else {
              setIsApproveDialogOpen(true);
            }
          }}
          onConfirm={handleApproveConfirm}
          title="Approve Offer"
          description={
            pendingApproveOffer?.source === "booking"
              ? `Approve "${pendingApproveOffer?.name ?? "this offer"}"? The booking will be confirmed and the project moved to Active Projects. You'll be asked to complete any missing project details.`
              : `Approve "${pendingApproveOffer?.name ?? "this pitch"}"? A project will be created in Active Projects and you'll be asked to complete its details.`
          }
        />
        <ConfirmDialog
          isOpen={pendingDeclineBookingId !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDeclineBookingId(null);
          }}
          onConfirm={handleDeclineBookingConfirm}
          title="Decline Offer"
          description="Decline this offer? The booking will be marked as declined in the backend."
        />
        <ProjectDetailsFormDialog
          isOpen={detailsProjectId !== null}
          title="Complete Project Details"
          description="The backend needs these fields to fully describe the project. Fill in what you know — blank fields are left unchanged."
          initialValues={detailsInitialValues}
          isSaving={isSavingDetails}
          onSave={handleDetailsSave}
          onSkip={() => setDetailsProjectId(null)}
        />
        <LogOfferDialog
          isOpen={isLogOfferOpen}
          artists={artists}
          isSaving={isLoggingOffer}
          onClose={() => setIsLogOfferOpen(false)}
          onSubmit={handleLogOffer}
        />
      </WindowFrame>
    </>
  );
}

function OfferCard({
  offer,
  userVote,
  counts,
  onVote,
  onApprove,
  onReject,
}: {
  offer: Offer;
  userVote: PitchVoteChoice | null;
  counts?: PitchVoteCounts;
  onVote: (choice: PitchVoteChoice) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const currentTheme = useThemeStore((state) => state.current);
  const isMacOSTheme = currentTheme === "macosx";
  const [isHovered, setIsHovered] = React.useState(false);
  const isPitch = offer.source === "pitch";

  return (
    <Card
      className={cn(
        "flex flex-col h-full overflow-hidden transition-all relative",
        !isMacOSTheme && "hover:shadow-md"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...(isMacOSTheme && {
          borderRadius: "8px",
          background:
            "linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(245, 245, 245, 0.95))",
          border: "none",
          boxShadow: isHovered
            ? `
              0 4px 8px rgba(0, 0, 0, 0.18),
              0 2px 2px rgba(0, 0, 0, 0.3),
              inset 0 1px 2px rgba(255, 255, 255, 0.7),
              inset 0 0 4px rgba(0, 0, 0, 0.05),
              inset 0 0 0 0.5px rgba(0, 0, 0, 0.48),
              inset 0 0 0 1px rgba(0, 0, 0, 0.08)
            `
            : `
              0 2px 4px rgba(0, 0, 0, 0.14),
              0 1px 1px rgba(0, 0, 0, 0.25),
              inset 0 1px 2px rgba(255, 255, 255, 0.6),
              inset 0 0 4px rgba(0, 0, 0, 0.05),
              inset 0 0 0 0.5px rgba(0, 0, 0, 0.48),
              inset 0 0 0 1px rgba(0, 0, 0, 0.08)
            `,
          WebkitFontSmoothing: "antialiased",
          transform: isHovered ? "translateY(-1px)" : "translateY(0)",
        }),
      }}
    >
      {/* Top shine effect for macOS */}
      {isMacOSTheme && (
        <div
          style={{
            position: "absolute",
            left: "6px",
            right: "6px",
            top: "2px",
            height: "20px",
            background:
              "linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.25))",
            borderRadius: "8px 8px 4px 4px",
            filter: "blur(0.5px)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}
      <CardHeader
        className={cn("pb-3 relative z-10", !isMacOSTheme && "bg-muted/5")}
        style={{
          ...(isMacOSTheme && {
            background: "transparent",
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
          }),
        }}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1">
            <CardTitle
              className="text-lg leading-tight"
              style={{
                ...(isMacOSTheme && {
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                }),
              }}
            >
              {offer.name}
            </CardTitle>
            <CardDescription
              style={{
                ...(isMacOSTheme && {
                  textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)",
                }),
              }}
            >
              {isPitch ? offer.promoter : offer.artistName ?? offer.promoter}
            </CardDescription>
          </div>
          <SourceBadge source={offer.source} />
        </div>
      </CardHeader>
      <CardContent
        className="flex-1 py-4 space-y-4 text-sm relative z-10"
        style={{
          ...(isMacOSTheme && {
            textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)",
          }),
        }}
      >
        <p className="text-muted-foreground line-clamp-3 min-h-[3rem]">
          {offer.description}
        </p>

        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
          <div className="flex flex-col">
            <span className="text-muted-foreground font-medium">Date</span>
            <span>{offer.date}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground font-medium">Fee</span>
            <span>{offer.fee}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground font-medium">
              {isPitch ? "Venue" : "Location"}
            </span>
            <span className="break-words">{offer.venue}</span>
          </div>
          {isPitch ? (
            <div className="flex flex-col">
              <span className="text-muted-foreground font-medium">Time</span>
              <span>{offer.timings}</span>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="text-muted-foreground font-medium">Artist</span>
              <span className="break-words">{offer.artistName}</span>
            </div>
          )}
          {offer.submittedAt && (
            <div className="flex flex-col col-span-2">
              <span className="text-muted-foreground font-medium">
                Submitted
              </span>
              <span>
                {new Date(offer.submittedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter
        className={cn(
          "pt-2 border-t relative z-10 flex flex-col gap-2",
          !isMacOSTheme && "bg-muted/5"
        )}
        style={{
          ...(isMacOSTheme && {
            background: "transparent",
            borderTop: "1px solid rgba(0, 0, 0, 0.1)",
          }),
        }}
      >
        <Button
          onClick={onApprove}
          className={cn(
            "w-full relative",
            isMacOSTheme ? "aqua-button secondary" : ""
          )}
          style={
            isMacOSTheme
              ? {
                  borderRadius: "6px",
                  background:
                    "linear-gradient(to bottom, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))",
                  border: "none",
                  boxShadow: `
                    0 2px 4px rgba(0, 0, 0, 0.18),
                    0 1px 1px rgba(0, 0, 0, 0.3),
                    inset 0 1px 2px rgba(255, 255, 255, 0.5),
                    inset 0 0 4px rgba(0, 0, 0, 0.1),
                    inset 0 0 0 0.5px rgba(0, 0, 0, 0.4),
                    inset 0 0 0 1px rgba(0, 0, 0, 0.08)
                  `,
                  WebkitFontSmoothing: "antialiased",
                  color: "white",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
                  position: "relative",
                }
              : {}
          }
        >
          {isMacOSTheme ? (
            <>
              <div
                style={{
                  position: "absolute",
                  left: "3px",
                  right: "3px",
                  top: "2px",
                  height: "12px",
                  background:
                    "linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.15))",
                  borderRadius: "4px 4px 2px 2px",
                  filter: "blur(0.5px)",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />
              <span className="relative z-10 font-semibold">
                Approve &amp; Move to Active Projects
              </span>
            </>
          ) : (
            "Approve & Move to Active Projects"
          )}
        </Button>
        {isPitch ? (
          <div className="w-full grid grid-cols-3 gap-2">
            <VoteButton
              active={userVote === "yes"}
              count={counts?.yes ?? 0}
              onClick={() => onVote("yes")}
              color="green"
            >
              Yes
            </VoteButton>
            <VoteButton
              active={userVote === "no"}
              count={counts?.no ?? 0}
              onClick={() => onVote("no")}
              color="red"
            >
              No
            </VoteButton>
            <Button
              variant="outline"
              onClick={onReject}
              className="h-auto min-h-[60px] py-2 px-2 text-[10px] font-semibold leading-tight"
            >
              Reject Pitch
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={onReject} className="w-full">
            Decline Offer
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function SourceBadge({ source }: { source: "pitch" | "booking" }) {
  const currentTheme = useThemeStore((state) => state.current);
  const isMacOSTheme = currentTheme === "macosx";

  const isPitch = source === "pitch";

  if (!isMacOSTheme) {
    return (
      <Badge variant={isPitch ? "secondary" : "outline"}>{source}</Badge>
    );
  }

  // macOS Aqua styling
  const gradient = isPitch
    ? "linear-gradient(to bottom, rgba(220, 200, 255, 0.9), rgba(200, 180, 240, 0.9))"
    : "linear-gradient(to bottom, rgba(200, 220, 255, 0.9), rgba(180, 200, 240, 0.9))";

  return (
    <span
      className="relative inline-flex items-center justify-center px-2.5 py-0.5 text-[10px] font-medium rounded-md overflow-hidden"
      style={{
        background: gradient,
        boxShadow: `
            0 2px 4px rgba(0, 0, 0, 0.14),
            0 1px 1px rgba(0, 0, 0, 0.25),
            inset 0 1px 2px rgba(255, 255, 255, 0.6),
            inset 0 0 4px rgba(0, 0, 0, 0.05),
            inset 0 0 0 0.5px rgba(0, 0, 0, 0.48),
            inset 0 0 0 1px rgba(0, 0, 0, 0.08)
        `,
        color: "black",
        textShadow: "0 1px 2px rgba(0, 0, 0, 0.15)",
        WebkitFontSmoothing: "antialiased",
        border: "none",
        cursor: "default",
        minHeight: "18px",
        lineHeight: 1.2,
      }}
    >
      {/* Top shine effect */}
      <div
        style={{
          position: "absolute",
          left: "3px",
          right: "3px",
          top: "1px",
          height: "8px",
          background:
            "linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.25))",
          borderRadius: "6px 6px 2px 2px",
          filter: "blur(0.5px)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <span className="relative z-10 uppercase tracking-wide">{source}</span>
    </span>
  );
}

function VoteButton({
  active,
  count,
  onClick,
  children,
  color,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
  color: "green" | "red";
}) {
  const currentTheme = useThemeStore((state) => state.current);
  const isMacOSTheme = currentTheme === "macosx";

  const getColorGradient = () => {
    if (color === "green") {
      return active
        ? "linear-gradient(to bottom, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))"
        : "linear-gradient(to bottom, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.3))";
    }
    return active
      ? "linear-gradient(to bottom, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))"
      : "linear-gradient(to bottom, rgba(239, 68, 68, 0.3), rgba(220, 38, 38, 0.3))";
  };

  const getColorOverlay = () => {
    if (color === "green") {
      return active ? "rgba(34, 197, 94, 0.95)" : "rgba(34, 197, 94, 0.25)";
    }
    return active ? "rgba(239, 68, 68, 0.95)" : "rgba(239, 68, 68, 0.25)";
  };

  if (isMacOSTheme) {
    return (
      <Button
        onClick={onClick}
        className={cn(
          "w-full relative h-auto min-h-[60px] py-2 px-2 text-xs flex flex-col gap-0.5 items-center justify-center",
          "aqua-button secondary"
        )}
        style={{
          borderRadius: "6px",
          background: getColorGradient(),
          border: "none",
          boxShadow: active
            ? `
                0 2px 4px rgba(0, 0, 0, 0.18),
                0 1px 1px rgba(0, 0, 0, 0.3),
                inset 0 1px 2px rgba(255, 255, 255, 0.5),
                inset 0 0 4px rgba(0, 0, 0, 0.1),
                inset 0 0 0 0.5px rgba(0, 0, 0, 0.4),
                inset 0 0 0 1px rgba(0, 0, 0, 0.08)
              `
            : `
                0 1px 2px rgba(0, 0, 0, 0.12),
                inset 0 1px 1px rgba(255, 255, 255, 0.3),
                inset 0 0 2px rgba(0, 0, 0, 0.05)
              `,
          WebkitFontSmoothing: "antialiased",
          color: active ? "white" : "black",
          textShadow: active
            ? "0 1px 2px rgba(0, 0, 0, 0.3)"
            : "0 1px 1px rgba(0, 0, 0, 0.2)",
          position: "relative",
        }}
      >
        {active && (
          <div
            style={{
              position: "absolute",
              left: "3px",
              right: "3px",
              top: "2px",
              height: "12px",
              background:
                "linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.15))",
              borderRadius: "4px 4px 2px 2px",
              filter: "blur(0.5px)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
        )}
        <span className="relative z-10 font-semibold text-[10px] leading-tight text-center">
          {children}
        </span>
        <span className="relative z-10 text-[9px] opacity-90">({count})</span>
      </Button>
    );
  }

  return (
    <Button
      variant="retro"
      onClick={onClick}
      className={cn(
        "h-auto min-h-[60px] py-2 px-2 text-xs flex flex-col gap-0.5 items-center justify-center w-full focus:outline-none focus:ring-0 relative overflow-hidden",
        active && "[border-image:url('/assets/button-default.svg')_60_stretch]"
      )}
      style={{
        backgroundColor: getColorOverlay(),
      }}
    >
      <span className="font-semibold text-[10px] leading-tight text-center relative z-10">
        {children}
      </span>
      <span className="text-[9px] opacity-80 relative z-10">({count})</span>
    </Button>
  );
}
