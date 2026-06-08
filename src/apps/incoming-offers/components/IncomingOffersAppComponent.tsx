import { useState, useEffect, useMemo } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { IncomingOffersMenuBar } from "./IncomingOffersMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { FeedbackDialog } from "@/components/dialogs/FeedbackDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { helpItems, appMetadata } from "..";
import { useThemeStore } from "@/stores/useThemeStore";
import { useEffectiveGreenroomAccount } from "@/hooks/useGreenroomAccount";
import { usePitchesStore } from "@/stores/usePitchesStore";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { parsePitchDescription } from "@/lib/api/pitches";
import { Offer, dummyOffers, initialVoteCounts, VoteCounts } from "../data";
import { toast } from "sonner";

// Events/bookings endpoints are currently broken on the backend (500). Until
// they are fixed, the inbox falls back to the local dummyOffers for the
// non-pitch (event/booking) portion. Flip this flag to false and wire up
// getBookings()/getEvents() once the backend is repaired.
const USE_DUMMY_EVENT_OFFERS = true;
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

type VoteOption = "accept" | "interested" | "decline" | "recommend";

interface UserVote {
  accept: boolean;
  interested: boolean;
  decline: boolean;
  recommend: boolean;
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
  const [sortBy, setSortBy] = useState<"date-asc" | "date-desc" | "fee" | "submitted-asc" | "submitted-desc">("submitted-desc");
  
  // Local state to track user's votes for non-pitch offers: offerId -> UserVote
  const [userVotes, setUserVotes] = useState<Record<string, UserVote>>({});
  
  // Feedback dialog state
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [pendingDeclineOfferId, setPendingDeclineOfferId] = useState<string | null>(null);
  
  // Approve dialog state
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [pendingApproveOfferId, setPendingApproveOfferId] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  // Dummy (event/booking) offers approved this session are hidden locally,
  // since there is no backend record to track their state yet.
  const [approvedDummyIds, setApprovedDummyIds] = useState<Set<string>>(
    () => new Set()
  );

  const effectiveAccount = useEffectiveGreenroomAccount();
  const greenroomUserId = effectiveAccount.userId;

  const {
    pitches,
    pitchDetails,
    fetchPitches,
    refreshPitch,
    voteOnPitch,
    updatePitch,
  } = usePitchesStore();
  const { createProject } = useProjectsStore();

  const currentTheme = useThemeStore((state) => state.current);
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  const isMacOSTheme = currentTheme === "macosx";

  // Initialize user votes from localStorage if available (for non-pitch offers)
  useEffect(() => {
    const savedVotes = localStorage.getItem("incoming_offers_votes");
    if (savedVotes) {
      setUserVotes(JSON.parse(savedVotes));
    }
  }, []);

  // Fetch pitches when component mounts
  useEffect(() => {
    if (isWindowOpen) {
      fetchPitches().catch((err) => {
        console.error("Failed to fetch pitches:", err);
      });
    }
  }, [isWindowOpen, fetchPitches]);

