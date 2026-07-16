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
import {
  useEffectiveGreenroomAccount,
  useIsGreenroomAdmin,
} from "@/hooks/useGreenroomAccount";
import { usePitchesStore } from "@/stores/usePitchesStore";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { useBookingsStore } from "@/stores/useBookingsStore";
import { useArtistsStore } from "@/stores/useArtistsStore";
import { parsePitchDescription } from "@/lib/api/pitches";
import { createArtist } from "@/lib/api/artists";
import { toDateInputValue } from "../../active-projects/data";
import { Offer, PitchVoteCounts, PitchVoteChoice } from "../data";
import { toast } from "sonner";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AquaCard,
  AppToolbar,
  EmptyState,
  StatusBadge,
  useOsTheme,
} from "@/components/greenroom";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";

// Pitch statuses that count as "awaiting a decision" and belong in the Inbox.
const INBOX_PITCH_STATUSES = ["submitted", "under_review"];

// Incoming offers are for the collective as a whole, not an individual artist,
// but the backend requires every booking to name an artist. We attach these
// offers to a single stand-in "collective" artist, created lazily the first
// time an offer is logged.
const COLLECTIVE_ARTIST_NAME = "DAYTIMERS";

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
  // Declining/rejecting is an admin-only action (frontend-gated; see
  // src/config/greenroomAdmins.ts). Non-admins can only support (Yes / Approve).
  const isAdmin = useIsGreenroomAdmin();

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
    bookingDetails,
    fetchBookings,
    refreshBooking,
    setBookingStatus,
    createBooking,
    voteOnBooking,
  } = useBookingsStore();
  const { artists, fetchArtists, findByName } = useArtistsStore();

  const { isMacTheme, isXpTheme } = useOsTheme();

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

  // Same for pending bookings ("Offers") — load their vote details.
  useEffect(() => {
    const inboxBookingIds = bookings
      .filter((b) => b.status === "pending")
      .map((b) => b.booking_id)
      .filter((id) => !bookingDetails[id]);
    if (inboxBookingIds.length === 0) return;
    Promise.all(
      inboxBookingIds.map((id) =>
        refreshBooking(id).catch((err) =>
          console.error(`Failed to load booking ${id}:`, err)
        )
      )
    );
  }, [bookings, bookingDetails, refreshBooking]);

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
        description: b.notes || "Incoming offer",
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

  // The votes on an offer, from whichever backend backs it. Pitches and
  // bookings share the same one-vote-per-user model and vote shape.
  const getOfferVotes = useCallback(
    (
      offer: Offer
    ): {
      user_id: number;
      vote_value: number;
      comment: string | null;
      wants_involvement?: boolean;
    }[] => {
      if (offer.source === "pitch" && offer.pitchId) {
        return pitchDetails[offer.pitchId]?.votes ?? [];
      }
      if (offer.source === "booking" && offer.bookingId) {
        return bookingDetails[offer.bookingId]?.votes ?? [];
      }
      return [];
    },
    [pitchDetails, bookingDetails]
  );

  // Real vote rollups per offer, from the backend's one-vote-per-user model
  // (1 = yes, -1 = no, 0 = abstain).
  const voteCounts = useMemo(() => {
    const counts: Record<string, PitchVoteCounts> = {};
    offers.forEach((offer) => {
      const rollup: PitchVoteCounts = { yes: 0, no: 0, abstain: 0, involved: 0 };
      getOfferVotes(offer).forEach((vote) => {
        if (vote.vote_value === 1) rollup.yes++;
        else if (vote.vote_value === -1) rollup.no++;
        else rollup.abstain++;
        if (vote.wants_involvement) rollup.involved++;
      });
      counts[offer.id] = rollup;
    });
    return counts;
  }, [offers, getOfferVotes]);

  const getUserVote = useCallback(
    (offer: Offer): PitchVoteChoice | null => {
      if (!greenroomUserId) return null;
      const vote = getOfferVotes(offer).find(
        (v) => v.user_id === greenroomUserId
      );
      if (!vote) return null;
      if (vote.vote_value === 1) return "yes";
      if (vote.vote_value === -1) return "no";
      return "abstain";
    },
    [getOfferVotes, greenroomUserId]
  );

  // Whether the current user has flagged that they want to be personally
  // involved. Independent of how (or whether) they voted.
  const getUserInvolvement = useCallback(
    (offer: Offer): boolean => {
      if (!greenroomUserId) return false;
      const vote = getOfferVotes(offer).find(
        (v) => v.user_id === greenroomUserId
      );
      return vote?.wants_involvement ?? false;
    },
    [getOfferVotes, greenroomUserId]
  );

  const handleVote = async (offer: Offer, choice: PitchVoteChoice) => {
    const votableId =
      offer.source === "pitch" ? offer.pitchId : offer.bookingId;
    if (!votableId) return;
    if (!greenroomUserId) {
      toast.error("Please set up your Greenroom account to vote");
      return;
    }
    const current = getUserVote(offer);

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
      if (offer.source === "pitch" && offer.pitchId) {
        await voteOnPitch(offer.pitchId, {
          user_id: greenroomUserId,
          vote_value: voteValue,
          comment: "",
        });
      } else if (offer.source === "booking" && offer.bookingId) {
        await voteOnBooking(offer.bookingId, {
          user_id: greenroomUserId,
          vote_value: voteValue,
          comment: "",
        });
      }
      toast.success("Vote recorded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to vote";
      toast.error(message);
    }
  };

  // Toggle "I'd like to be personally involved". This is a separate flag on the
  // user's vote row, independent of the yes/no/abstain value — so we preserve
  // whatever they've voted (default abstain if they haven't) and just flip the
  // involvement flag. Preserving the comment keeps any "no" reason intact.
  const handleToggleInvolvement = async (offer: Offer) => {
    const votableId =
      offer.source === "pitch" ? offer.pitchId : offer.bookingId;
    if (!votableId) return;
    if (!greenroomUserId) {
      toast.error("Please set up your Greenroom account to register interest");
      return;
    }

    const existing = getOfferVotes(offer).find(
      (v) => v.user_id === greenroomUserId
    );
    const voteValue = (existing?.vote_value ?? 0) as 1 | -1 | 0;
    const nextInvolvement = !(existing?.wants_involvement ?? false);

    try {
      if (offer.source === "pitch" && offer.pitchId) {
        await voteOnPitch(offer.pitchId, {
          user_id: greenroomUserId,
          vote_value: voteValue,
          comment: existing?.comment ?? "",
          wants_involvement: nextInvolvement,
        });
      } else if (offer.source === "booking" && offer.bookingId) {
        await voteOnBooking(offer.bookingId, {
          user_id: greenroomUserId,
          vote_value: voteValue,
          comment: existing?.comment ?? "",
          wants_involvement: nextInvolvement,
        });
      }
      toast.success(
        nextInvolvement
          ? "You're flagged as wanting to be involved"
          : "Removed your interest"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update interest";
      toast.error(message);
    }
  };

  const handleFeedbackSubmit = async (feedback: string) => {
    const offer = offers.find((o) => o.id === pendingFeedbackOfferId);
    setIsFeedbackDialogOpen(false);
    setFeedbackText("");
    setPendingFeedbackOfferId(null);
    if (!offer || !greenroomUserId) return;

    try {
      if (feedbackMode === "vote-no") {
        // "No" vote with an optional reason — route to the right backend.
        if (offer.source === "pitch" && offer.pitchId) {
          await voteOnPitch(offer.pitchId, {
            user_id: greenroomUserId,
            vote_value: -1,
            comment: feedback,
          });
        } else if (offer.source === "booking" && offer.bookingId) {
          await voteOnBooking(offer.bookingId, {
            user_id: greenroomUserId,
            vote_value: -1,
            comment: feedback,
          });
        }
        toast.success("Vote recorded");
      } else if (offer.pitchId) {
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
    if (!isAdmin) {
      toast.error("Only admins can reject pitches");
      return;
    }
    setFeedbackMode("reject-pitch");
    setPendingFeedbackOfferId(offer.id);
    setFeedbackText("");
    setIsFeedbackDialogOpen(true);
  };

  const handleApproveClick = (offerId: string) => {
    if (!isAdmin) {
      toast.error("Only admins can approve offers");
      return;
    }
    setPendingApproveOfferId(offerId);
    setIsApproveDialogOpen(true);
  };

  const handleApproveConfirm = async () => {
    const offer = offers.find((o) => o.id === pendingApproveOfferId);
    if (!offer || !isAdmin) {
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
    if (!isAdmin) {
      toast.error("Only admins can decline offers");
      setPendingDeclineBookingId(null);
      return;
    }
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

  // Offers belong to the collective, so they're all attached to a single
  // stand-in artist. Reuse the existing one if it's already loaded or the
  // backend knows it; otherwise create it once.
  const resolveCollectiveArtistId = useCallback(async (): Promise<number> => {
    const loaded = artists.find(
      (a) =>
        a.artist_name.toLowerCase() === COLLECTIVE_ARTIST_NAME.toLowerCase()
    );
    if (loaded) return loaded.id;
    const found = await findByName(COLLECTIVE_ARTIST_NAME);
    if (found !== null) return found;
    const created = await createArtist({
      artist_name: COLLECTIVE_ARTIST_NAME,
      is_collective_member: true,
    });
    fetchArtists().catch(() => {});
    return created.id;
  }, [artists, findByName, fetchArtists]);

  const handleLogOffer = async (values: LogOfferFormValues) => {
    setIsLoggingOffer(true);
    try {
      const artistId = await resolveCollectiveArtistId();
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
        artist_id: artistId,
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
            "flex flex-col h-full w-full text-foreground",
            !isMacTheme && "bg-background"
          )}
        >
          <AppToolbar>
            <Input
              placeholder="Search offers..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 min-w-[160px] max-w-sm"
            />
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
            <Button variant="default" onClick={() => setIsLogOfferOpen(true)}>
              <span>Log Offer</span>
            </Button>
          </AppToolbar>

          {/* Card grid; container queries make columns track the window
              width rather than the viewport, so a narrow desktop window
              collapses the same way a phone does. (Padding lives on an inner
              wrapper — container queries measure the content box.) */}
          <div
            className={cn(
              "flex-1 overflow-auto @container",
              !isMacTheme && "bg-muted/10"
            )}
          >
            {filteredOffers.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No offers found"
                hint="Incoming pitches and logged offers awaiting a decision show up here."
              />
            ) : (
              <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 gap-4 p-4">
                {filteredOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    isAdmin={isAdmin}
                    userVote={getUserVote(offer)}
                    userInvolved={getUserInvolvement(offer)}
                    counts={voteCounts[offer.id]}
                    onVote={(choice) => handleVote(offer, choice)}
                    onToggleInvolvement={() => handleToggleInvolvement(offer)}
                    onApprove={() => handleApproveClick(offer.id)}
                    onReject={() =>
                      offer.source === "pitch"
                        ? handleRejectClick(offer)
                        : setPendingDeclineBookingId(offer.bookingId ?? null)
                    }
                  />
                ))}
              </div>
            )}
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
  isAdmin,
  userVote,
  userInvolved,
  counts,
  onVote,
  onToggleInvolvement,
  onApprove,
  onReject,
}: {
  offer: Offer;
  isAdmin: boolean;
  userVote: PitchVoteChoice | null;
  userInvolved: boolean;
  counts?: PitchVoteCounts;
  onVote: (choice: PitchVoteChoice) => void;
  onToggleInvolvement: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { isMacTheme } = useOsTheme();
  const isPitch = offer.source === "pitch";

  return (
    <AquaCard interactive className="flex flex-col h-full overflow-hidden">
      <CardHeader className={cn("pb-3", !isMacTheme && "bg-muted/5")}>
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-lg leading-tight">
              {offer.name}
            </CardTitle>
            {isPitch && (
              <CardDescription>{offer.promoter}</CardDescription>
            )}
          </div>
          <StatusBadge
            status={offer.source}
            label={isPitch ? "Pitch" : "Offer"}
            tone={isPitch ? "purple" : "blue"}
            className="shrink-0 uppercase tracking-wide"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 py-4 space-y-4 text-sm">
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
          {isPitch && (
            <div className="flex flex-col">
              <span className="text-muted-foreground font-medium">Time</span>
              <span>{offer.timings}</span>
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
      {/* Both pitches and bookings are voted on Yes/No by everyone; only admins
          get the terminal action (Reject Pitch / Decline Offer) and Approve. */}
      <CardFooter
        className={cn(
          "pt-3 border-t flex flex-col gap-2",
          isMacTheme ? "border-black/10" : "bg-muted/5"
        )}
      >
        {isAdmin && (
          <Button
            variant="default"
            onClick={onApprove}
            className="w-full min-h-[36px] touch-manipulation"
            title="Approve and move to Active Projects"
          >
            <span className="font-semibold">
              Approve &amp; Move to Active Projects
            </span>
          </Button>
        )}
        <div
          className={cn(
            "w-full grid gap-2",
            isAdmin ? "grid-cols-3" : "grid-cols-2"
          )}
        >
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
          {isAdmin && (
            <Button
              variant={isMacTheme ? "secondary" : "outline"}
              onClick={onReject}
              className="h-auto min-h-[60px] py-2 px-2 touch-manipulation"
            >
              <span className="text-[10px] font-semibold leading-tight">
                {isPitch ? "Reject Pitch" : "Decline Offer"}
              </span>
            </Button>
          )}
        </div>
        {/* Separate from the yes/no vote: register personal interest in working
            on this project. A voter can flag this whether they voted yes, no,
            or not at all. */}
        <InvolvementButton
          active={userInvolved}
          count={counts?.involved ?? 0}
          onClick={onToggleInvolvement}
        />
      </CardFooter>
    </AquaCard>
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
  const { isMacTheme } = useOsTheme();

  if (isMacTheme) {
    // Inactive votes read as neutral gel buttons; the user's active vote gets
    // the colored gel treatment (emerald yes / red no) from themes.css.
    return (
      <Button
        variant="secondary"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "w-full h-auto min-h-[60px] py-2 px-2 flex flex-col gap-0.5 items-center justify-center touch-manipulation",
          active && (color === "green" ? "emerald" : "red")
        )}
      >
        <span className="font-semibold text-[10px] leading-tight text-center">
          {children}
        </span>
        <span className="text-[9px] opacity-90">({count})</span>
      </Button>
    );
  }

  const overlay =
    color === "green"
      ? active
        ? "rgba(34, 197, 94, 0.95)"
        : "rgba(34, 197, 94, 0.25)"
      : active
      ? "rgba(239, 68, 68, 0.95)"
      : "rgba(239, 68, 68, 0.25)";

  return (
    <Button
      variant="retro"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-auto min-h-[60px] py-2 px-2 text-xs flex flex-col gap-0.5 items-center justify-center w-full focus:outline-none focus:ring-0 relative overflow-hidden touch-manipulation",
        active && "[border-image:url('/assets/button-default.svg')_60_stretch]"
      )}
      style={{
        backgroundColor: overlay,
      }}
    >
      <span className="font-semibold text-[10px] leading-tight text-center relative z-10">
        {children}
      </span>
      <span className="text-[9px] opacity-80 relative z-10">({count})</span>
    </Button>
  );
}

