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
  const [offers, setOffers] = useState<Offer[]>(dummyOffers);
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState<"date-asc" | "date-desc" | "fee">("date-asc");
  
  // Local state to track user's votes: offerId -> UserVote
  const [userVotes, setUserVotes] = useState<Record<string, UserVote>>({});

  const currentTheme = useThemeStore((state) => state.current);
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  const isMacOSTheme = currentTheme === "macosx";

  // Initialize user votes from localStorage if available (simulated persistence)
  useEffect(() => {
    const savedVotes = localStorage.getItem("incoming_offers_votes");
    if (savedVotes) {
      setUserVotes(JSON.parse(savedVotes));
    }
  }, []);

  // Load offers from localStorage and merge with dummy data
  useEffect(() => {
    const loadOffers = () => {
      let savedOffers: Offer[] = [];
      
      try {
        const savedOffersJson = localStorage.getItem("incoming_offers_list");
        if (savedOffersJson) {
          const parsed = JSON.parse(savedOffersJson);
          // Validate it's an array
          if (Array.isArray(parsed)) {
            savedOffers = parsed;
          } else {
            console.warn("Invalid offers data in localStorage, resetting");
            localStorage.removeItem("incoming_offers_list");
          }
        }
      } catch (parseError) {
        console.error("Failed to parse offers from localStorage:", parseError);
        // Clear corrupted data
        localStorage.removeItem("incoming_offers_list");
        savedOffers = [];
      }
      
      // Merge saved offers with dummy offers, avoiding duplicates by ID
      const dummyIds = new Set(dummyOffers.map(o => o.id));
      const newOffers = savedOffers.filter(o => !dummyIds.has(o.id));
      // Sort by date (newest first) for better UX - pitches will appear at top if they have recent dates
      const mergedOffers = [...dummyOffers, ...newOffers];
      
      setOffers(mergedOffers);
    };

    loadOffers();

    // Listen for updates from pitch app
    const handleOffersUpdate = () => {
      loadOffers();
    };

    window.addEventListener("offers-updated", handleOffersUpdate);
    return () => {
      window.removeEventListener("offers-updated", handleOffersUpdate);
    };
  }, []);

  // Calculate aggregated counts: base counts + user's vote (1 if voted, 0 if not)
  const aggregatedCounts = React.useMemo(() => {
    const counts: Record<string, VoteCounts> = {};
    offers.forEach((offer) => {
      const baseCounts = initialVoteCounts[offer.id] || { accept: 0, interested: 0, decline: 0, recommend: 0 };
      const userVote = userVotes[offer.id] || { accept: false, interested: false, decline: false, recommend: false };
      
      counts[offer.id] = {
        accept: baseCounts.accept + (userVote.accept ? 1 : 0),
        interested: baseCounts.interested + (userVote.interested ? 1 : 0),
        decline: baseCounts.decline + (userVote.decline ? 1 : 0),
        recommend: baseCounts.recommend + (userVote.recommend ? 1 : 0),
      };
    });
    return counts;
  }, [userVotes, offers]);

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
        // If interested, also set accept to true (they are linked)
        // If unclicking interested, also unclick accept
        newVote.accept = newVote.interested;
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
      
      return newVotes;
    });
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
                <SelectItem value="date-asc">Date (Ascending)</SelectItem>
                <SelectItem value="date-desc">Date (Descending)</SelectItem>
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
            <button
                onClick={onClick}
                className={cn(
                    "h-auto min-h-[60px] py-2 px-2 text-xs flex flex-col gap-0.5 items-center justify-center w-full focus:outline-none relative overflow-hidden rounded-md transition-all",
                    active && "transform translate-y-0"
                )}
                style={{
                    background: getColorGradient(),
                    borderRadius: "6px",
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
                    cursor: "default",
                    transform: active ? "translateY(-1px)" : "translateY(0)",
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
                <span 
                    className="font-semibold text-[10px] leading-tight text-center relative z-10"
                    style={{ 
                        textShadow: active ? "0 1px 2px rgba(0, 0, 0, 0.3)" : "0 1px 1px rgba(0, 0, 0, 0.2)",
                        color: active ? "white" : "black"
                    }}
                >
                    {children}
                </span>
                <span 
                    className="text-[9px] opacity-90 relative z-10"
                    style={{ 
                        textShadow: active ? "0 1px 1px rgba(0, 0, 0, 0.3)" : "0 1px 1px rgba(0, 0, 0, 0.15)",
                        color: active ? "white" : "black"
                    }}
                >
                    ({count})
                </span>
            </button>
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
