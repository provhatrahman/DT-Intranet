import { useState } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { PitchMenuBar } from "./PitchMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { helpItems, appMetadata } from "..";
import { useThemeStore } from "@/stores/useThemeStore";
import { Offer } from "@/apps/incoming-offers/data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
              "flex-1 overflow-auto p-6",
              isMacOSTheme ? "" : "bg-muted/10"
            )}
            style={isMacOSTheme ? { background: "transparent" } : undefined}
          >
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
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

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting || !name.trim() || !description.trim()}
                  className="flex-1"
                >
                  {isSubmitting ? "Submitting..." : "Submit Pitch"}
                </Button>
                <Button
                  type="button"
                  variant={isMacOSTheme ? "secondary" : "outline"}
                  onClick={() => {
                    setName("");
                    setDescription("");
                    setKeyDates("");
                    setVenue("");
                    setBudget("");
                    setTimelines("");
                    setSubmitSuccess(false);
                  }}
                >
                  Clear
                </Button>
              </div>
            </form>
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
      </WindowFrame>
    </>
  );
}