// A full-width toggle, distinct from the Yes/No vote, letting the user raise
// their hand to be personally involved. Active state uses the warm "orange"
// gel (mac) / amber overlay (retro) so it reads apart from the green/red votes.
function InvolvementButton({
  active,
  count,
  onClick,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const { isMacTheme } = useOsTheme();
  const label = active ? "★ Count me in" : "☆ I'm interested";

  if (isMacTheme) {
    return (
      <Button
        variant="secondary"
        onClick={onClick}
        aria-pressed={active}
        title="Flag that you'd like to be personally involved in this project"
        className={cn(
          "w-full h-auto min-h-[36px] py-1.5 px-2 flex items-center justify-center gap-1.5 touch-manipulation",
          active && "orange"
        )}
      >
        <span className="font-semibold text-[11px] leading-tight">{label}</span>
        <span className="text-[10px] opacity-90">({count})</span>
      </Button>
    );
  }

  return (
    <Button
      variant="retro"
      onClick={onClick}
      aria-pressed={active}
      title="Flag that you'd like to be personally involved in this project"
      className={cn(
        "w-full h-auto min-h-[36px] py-1.5 px-2 text-xs flex items-center justify-center gap-1.5 focus:outline-none focus:ring-0 relative overflow-hidden touch-manipulation",
        active && "[border-image:url('/assets/button-default.svg')_60_stretch]"
      )}
      style={{
        backgroundColor: active
          ? "rgba(245, 158, 11, 0.95)"
          : "rgba(245, 158, 11, 0.2)",
      }}
    >
      <span className="font-semibold text-[11px] leading-tight relative z-10">
        {label}
      </span>
      <span className="text-[10px] opacity-80 relative z-10">({count})</span>
    </Button>
  );
}