  // Convert pitches to Offer format and merge with dummy offers
  const offers = useMemo(() => {
    const pitchOffers: Offer[] = pitches.map((pitch) => {
      const detail = pitchDetails[pitch.id];
      const { description: pitchDescription, metadata } = parsePitchDescription(pitch.description);
      
      // Calculate vote counts from pitch votes
      const voteCounts: VoteCounts = {
        accept: 0,
        interested: 0,
        decline: 0,
        recommend: 0,
      };

      if (detail?.votes) {
        detail.votes.forEach((vote) => {
          if (vote.vote_value === 1) {
            voteCounts.accept++;
          } else if (vote.vote_value === -1) {
            voteCounts.decline++;
          } else if (vote.vote_value === 0) {
            // vote_value 0 is overloaded via a comment prefix. A bare 0 with no
            // recognized prefix is an abstain/comment-only vote and must not be
            // miscounted as "interested".
            const comment = vote.comment || "";
            if (comment.startsWith("[INTERESTED]")) {
              voteCounts.interested++;
            } else if (comment.startsWith("[RECOMMEND]")) {
              voteCounts.recommend++;
            }
          }
        });
      }

      return {
        id: `pitch-${pitch.id}`,
        name: pitch.title,
        description: pitchDescription,
        promoter: "Internal Pitch",
        venue: metadata.venue || "TBD",
        date: metadata.keyDates || "TBD",
        fee: metadata.budget || "TBD",
        timings: metadata.timelines || "TBD",
        source: "pitch" as const,
        status: pitch.status === "approved" || pitch.status === "implemented" ? "reviewed" as const : "new" as const,
        submittedAt: pitch.date_submitted,
        pitchId: pitch.id,
        pitchStatus: pitch.status,
        pitchVotes: voteCounts,
      };
    });

    // Pitch offers that have been approved (linked to a project) have left the
    // inbox and should no longer appear here.
    const visiblePitchOffers = pitchOffers.filter(
      (o) => o.pitchStatus !== "approved" && o.pitchStatus !== "implemented"
    );

    // Dummy event/booking offers are a local-only fallback while those backend
    // endpoints are broken. Hide any approved this session.
    const eventOffers = USE_DUMMY_EVENT_OFFERS
      ? dummyOffers.filter((o) => !approvedDummyIds.has(o.id))
      : [];

    return [...eventOffers, ...visiblePitchOffers];
  }, [pitches, pitchDetails, approvedDummyIds]);

  // Calculate aggregated counts: use pitch votes for pitches, localStorage votes for others
  const aggregatedCounts = useMemo(() => {
    const counts: Record<string, VoteCounts> = {};
    offers.forEach((offer) => {
      if (offer.source === "pitch" && offer.pitchVotes) {
        // Use pitch votes directly from API
        counts[offer.id] = { ...offer.pitchVotes };
      } else {
        // Use localStorage votes for non-pitch offers
        const baseCounts = initialVoteCounts[offer.id] || { accept: 0, interested: 0, decline: 0, recommend: 0 };
        const userVote = userVotes[offer.id] || { accept: false, interested: false, decline: false, recommend: false };
        
        counts[offer.id] = {
          accept: baseCounts.accept + (userVote.accept ? 1 : 0),
          interested: baseCounts.interested + (userVote.interested ? 1 : 0),
          decline: baseCounts.decline + (userVote.decline ? 1 : 0),
          recommend: baseCounts.recommend + (userVote.recommend ? 1 : 0),
        };
      }
    });
    return counts;
  }, [userVotes, offers]);

  const handleVote = async (offerId: string, option: VoteOption) => {
    const offer = offers.find(o => o.id === offerId);
    const isPitchCard = offer?.source === "pitch" && offer.pitchId;

    if (isPitchCard && greenroomUserId) {
      // Handle pitch voting via API
      const pitchId = offer.pitchId!;
      const detail = pitchDetails[pitchId];
      
      // Check if user already voted
      const existingVote = detail?.votes?.find((v) => v.user_id === greenroomUserId);
      const currentVoteValue = existingVote?.vote_value;

      // If declining and not already declined, show feedback dialog
      if (option === "decline" && currentVoteValue !== -1) {
        setPendingDeclineOfferId(offerId);
        setFeedbackText("");
        setIsFeedbackDialogOpen(true);
        return;
      }

      // Determine vote value and comment
      let voteValue: number;
      let comment: string | undefined;

      if (option === "accept") {
        voteValue = currentVoteValue === 1 ? 0 : 1; // Toggle: 1 if not voted, 0 to remove
        comment = undefined;
      } else if (option === "interested") {
        const isCurrentlyInterested = currentVoteValue === 0 && existingVote?.comment?.startsWith("[INTERESTED]");
        if (isCurrentlyInterested) {
          // Remove vote by setting to accept (1) then back, or just submit 0 with empty comment
          voteValue = 0;
          comment = "";
        } else {
          voteValue = 0;
          comment = "[INTERESTED]";
        }
      } else if (option === "decline") {
        voteValue = currentVoteValue === -1 ? 0 : -1; // Toggle: -1 if not declined, 0 to remove
        comment = feedbackText || undefined;
      } else if (option === "recommend") {
        const isCurrentlyRecommend = currentVoteValue === 0 && existingVote?.comment?.startsWith("[RECOMMEND]");
        if (isCurrentlyRecommend) {
          // Remove vote
          voteValue = 0;
          comment = "";
        } else {
          voteValue = 0;
          comment = "[RECOMMEND]";
        }
      } else {
        return;
      }

      try {
        await voteOnPitch(pitchId, {
          user_id: greenroomUserId,
          vote_value: voteValue,
          comment,
        });
        await refreshPitch(pitchId);
        await fetchPitches(); // Refresh list to update counts
        toast.success("Vote recorded");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to vote";
        toast.error(message);
      }
    } else if (!isPitchCard) {
      // Handle non-pitch voting via localStorage
      const currentVote = userVotes[offerId] || {
        accept: false,
        interested: false,
        decline: false,
        recommend: false,
      };

      let newVote = { ...currentVote };

      if (option === "accept") {
        newVote.accept = !newVote.accept;
        if (newVote.accept) {
          newVote.decline = false;
          newVote.recommend = false;
        }
      } else if (option === "interested") {
        newVote.interested = !newVote.interested;
        newVote.accept = newVote.interested;
        if (newVote.interested) {
          newVote.decline = false;
          newVote.recommend = false;
        }
      } else if (option === "decline") {
        newVote = {
          accept: false,
          interested: false,
          decline: !currentVote.decline,
          recommend: false,
        };
      } else if (option === "recommend") {
        newVote = {
          accept: false,
          interested: false,
          decline: false,
          recommend: !currentVote.recommend,
        };
      }

      setUserVotes((prev) => {
        const newVotes = { ...prev, [offerId]: newVote };
        localStorage.setItem("incoming_offers_votes", JSON.stringify(newVotes));
        return newVotes;
      });
    } else if (!greenroomUserId) {
      toast.error("Please set up your Greenroom account to vote on pitches");
    }
  };

