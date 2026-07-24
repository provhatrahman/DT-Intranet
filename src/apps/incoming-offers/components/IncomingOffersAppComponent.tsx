import { useState, useEffect, useMemo, useCallback } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { IncomingOffersMenuBar } from "./IncomingOffersMenuBar";
import HelpGuideDialog from "@/components/help/HelpGuideDialog";
import { FeedbackDialog } from "@/components/dialogs/FeedbackDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import {
  ProjectDetailsFormDialog,
  ProjectDetailsFormValues,
  EMPTY_PROJECT_DETAILS,
  toUpdatePayload,
} from "./ProjectDetailsFormDialog";
import { LogOfferDialog, LogOfferFormValues } from "./LogOfferDialog";
import {
  useEffectiveGreenroomAccount,
  useIsGreenroomAdmin,
} from "@/hooks/useGreenroomAccount";
import { usePitchesStore } from "@/stores/usePitchesStore";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { useBookingsStore } from "@/stores/useBookingsStore";
import { useArtistsStore } from "@/stores/useArtistsStore";
import { useLoggedOffersStore } from "@/stores/useLoggedOffersStore";
import { parsePitchDescription } from "@/lib/api/pitches";
import { createArtist } from "@/lib/api/artists";
import { deleteProject } from "@/lib/api/projects";
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
  CommentThread,
  EmptyState,
  StatusBadge,
  useOsTheme,
  type ThreadComment,
} from "@/components/greenroom";
import {
  AlertCircle,
  Banknote,
  Building2,
  Calendar,
  CalendarClock,
  ChevronDown,
  Clock,
  Inbox,
  MessageSquare,
  SearchX,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

// Strips currency symbols/commas/etc. down to a plain number, preserving a
// single decimal point — "£1,500.50" -> "1500.50" — so fee sorting compares
// magnitudes correctly instead of concatenating digits ("1500.50" used to
// sort as 150050).
function digitsOnly(text: string | undefined): string {
  return (text ?? "").replace(/[^0-9.]/g, "");
}

// Offer fields are free text from two different backends, so dates arrive as
// anything from ISO strings to "mid August". Pretty-print the ISO ones and
// pass everything else through untouched.
function formatFactDate(value: string | undefined): string {
  if (!value) return "TBD";
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Adds thousands separators to purely numeric fees ("5000" → "5,000") and
// leaves free-text ones ("£500 + travel", "TBD") alone.
function formatFactFee(value: string): string {
  return /^\d+(\.\d+)?$/.test(value.trim())
    ? Number(value).toLocaleString()
    : value;
}

// One labeled fact in the offer card's detail grid. Placeholder values render
// dimmed so real data stands out when scanning a wall of cards.
function Fact({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  className?: string;
}) {
  const isUnset = !value || value === "TBD" || value === "Unknown";
  return (
    <div className={cn("flex items-start gap-1.5 min-w-0", className)}>
      <Icon
        className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5"
        aria-hidden
      />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            "text-xs break-words",
            isUnset && "text-muted-foreground/70 italic"
          )}
        >
          {value || "TBD"}
        </div>
      </div>
    </div>
  );
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
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState<
    "date-asc" | "date-desc" | "fee" | "submitted-asc" | "submitted-desc"
  >("submitted-desc");

  // Feedback dialog: optional comment attached to a "yes"/"no" vote, or the
  // reason for rejecting a pitch outright.
  const [feedbackMode, setFeedbackMode] = useState<
    "vote-yes" | "vote-no" | "reject-pitch"
  >("vote-no");
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
  const [isDeclining, setIsDeclining] = useState(false);

  // Delete logged offer confirm (removes the booking + its stand-in project)
  const [pendingDeleteOfferId, setPendingDeleteOfferId] = useState<
    string | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete comment confirm (public comment thread on a pitch/offer card)
  const [pendingDeleteComment, setPendingDeleteComment] = useState<{
    offer: Offer;
    commentId: number;
  } | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

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
    addComment: addPitchComment,
    updateComment: updatePitchComment,
    deleteComment: deletePitchComment,
    isLoading: isPitchesLoading,
    error: pitchesError,
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
    deleteBooking,
    voteOnBooking,
    addComment: addBookingComment,
    updateComment: updateBookingComment,
    deleteComment: deleteBookingComment,
    isLoading: isBookingsLoading,
    error: bookingsError,
  } = useBookingsStore();
  const { artists, fetchArtists, findByName } = useArtistsStore();
  const { recordOwnedBooking, forgetOwnedBooking, ownsBooking } =
    useLoggedOffersStore();

  const { isMacTheme, isXpTheme } = useOsTheme();

  // Loads the three backends the inbox depends on. Failures are surfaced via
  // the stores' own `error` fields (read below) rather than swallowed — an
  // empty `offers` list caused by a failed fetch renders a distinct
  // "couldn't load" state instead of the zero-state "Inbox zero" copy.
  const loadInbox = useCallback(() => {
    fetchPitches().catch((err) => {
      console.error("Failed to fetch pitches:", err);
    });
    fetchBookings().catch((err) => {
      console.error("Failed to fetch bookings:", err);
    });
    fetchArtists().catch((err) => {
      console.error("Failed to fetch artists:", err);
    });
  }, [fetchPitches, fetchBookings, fetchArtists]);

  useEffect(() => {
    if (isWindowOpen) {
      loadInbox();
    }
  }, [isWindowOpen, loadInbox]);

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
        // Header subtitle shows the location (city/country); the grid's Venue
        // row uses the real venue name.
        promoter: [b.city, b.country].filter(Boolean).join(", ") || "Unknown",
        venue: b.venue_name || "TBD",
        date: b.event_date || "TBD",
        fee: b.agreed_fee || "TBD",
        timings: b.timings || "TBD",
        submittedAt: b.date_created ?? undefined,
        bookingId: b.booking_id,
        projectId: b.project_id,
        artistName: b.artist_name,
        createdByUserId: b.created_by_user_id,
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

  // Public, named comments on an offer, from whichever backend backs it.
  // Pre-filtered to comment_type === "public" so the anonymous vote-comment
  // and rejection-reason channels (comment_type "feedback") never leak into
  // the Inbox's own comment thread.
  const getOfferComments = useCallback(
    (offer: Offer): ThreadComment[] => {
      if (offer.source === "pitch" && offer.pitchId) {
        return (pitchDetails[offer.pitchId]?.comments ?? []).filter(
          (c) => c.comment_type === "public"
        );
      }
      if (offer.source === "booking" && offer.bookingId) {
        return (bookingDetails[offer.bookingId]?.comments ?? []).filter(
          (c) => c.comment_type === "public"
        );
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

    // Casting a fresh yes/no vote collects an optional comment first, so the
    // reason travels with the vote back to the submitter's Pitch app. Toggling
    // your existing choice off (below) skips the dialog.
    if (choice === "yes" && current !== "yes") {
      setFeedbackMode("vote-yes");
      setPendingFeedbackOfferId(offer.id);
      setFeedbackText("");
      setIsFeedbackDialogOpen(true);
      return;
    }
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
      if (feedbackMode === "vote-yes" || feedbackMode === "vote-no") {
        // Yes/No vote with an optional comment — route to the right backend.
        // The comment is stored on the vote and surfaced to the submitter in
        // the Pitch app's "My Pitches" tab.
        const voteValue: 1 | -1 = feedbackMode === "vote-yes" ? 1 : -1;
        if (offer.source === "pitch" && offer.pitchId) {
          await voteOnPitch(offer.pitchId, {
            user_id: greenroomUserId,
            vote_value: voteValue,
            comment: feedback,
          });
        } else if (offer.source === "booking" && offer.bookingId) {
          await voteOnBooking(offer.bookingId, {
            user_id: greenroomUserId,
            vote_value: voteValue,
            comment: feedback,
          });
        }
        toast.success("Vote recorded");
      } else if (offer.pitchId) {
        // Reject the pitch outright: record the reason as a comment (visible
        // to the submitter in the Pitch app) and set status to rejected.
        // Explicitly "feedback" — keeps rejection reasons in the anonymous
        // channel, distinct from the Inbox's public comment thread.
        if (feedback.trim()) {
          await addPitchComment(offer.pitchId, {
            user_id: greenroomUserId,
            comment: feedback.trim(),
            comment_type: "feedback",
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
    if (isApproving) return;
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
    if (isDeclining) return;
    if (pendingDeclineBookingId === null) return;
    if (!isAdmin) {
      toast.error("Only admins can decline offers");
      setPendingDeclineBookingId(null);
      return;
    }
    // The stand-in project the Log Offer flow created (on_hold) would
    // otherwise become an invisible orphan once its only booking is
    // declined — every app filters projects by status, and "on_hold" isn't
    // shown anywhere. Cancel it too so the record surfaces in Archive.
    const offer = offers.find((o) => o.bookingId === pendingDeclineBookingId);
    setIsDeclining(true);
    try {
      await setBookingStatus(pendingDeclineBookingId, "declined");
      if (offer?.projectId != null) {
        try {
          await updateStatus(offer.projectId, "cancelled");
        } catch (projectError) {
          console.warn(
            `Declined booking ${pendingDeclineBookingId} but could not cancel project ${offer.projectId}:`,
            projectError
          );
        }
      }
      await fetchActiveProjects();
      toast.success("Offer declined");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to decline offer";
      toast.error(message);
    } finally {
      setIsDeclining(false);
      setPendingDeclineBookingId(null);
    }
  };

  // Whether the current user is allowed to delete a given offer card. Only
  // logged (booking) offers are deletable — pitches come from the Pitch app and
  // have their own reject flow. Admins can delete any logged offer. For
  // everyone else, prefer the server-recorded creator (created_by_user_id) —
  // matching it is now also enforced server-side — and only fall back to the
  // client-side "did I log this" tracking (ownsBooking) for legacy bookings
  // that predate the backend field (null/undefined).
  const canDeleteOffer = useCallback(
    (offer: Offer): boolean => {
      if (offer.source !== "booking" || !offer.bookingId) return false;
      if (isAdmin) return true;
      if (offer.createdByUserId != null) {
        return (
          greenroomUserId != null && offer.createdByUserId === greenroomUserId
        );
      }
      return ownsBooking(greenroomUserId, offer.bookingId);
    },
    [isAdmin, ownsBooking, greenroomUserId]
  );

  const handleDeleteConfirm = async () => {
    if (isDeleting) return;
    const offer = offers.find((o) => o.id === pendingDeleteOfferId);
    if (!offer || !offer.bookingId || !canDeleteOffer(offer)) {
      setPendingDeleteOfferId(null);
      return;
    }
    setIsDeleting(true);
    try {
      // Delete the booking first — the project delete is blocked by the backend
      // while a booking is still attached to it.
      await deleteBooking(offer.bookingId);
      if (greenroomUserId) {
        forgetOwnedBooking(greenroomUserId, offer.bookingId);
      }
      // Best-effort: also remove the stand-in project the log-offer flow created.
      // It can legitimately fail (e.g. the project has since gained other linked
      // records), in which case we still consider the card deleted.
      if (offer.projectId != null) {
        try {
          await deleteProject(offer.projectId);
          await fetchActiveProjects();
        } catch (projectError) {
          console.warn(
            `Deleted booking ${offer.bookingId} but could not delete project ${offer.projectId}:`,
            projectError
          );
        }
      }
      toast.success(`"${offer.name}" deleted`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete offer";
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setPendingDeleteOfferId(null);
    }
  };

  // Public comment thread on an offer card. Independent of voting — no vote
  // requirement or check anywhere in this path.
  const handlePostComment = async (
    offer: Offer,
    text: string,
    parentCommentId: number | null
  ) => {
    if (!greenroomUserId) {
      toast.error("Please set up your Greenroom account to comment");
      throw new Error("No Greenroom account");
    }
    try {
      if (offer.source === "pitch" && offer.pitchId) {
        await addPitchComment(offer.pitchId, {
          user_id: greenroomUserId,
          comment: text,
          parent_comment_id: parentCommentId,
          comment_type: "public",
        });
      } else if (offer.source === "booking" && offer.bookingId) {
        await addBookingComment(offer.bookingId, {
          user_id: greenroomUserId,
          comment: text,
          parent_comment_id: parentCommentId,
          comment_type: "public",
        });
      }
      toast.success("Comment posted");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to post comment";
      toast.error(message);
      throw error;
    }
  };

  const handleEditComment = async (
    offer: Offer,
    commentId: number,
    text: string
  ) => {
    if (!greenroomUserId) {
      toast.error("Please set up your Greenroom account to edit comments");
      throw new Error("No Greenroom account");
    }
    try {
      if (offer.source === "pitch" && offer.pitchId) {
        await updatePitchComment(
          offer.pitchId,
          commentId,
          text,
          greenroomUserId
        );
      } else if (offer.source === "booking" && offer.bookingId) {
        await updateBookingComment(
          offer.bookingId,
          commentId,
          text,
          greenroomUserId
        );
      }
      toast.success("Comment updated");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update comment";
      toast.error(message);
      throw error;
    }
  };

  const handleDeleteCommentConfirm = async () => {
    if (isDeletingComment) return;
    if (!pendingDeleteComment || !greenroomUserId) {
      setPendingDeleteComment(null);
      return;
    }
    const { offer, commentId } = pendingDeleteComment;
    setIsDeletingComment(true);
    try {
      if (offer.source === "pitch" && offer.pitchId) {
        await deletePitchComment(offer.pitchId, commentId, greenroomUserId);
      } else if (offer.source === "booking" && offer.bookingId) {
        await deleteBookingComment(
          offer.bookingId,
          commentId,
          greenroomUserId
        );
      }
      toast.success("Comment deleted");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete comment";
      toast.error(message);
    } finally {
      setIsDeletingComment(false);
      setPendingDeleteComment(null);
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
      const bookingId = await createBooking({
        artist_id: artistId,
        project_id: projectId,
        status: "pending",
        agreed_fee: values.agreed_fee.trim() || undefined,
        notes: values.notes.trim() || undefined,
        timings: values.timings.trim() || undefined,
      });
      // Remember that this user logged this offer so they can delete their own
      // card later even without admin rights (ownership is client-side only).
      if (greenroomUserId) {
        recordOwnedBooking(greenroomUserId, bookingId);
      }
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
      return (
        (parseFloat(digitsOnly(b.fee)) || 0) -
        (parseFloat(digitsOnly(a.fee)) || 0)
      );
    });

  const pendingApproveOffer = offers.find(
    (o) => o.id === pendingApproveOfferId
  );

  const menuBar = (
    <IncomingOffersMenuBar
      onClose={onClose}
      onShowHelp={() => setIsHelpDialogOpen(true)}
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
            {/* Quick read on inbox volume; switches to match-count while
                searching so filtering visibly narrows the grid. */}
            <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">
              {filter
                ? `${filteredOffers.length} of ${offers.length}`
                : `${offers.length} pending`}
            </span>
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
            {offers.length === 0 && (isPitchesLoading || isBookingsLoading) ? (
              <EmptyState icon={Inbox} title="Loading offers…" />
            ) : offers.length === 0 && (pitchesError || bookingsError) ? (
              <EmptyState
                icon={AlertCircle}
                title="Couldn't load offers"
                hint={
                  pitchesError ||
                  bookingsError ||
                  "Something went wrong while loading the inbox."
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={loadInbox}
                >
                  Retry
                </Button>
              </EmptyState>
            ) : offers.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Inbox zero"
                hint="Incoming pitches and logged offers awaiting a decision show up here."
              />
            ) : filteredOffers.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No offers match your search"
                hint="Try a different name, promoter, venue, or artist."
              />
            ) : (
              <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 gap-4 p-4">
                {filteredOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    isAdmin={isAdmin}
                    canDelete={canDeleteOffer(offer)}
                    userVote={getUserVote(offer)}
                    userInvolved={getUserInvolvement(offer)}
                    counts={voteCounts[offer.id]}
                    comments={getOfferComments(offer)}
                    currentUserId={greenroomUserId}
                    onVote={(choice) => handleVote(offer, choice)}
                    onToggleInvolvement={() => handleToggleInvolvement(offer)}
                    onApprove={() => handleApproveClick(offer.id)}
                    onDelete={() => setPendingDeleteOfferId(offer.id)}
                    onReject={() =>
                      offer.source === "pitch"
                        ? handleRejectClick(offer)
                        : setPendingDeclineBookingId(offer.bookingId ?? null)
                    }
                    onPostComment={(text, parentCommentId) =>
                      handlePostComment(offer, text, parentCommentId)
                    }
                    onEditComment={(commentId, text) =>
                      handleEditComment(offer, commentId, text)
                    }
                    onRequestDeleteComment={(commentId) =>
                      setPendingDeleteComment({ offer, commentId })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <HelpGuideDialog
          isOpen={isHelpDialogOpen}
          onOpenChange={setIsHelpDialogOpen}
          guideId="incoming-offers"
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
            feedbackMode === "vote-yes"
              ? "Vote Yes"
              : feedbackMode === "vote-no"
              ? "Vote No"
              : "Reject Pitch"
          }
          description={
            feedbackMode === "vote-yes"
              ? "Optionally add a comment with your yes vote. It's shared with the submitter in their Pitch app."
              : feedbackMode === "vote-no"
              ? "Optionally explain your no vote. The comment is stored with your vote and shared with the submitter in their Pitch app."
              : "Provide feedback for why this pitch is being rejected. It will be added as a comment for the submitter, and the pitch will be marked rejected."
          }
          value={feedbackText}
          onChange={setFeedbackText}
          submitLabel={
            feedbackMode === "reject-pitch" ? "Reject Pitch" : "Submit Vote"
          }
          // Vote comments are optional; a rejection reason is required.
          allowEmpty={feedbackMode !== "reject-pitch"}
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
          confirmDisabled={isApproving}
        />
        <ConfirmDialog
          isOpen={pendingDeclineBookingId !== null}
          onOpenChange={(open) => {
            if (!open && !isDeclining) setPendingDeclineBookingId(null);
          }}
          onConfirm={handleDeclineBookingConfirm}
          title="Decline Offer"
          description="Decline this offer? The booking will be marked as declined and its project moved to the Archive as cancelled."
          confirmDisabled={isDeclining}
        />
        <ConfirmDialog
          isOpen={pendingDeleteOfferId !== null}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setPendingDeleteOfferId(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Delete Offer"
          description="Permanently delete this logged offer? The booking and the project it created will be removed. This can't be undone."
          confirmDisabled={isDeleting}
        />
        <ConfirmDialog
          isOpen={pendingDeleteComment !== null}
          onOpenChange={(open) => {
            if (!open && !isDeletingComment) setPendingDeleteComment(null);
          }}
          onConfirm={handleDeleteCommentConfirm}
          title="Delete Comment"
          description="Permanently delete this comment? This can't be undone."
          confirmDisabled={isDeletingComment}
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
  canDelete,
  userVote,
  userInvolved,
  counts,
  comments,
  currentUserId,
  onVote,
  onToggleInvolvement,
  onApprove,
  onDelete,
  onReject,
  onPostComment,
  onEditComment,
  onRequestDeleteComment,
}: {
  offer: Offer;
  isAdmin: boolean;
  canDelete: boolean;
  userVote: PitchVoteChoice | null;
  userInvolved: boolean;
  counts?: PitchVoteCounts;
  comments: ThreadComment[];
  currentUserId: number | null;
  onVote: (choice: PitchVoteChoice) => void;
  onToggleInvolvement: () => void;
  onApprove: () => void;
  onDelete: () => void;
  onReject: () => void;
  onPostComment: (text: string, parentCommentId: number | null) => Promise<void>;
  onEditComment: (commentId: number, text: string) => Promise<void>;
  onRequestDeleteComment: (commentId: number) => void;
}) {
  const { isMacTheme } = useOsTheme();
  const isPitch = offer.source === "pitch";
  const [commentsOpen, setCommentsOpen] = useState(false);

  return (
    <AquaCard interactive className="flex flex-col h-full overflow-hidden">
      <CardHeader className={cn("pb-3", !isMacTheme && "bg-muted/5")}>
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-lg leading-tight">
              {offer.name}
            </CardTitle>
            <CardDescription>{offer.promoter}</CardDescription>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge
              status={offer.source}
              label={isPitch ? "Pitch" : "Offer"}
              tone={isPitch ? "purple" : "blue"}
              className="uppercase tracking-wide"
            />
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                title="Delete this offer"
                aria-label="Delete this offer"
                className="h-7 w-7 text-muted-foreground hover:text-destructive touch-manipulation"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 py-4 space-y-3 text-sm">
        {offer.description && (
          <p className="text-muted-foreground line-clamp-3">
            {offer.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
          <Fact
            icon={Calendar}
            label="Event Date"
            value={formatFactDate(offer.date)}
          />
          <Fact icon={Banknote} label="Fee" value={formatFactFee(offer.fee)} />
          <Fact icon={Building2} label="Venue" value={offer.venue} />
          <Fact icon={Clock} label="Time" value={offer.timings} />
          {offer.submittedAt && (
            <Fact
              icon={CalendarClock}
              label="Submitted"
              value={formatFactDate(offer.submittedAt)}
              className="col-span-2"
            />
          )}
        </div>
      </CardContent>
      {/* Public, named comment thread — independent of voting; anyone can
          post/reply regardless of their vote state. */}
      <div
        className={cn(
          "px-6 border-t",
          isMacTheme ? "border-black/10" : "border-border"
        )}
      >
        <button
          type="button"
          onClick={() => setCommentsOpen((open) => !open)}
          aria-expanded={commentsOpen}
          className={cn(
            "w-full flex items-center justify-between gap-2 py-2.5 text-xs font-medium touch-manipulation",
            isMacTheme
              ? "text-gray-700 dark:text-neutral-300"
              : "text-muted-foreground"
          )}
        >
          <span className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            Comments ({comments.length})
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              commentsOpen && "rotate-180"
            )}
            aria-hidden
          />
        </button>
        {commentsOpen && (
          <div className="pb-3">
            <CommentThread
              comments={comments}
              currentUserId={currentUserId}
              onPost={onPostComment}
              onEdit={onEditComment}
              onRequestDelete={onRequestDeleteComment}
            />
          </div>
        )}
      </div>
      {/* Everyone votes Yes/No and can raise a hand to be involved; the
          terminal decisions (Approve / Reject) are admin-only and sit in
          their own divided row so community and admin actions don't blur. */}
      <CardFooter
        className={cn(
          "pt-3 border-t flex flex-col gap-2",
          isMacTheme ? "border-black/10" : "bg-muted/5"
        )}
      >
        <div className="w-full grid grid-cols-2 gap-2">
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
        </div>
        {/* Separate from the yes/no vote: register personal interest in working
            on this project. A voter can flag this whether they voted yes, no,
            or not at all. */}
        <InvolvementButton
          active={userInvolved}
          count={counts?.involved ?? 0}
          onClick={onToggleInvolvement}
        />
        {isAdmin && (
          <div
            className={cn(
              "w-full flex gap-2 mt-1 pt-3 border-t",
              isMacTheme ? "border-black/10" : "border-border"
            )}
          >
            <Button
              variant="default"
              onClick={onApprove}
              className="flex-1 min-h-[36px] touch-manipulation"
              title="Approve and move to Active Projects"
            >
              <span className="font-semibold">Approve</span>
            </Button>
            <Button
              variant={isMacTheme ? "secondary" : "outline"}
              onClick={onReject}
              className="min-h-[36px] px-3 touch-manipulation"
              title={
                isPitch
                  ? "Reject this pitch with feedback"
                  : "Decline this offer"
              }
            >
              <span
                className={cn(
                  "text-xs font-semibold",
                  !isMacTheme && "text-destructive"
                )}
              >
                {isPitch ? "Reject" : "Decline"}
              </span>
            </Button>
          </div>
        )}
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

  const title = active
    ? "Click again to clear your vote"
    : "Cast your vote — an optional comment is shared with the submitter";

  if (isMacTheme) {
    // Inactive votes read as neutral gel buttons; the user's active vote gets
    // the colored gel treatment (emerald yes / red no) from themes.css.
    return (
      <Button
        variant="secondary"
        onClick={onClick}
        aria-pressed={active}
        title={title}
        className={cn(
          "w-full h-auto min-h-[40px] py-1.5 px-2 flex items-center justify-center gap-1.5 touch-manipulation",
          active && (color === "green" ? "emerald" : "red")
        )}
      >
        <span className="font-semibold text-xs leading-tight">{children}</span>
        <span className="text-[10px] opacity-90">({count})</span>
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
      title={title}
      className={cn(
        "h-auto min-h-[40px] py-1.5 px-2 text-xs flex items-center justify-center gap-1.5 w-full focus:outline-none focus:ring-0 relative overflow-hidden touch-manipulation",
        active && "[border-image:url('/assets/button-default.svg')_60_stretch]"
      )}
      style={{
        backgroundColor: overlay,
      }}
    >
      <span className="font-semibold text-xs leading-tight relative z-10">
        {children}
      </span>
      <span className="text-[10px] opacity-80 relative z-10">({count})</span>
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
