import { useState, useEffect } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { IncomingOffersMenuBar } from "./IncomingOffersMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { helpItems, appMetadata } from "..";
import { useThemeStore } from "@/stores/useThemeStore";
import { Offer, dummyOffers, initialVoteCounts, VoteCounts } from "../data";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  const [offers] = useState<Offer[]>(dummyOffers);
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "fee">("date");
  
  // Local state to track user's votes: offerId -> UserVote
  const [userVotes, setUserVotes] = useState<Record<string, UserVote>>({});
  
  // Mock aggregated counts (base counts + user votes)
  const [aggregatedCounts, setAggregatedCounts] = useState<Record<string, VoteCounts>>(initialVoteCounts);

  const currentTheme = useThemeStore((state) => state.current);
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";

  // Initialize user votes from localStorage if available (simulated persistence)
  useEffect(() => {
    const savedVotes = localStorage.getItem("incoming_offers_votes");
    if (savedVotes) {
      setUserVotes(JSON.parse(savedVotes));
    }
  }, []);

  const handleVote = (offerId: string, option: VoteOption) => {
    setUserVotes((prev) => {
      const currentVote = prev[offerId] || {
        accept: false,
        interested: false,
        decline: false,
        recommend: false,
      };

      let newVote = { ...currentVote };

      if (option === "accept") {
        newVote.accept = !newVote.accept;
        // If accepting, clear decline/recommend
        if (newVote.accept) {
            newVote.decline = false;
            newVote.recommend = false;
        }
      } else if (option === "interested") {
        newVote.interested = !newVote.interested;
        // If interested, clear decline/recommend
        if (newVote.interested) {
            newVote.decline = false;
            newVote.recommend = false;
        }
      } else if (option === "decline") {
        // Single select logic for decline
        newVote = {
            accept: false,
            interested: false,
            decline: !currentVote.decline,
            recommend: false,
        };
      } else if (option === "recommend") {
        // Single select logic for recommend
        newVote = {
            accept: false,
            interested: false,
            decline: false,
            recommend: !currentVote.recommend,
        };
      }

      const newVotes = { ...prev, [offerId]: newVote };
      localStorage.setItem("incoming_offers_votes", JSON.stringify(newVotes));
      
      // Update aggregated counts (mock logic: simply add user vote to base counts)
      // In a real app, this would be handled by the backend
      updateAggregatedCounts(offerId, currentVote, newVote);
      
      return newVotes;
    });
  };

  const updateAggregatedCounts = (offerId: string, oldVote: UserVote, newVote: UserVote) => {
      setAggregatedCounts(prev => {
          const counts = { ...prev[offerId] };
          if (newVote.accept !== oldVote.accept) counts.accept += newVote.accept ? 1 : -1;
          if (newVote.interested !== oldVote.interested) counts.interested += newVote.interested ? 1 : -1;
          if (newVote.decline !== oldVote.decline) counts.decline += newVote.decline ? 1 : -1;
          if (newVote.recommend !== oldVote.recommend) counts.recommend += newVote.recommend ? 1 : -1;
          return { ...prev, [offerId]: counts };
      });
  };

  const filteredOffers = offers
    .filter((offer) =>
      offer.name.toLowerCase().includes(filter.toLowerCase()) ||
      offer.promoter.toLowerCase().includes(filter.toLowerCase()) ||
      offer.venue.toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "date") return a.date.localeCompare(b.date);
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
        title="Incoming Offers"
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
        <div className="flex flex-col h-full bg-background text-foreground">
          {/* Toolbar */}
          <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
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
                <SelectItem value="date">Sort by Date</SelectItem>
                <SelectItem value="fee">Sort by Fee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto p-4 bg-muted/10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOffers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  votes={userVotes[offer.id] || { accept: false, interested: false, decline: false, recommend: false }}
                  counts={aggregatedCounts[offer.id]}
                  onVote={(option) => handleVote(offer.id, option)}
                />
              ))}
              {filteredOffers.length === 0 && (
                  <div className="col-span-full text-center py-10 text-muted-foreground">
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
      </WindowFrame>
    </>
  );
}