  const handleFeedbackSubmit = async (feedback: string) => {
    if (!pendingDeclineOfferId || !greenroomUserId) return;

    const offer = offers.find((o) => o.id === pendingDeclineOfferId);
    const isPitchCard = offer?.source === "pitch" && offer.pitchId;

    if (isPitchCard) {
      // Submit vote with comment via API
      try {
        const pitchId = offer.pitchId!;
        await voteOnPitch(pitchId, {
          user_id: greenroomUserId,
          vote_value: -1,
          comment: feedback,
        });
        await refreshPitch(pitchId);
        toast.success("Feedback submitted");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to submit feedback";
        toast.error(message);
      }
    } else {
      // Non-pitch (dummy event) offers have no backend record yet; record the
      // decline vote locally so the UI reflects it.
      setUserVotes((prev) => {
        const newVote = {
          accept: false,
          interested: false,
          decline: true,
          recommend: false,
        };
        const newVotes = { ...prev, [pendingDeclineOfferId]: newVote };
        localStorage.setItem("incoming_offers_votes", JSON.stringify(newVotes));
        return newVotes;
      });
    }

    setIsFeedbackDialogOpen(false);
    setFeedbackText("");
    setPendingDeclineOfferId(null);
  };

  const handleFeedbackDialogClose = () => {
    setIsFeedbackDialogOpen(false);
    setFeedbackText("");
    setPendingDeclineOfferId(null);
  };

  const handleApproveClick = (offerId: string) => {
    setPendingApproveOfferId(offerId);
    setIsApproveDialogOpen(true);
  };

  const handleApproveConfirm = async () => {
    if (!pendingApproveOfferId) return;

    const offer = offers.find((o) => o.id === pendingApproveOfferId);
    if (!offer) {
      setIsApproveDialogOpen(false);
      setPendingApproveOfferId(null);
      return;
    }

    setIsApproving(true);
    try {
      // Create a backend project for the approved offer.
      const projectId = await createProject({
        name: offer.name,
        description: offer.description,
        status: "active",
        updated_by_user_id: greenroomUserId ?? undefined,
      });

      // For a pitch offer, link the pitch to the new project and approve it so
      // it leaves the inbox (replaces the old move-to-project + localStorage).
      if (offer.source === "pitch" && offer.pitchId) {
        await updatePitch(offer.pitchId, {
          project_id: projectId,
          status: "approved",
        });
        await fetchPitches();
      } else {
        // Dummy event/booking offer: hide it locally for this session.
        setApprovedDummyIds((prev) => {
          const next = new Set(prev);
          next.add(offer.id);
          return next;
        });
      }

      toast.success(`"${offer.name}" moved to Active Projects`);
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

  const handleApproveDialogClose = () => {
    if (isApproving) return;
    setIsApproveDialogOpen(false);
    setPendingApproveOfferId(null);
  };

  const filteredOffers = offers
    .filter((offer) =>
      offer.name.toLowerCase().includes(filter.toLowerCase()) ||
      offer.promoter.toLowerCase().includes(filter.toLowerCase()) ||
      offer.venue.toLowerCase().includes(filter.toLowerCase())
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
      // Simple fee sort (string comparison is not ideal but sufficient for dummy data)
      return a.fee.localeCompare(b.fee);
    });

  const menuBar = (
    <IncomingOffersMenuBar
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
        title="Inbox"
        onClose={onClose}
        isForeground={isForeground}
        appId="incoming-offers" // This will need to be added to types
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
            isMacOSTheme ? "bg-gradient-to-b from-[#ECECEC] to-[#E5E5E5]" : "bg-background"
          )}
        >
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
                    borderBottom: "var(--os-metrics-titlebar-border-width, 1px) solid var(--os-color-titlebar-border-inactive, rgba(0, 0, 0, 0.2))",
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
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-asc">Event Date (Ascending)</SelectItem>
                <SelectItem value="date-desc">Event Date (Descending)</SelectItem>
                <SelectItem value="submitted-asc">Submitted (Oldest First)</SelectItem>
                <SelectItem value="submitted-desc">Submitted (Newest First)</SelectItem>
                <SelectItem value="fee">Sort by Fee</SelectItem>
              </SelectContent>
            </Select>
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
              {filteredOffers.map((offer) => {
                // Get vote state: for pitches, check API; for others, use localStorage
                let voteState: UserVote = { accept: false, interested: false, decline: false, recommend: false };
                
                if (offer.source === "pitch" && offer.pitchId && greenroomUserId) {
                  const detail = pitchDetails[offer.pitchId];
                  const userVote = detail?.votes?.find((v) => v.user_id === greenroomUserId);
                  if (userVote) {
                    if (userVote.vote_value === 1) {
                      voteState.accept = true;
                    } else if (userVote.vote_value === -1) {
                      voteState.decline = true;
                    } else if (userVote.vote_value === 0) {
                      const comment = userVote.comment || "";
                      if (comment.startsWith("[INTERESTED]")) {
                        voteState.interested = true;
                      } else if (comment.startsWith("[RECOMMEND]")) {
                        voteState.recommend = true;
                      }
                    }
                  }
                } else {
                  voteState = userVotes[offer.id] || { accept: false, interested: false, decline: false, recommend: false };
                }

                return (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    votes={voteState}
                    counts={aggregatedCounts[offer.id]}
                    onVote={(option) => handleVote(offer.id, option)}
                    onApprove={() => handleApproveClick(offer.id)}
                  />
                );
              })}
              {filteredOffers.length === 0 && (
                  <div 
                    className="col-span-full text-center py-10 text-muted-foreground"
                    style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
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
              handleFeedbackDialogClose();
            } else {
              setIsFeedbackDialogOpen(true);
            }
          }}
          onSubmit={handleFeedbackSubmit}
          title="Provide Feedback"
          description="Please provide feedback for why this pitch was declined. This feedback will be sent anonymously to the person who submitted the pitch."
          value={feedbackText}
          onChange={setFeedbackText}
          submitLabel="Submit Feedback"
        />
        <ConfirmDialog
          isOpen={isApproveDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleApproveDialogClose();
            } else {
              setIsApproveDialogOpen(true);
            }
          }}
          onConfirm={handleApproveConfirm}
          title="Approve Project"
          description={`Are you sure you want to approve "${offers.find(o => o.id === pendingApproveOfferId)?.name || 'this project'}"? It will be moved to Active Projects where you can fill in additional details.`}
        />
      </WindowFrame>
    </>
  );
}