function OfferCard({
  offer,
  votes,
  counts,
  onVote,
}: {
  offer: Offer;
  votes: UserVote;
  counts: VoteCounts;
  onVote: (option: VoteOption) => void;
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
            <Badge variant={offer.source === 'email' ? 'secondary' : 'outline'}>
                {offer.source}
            </Badge>
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
                <span className="text-muted-foreground font-medium">Date</span>
                <span>{offer.date}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-muted-foreground font-medium">Fee</span>
                <span>{offer.fee}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-muted-foreground font-medium">Venue</span>
                <span className="truncate" title={offer.venue}>{offer.venue}</span>
            </div>
             <div className="flex flex-col">
                <span className="text-muted-foreground font-medium">Time</span>
                <span>{offer.timings}</span>
            </div>
        </div>
      </CardContent>
      <CardFooter 
        className={cn(
          "pt-2 border-t relative z-10",
          !isMacOSTheme && "bg-muted/5"
        )}
        style={{
          ...(isMacOSTheme && {
            background: "transparent",
            borderTop: "1px solid rgba(0, 0, 0, 0.1)",
          }),
        }}
      >
        <div className="w-full grid grid-cols-2 gap-2">
                 <VoteButton
                    active={votes.accept}
                    count={counts?.accept || 0}
                    onClick={() => onVote("accept")}
                    className="w-full bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                    activeClassName="bg-green-500 text-white hover:bg-green-600 border-green-600"
                 >
                    We should do this
                 </VoteButton>
                 <VoteButton
                     active={votes.interested}
                     count={counts?.interested || 0}
                     onClick={() => onVote("interested")}
                     className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                     activeClassName="bg-blue-500 text-white hover:bg-blue-600 border-blue-600"
                 >
                    I'm Interested
                 </VoteButton>
                 <VoteButton
                     active={votes.decline}
                     count={counts?.decline || 0}
                     onClick={() => onVote("decline")}
                     className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                     activeClassName="bg-red-500 text-white hover:bg-red-600 border-red-600"
                 >
                    Decline
                 </VoteButton>
                  <VoteButton
                     active={votes.recommend}
                     count={counts?.recommend || 0}
                     onClick={() => onVote("recommend")}
                     className="w-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                     activeClassName="bg-orange-500 text-white hover:bg-orange-600 border-orange-600"
                 >
                    Recommend Other
                 </VoteButton>
        </div>
      </CardFooter>
    </Card>
  );
}