function OfferCard({
  offer,
  votes,
  counts,
  onVote,
  onApprove,
}: {
  offer: Offer;
  votes: UserVote;
  counts: VoteCounts;
  onVote: (option: VoteOption) => void;
  onApprove: () => void;
}) {
  const currentTheme = useThemeStore((state) => state.current);
  const isMacOSTheme = currentTheme === "macosx";
  const [isHovered, setIsHovered] = React.useState(false);

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
          background: "linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(245, 245, 245, 0.95))",
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
            background: "linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.25))",
            borderRadius: "8px 8px 4px 4px",
            filter: "blur(0.5px)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}
      <CardHeader 
        className={cn(
          "pb-3 relative z-10",
          !isMacOSTheme && "bg-muted/5"
        )}
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
                  {offer.promoter}
                </CardDescription>
            </div>
            <SourceBadge source={offer.source} />
        </div>
      </CardHeader>
      <CardContent 
        className={cn(
          "flex-1 py-4 space-y-4 text-sm relative z-10",
          !isMacOSTheme && ""
        )}
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
                <span 
                  className="text-muted-foreground font-medium"
                  style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                >
                  Date
                </span>
                <span style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                  {offer.date}
                </span>
            </div>
            <div className="flex flex-col">
                <span 
                  className="text-muted-foreground font-medium"
                  style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                >
                  Fee
                </span>
                <span style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                  {offer.fee}
                </span>
            </div>
            <div className="flex flex-col">
                <span 
                  className="text-muted-foreground font-medium"
                  style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                >
                  Venue
                </span>
                <span 
                  className="break-words"
                  style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                >
                  {offer.venue}
                </span>
            </div>
             <div className="flex flex-col">
                <span 
                  className="text-muted-foreground font-medium"
                  style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                >
                  Time
                </span>
                <span style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                  {offer.timings}
                </span>
            </div>
            {offer.submittedAt && (
              <div className="flex flex-col col-span-2">
                <span 
                  className="text-muted-foreground font-medium"
                  style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}
                >
                  Submitted
                </span>
                <span style={isMacOSTheme ? { textShadow: "0 1px 1px rgba(0, 0, 0, 0.05)" } : {}}>
                  {new Date(offer.submittedAt).toLocaleDateString(undefined, { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
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
                  background: "linear-gradient(to bottom, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))",
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
                  background: "linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.15))",
                  borderRadius: "4px 4px 2px 2px",
                  filter: "blur(0.5px)",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />
              <span className="relative z-10 font-semibold">Approve & Move to Active Projects</span>
            </>
          ) : (
            "Approve & Move to Active Projects"
          )}
        </Button>
        <div className="w-full grid grid-cols-2 gap-2">
                 <VoteButton
                    active={votes.accept}
                    count={counts?.accept || 0}
                    onClick={() => onVote("accept")}
                    color="green"
                 >
                    We should do this
                 </VoteButton>
                 <VoteButton
                     active={votes.interested}
                     count={counts?.interested || 0}
                     onClick={() => onVote("interested")}
                     color="blue"
                 >
                    I'd like to be involved
                 </VoteButton>
                 <VoteButton
                     active={votes.decline}
                     count={counts?.decline || 0}
                     onClick={() => onVote("decline")}
                     color="red"
                 >
                    Decline
                 </VoteButton>
                  <VoteButton
                     active={votes.recommend}
                     count={counts?.recommend || 0}
                     onClick={() => onVote("recommend")}
                     color="orange"
                 >
                    Recommend Other
                 </VoteButton>
        </div>
      </CardFooter>
    </Card>
  );
}

function SourceBadge({ source }: { source: "email" | "form" | "pitch" }) {
    const currentTheme = useThemeStore((state) => state.current);
    const isMacOSTheme = currentTheme === "macosx";
    
    const isEmail = source === "email";
    const isPitch = source === "pitch";
    
    if (!isMacOSTheme) {
        return (
            <Badge variant={isEmail ? 'secondary' : isPitch ? 'secondary' : 'outline'}>
                {source}
            </Badge>
        );
    }
    
    // macOS Aqua styling
    const getColorScheme = () => {
        if (isEmail) {
            return {
                gradient: "linear-gradient(to bottom, rgba(200, 220, 255, 0.9), rgba(180, 200, 240, 0.9))",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.15)",
            };
        } else if (isPitch) {
            return {
                gradient: "linear-gradient(to bottom, rgba(220, 200, 255, 0.9), rgba(200, 180, 240, 0.9))",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.15)",
            };
        } else {
            return {
                gradient: "linear-gradient(to bottom, rgba(255, 240, 200, 0.9), rgba(255, 220, 180, 0.9))",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.15)",
            };
        }
    };
    
    const colorScheme = getColorScheme();
    
    return (
        <span
            className="relative inline-flex items-center justify-center px-2.5 py-0.5 text-[10px] font-medium rounded-md overflow-hidden"
            style={{
                background: colorScheme.gradient,
                boxShadow: `
                    0 2px 4px rgba(0, 0, 0, 0.14),
                    0 1px 1px rgba(0, 0, 0, 0.25),
                    inset 0 1px 2px rgba(255, 255, 255, 0.6),
                    inset 0 0 4px rgba(0, 0, 0, 0.05),
                    inset 0 0 0 0.5px rgba(0, 0, 0, 0.48),
                    inset 0 0 0 1px rgba(0, 0, 0, 0.08)
                `,
                color: "black",
                textShadow: colorScheme.textShadow,
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
                    background: "linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.25))",
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
    color
}: { 
    active: boolean; 
    count: number; 
    onClick: () => void; 
    children: React.ReactNode;
    color: "green" | "blue" | "red" | "orange";
}) {
    const currentTheme = useThemeStore((state) => state.current);
    const isMacOSTheme = currentTheme === "macosx";
    
    const getColorGradient = () => {
        if (color === "green") {
            return active 
                ? "linear-gradient(to bottom, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))"
                : "linear-gradient(to bottom, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.3))";
        }
        if (color === "blue") {
            return active 
                ? "linear-gradient(to bottom, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))"
                : "linear-gradient(to bottom, rgba(59, 130, 246, 0.3), rgba(37, 99, 235, 0.3))";
        }
        if (color === "red") {
            return active 
                ? "linear-gradient(to bottom, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))"
                : "linear-gradient(to bottom, rgba(239, 68, 68, 0.3), rgba(220, 38, 38, 0.3))";
        }
        if (color === "orange") {
            return active 
                ? "linear-gradient(to bottom, rgba(249, 115, 22, 0.9), rgba(234, 88, 12, 0.9))"
                : "linear-gradient(to bottom, rgba(249, 115, 22, 0.3), rgba(234, 88, 12, 0.3))";
        }
        return "linear-gradient(to bottom, rgba(200, 200, 200, 0.3), rgba(180, 180, 180, 0.3))";
    };
    
    const getColorOverlay = () => {
        if (color === "green") {
            return active 
                ? "rgba(34, 197, 94, 0.95)" 
                : "rgba(34, 197, 94, 0.25)";
        }
        if (color === "blue") {
            return active 
                ? "rgba(59, 130, 246, 0.95)" 
                : "rgba(59, 130, 246, 0.25)";
        }
        if (color === "red") {
            return active 
                ? "rgba(239, 68, 68, 0.95)" 
                : "rgba(239, 68, 68, 0.25)";
        }
        if (color === "orange") {
            return active 
                ? "rgba(249, 115, 22, 0.95)" 
                : "rgba(249, 115, 22, 0.25)";
        }
        return "transparent";
    };

    if (isMacOSTheme) {
        return (
            <Button
                onClick={onClick}
                className={cn(
                    "w-full relative h-auto min-h-[60px] py-2 px-2 text-xs flex flex-col gap-0.5 items-center justify-center",
                    isMacOSTheme ? "aqua-button secondary" : ""
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
                    textShadow: active ? "0 1px 2px rgba(0, 0, 0, 0.3)" : "0 1px 1px rgba(0, 0, 0, 0.2)",
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
                            background: "linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.15))",
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
                <span className="relative z-10 text-[9px] opacity-90">
                    ({count})
                </span>
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
            <span className="font-semibold text-[10px] leading-tight text-center relative z-10">{children}</span>
            <span className="text-[9px] opacity-80 relative z-10">({count})</span>
        </Button>
    )
}