function VoteButton({ 
    active, 
    count, 
    onClick, 
    children,
    className,
    activeClassName 
}: { 
    active: boolean; 
    count: number; 
    onClick: () => void; 
    children: React.ReactNode;
    className?: string;
    activeClassName?: string;
}) {
    const currentTheme = useThemeStore((state) => state.current);
    const isMacOSTheme = currentTheme === "macosx";
    const [isFocused, setIsFocused] = React.useState(false);
    const [isPressed, setIsPressed] = React.useState(false);

    // Determine color scheme from className
    const isGreen = className?.includes("green");
    const isBlue = className?.includes("blue");
    const isRed = className?.includes("red");
    const isOrange = className?.includes("orange");

    // Get color-specific gradients for bubbly style
    const getBubblyGradient = () => {
        if (active) {
            if (isGreen) {
                return isPressed
                    ? "linear-gradient(rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))"
                    : "linear-gradient(rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9))";
            }
            if (isBlue) {
                return isPressed
                    ? "linear-gradient(rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8))"
                    : "linear-gradient(rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))";
            }
            if (isRed) {
                return isPressed
                    ? "linear-gradient(rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.8))"
                    : "linear-gradient(rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))";
            }
            if (isOrange) {
                return isPressed
                    ? "linear-gradient(rgba(249, 115, 22, 0.8), rgba(234, 88, 12, 0.8))"
                    : "linear-gradient(rgba(249, 115, 22, 0.9), rgba(234, 88, 12, 0.9))";
            }
        }
        // Default bubbly gradient for inactive state with subtle color tint
        if (isGreen) {
            return isPressed
                ? "linear-gradient(rgba(140, 180, 140, 0.625), rgba(235, 255, 235, 0.625))"
                : "linear-gradient(rgba(160, 200, 160, 0.625), rgba(255, 255, 255, 0.625))";
        }
        if (isBlue) {
            return isPressed
                ? "linear-gradient(rgba(140, 160, 180, 0.625), rgba(235, 245, 255, 0.625))"
                : "linear-gradient(rgba(160, 180, 200, 0.625), rgba(255, 255, 255, 0.625))";
        }
        if (isRed) {
            return isPressed
                ? "linear-gradient(rgba(180, 140, 140, 0.625), rgba(255, 235, 235, 0.625))"
                : "linear-gradient(rgba(200, 160, 160, 0.625), rgba(255, 255, 255, 0.625))";
        }
        if (isOrange) {
            return isPressed
                ? "linear-gradient(rgba(180, 160, 140, 0.625), rgba(255, 245, 235, 0.625))"
                : "linear-gradient(rgba(200, 180, 160, 0.625), rgba(255, 255, 255, 0.625))";
        }
        // Default gray bubbly gradient
        return isPressed
            ? "linear-gradient(rgba(140, 140, 140, 0.625), rgba(235, 235, 235, 0.625))"
            : "linear-gradient(rgba(160, 160, 160, 0.625), rgba(255, 255, 255, 0.625))";
    };

    const getBubblyShadow = () => {
        if (isPressed) {
            return "inset 0 1px 2px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.2)";
        }
        if (isFocused || active) {
            const glowColor = isGreen ? "rgba(34, 197, 94, 0.4)" 
                : isBlue ? "rgba(59, 130, 246, 0.4)"
                : isRed ? "rgba(239, 68, 68, 0.4)"
                : isOrange ? "rgba(249, 115, 22, 0.4)"
                : "rgba(0, 0, 0, 0.3)";
            return `0 2px 3px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.3), 0 0 3px ${glowColor}`;
        }
        return "0 2px 3px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.3)";
    };

    const getTextColor = () => {
        if (active && isMacOSTheme) {
            return "white";
        }
        if (isMacOSTheme) {
            return "black";
        }
        return undefined; // Use default from className
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            className={cn(
                "h-auto min-h-[60px] py-2 px-2 text-xs flex flex-col gap-0.5 items-center justify-center transition-all w-full",
                !isMacOSTheme && className,
                !isMacOSTheme && active && activeClassName
            )}
            style={{
                ...(isMacOSTheme && {
                    borderRadius: "6px",
                    position: "relative",
                    overflow: "hidden",
                    cursor: "default",
                    border: "none",
                    boxSizing: "border-box",
                    WebkitFontSmoothing: "antialiased",
                    background: getBubblyGradient(),
                    boxShadow: getBubblyShadow(),
                    color: getTextColor(),
                    textShadow: "0 2px 3px rgba(0, 0, 0, 0.25)",
                }),
            }}
            onFocus={(e) => {
                setIsFocused(true);
            }}
            onBlur={(e) => {
                setIsFocused(false);
            }}
            onMouseDown={(e) => {
                setIsPressed(true);
            }}
            onMouseUp={(e) => {
                setIsPressed(false);
            }}
            onMouseLeave={(e) => {
                setIsPressed(false);
            }}
        >
            <span className="font-semibold text-[10px] leading-tight text-center">{children}</span>
            <span className="text-[9px] opacity-80">({count})</span>
        </Button>
    )
}
