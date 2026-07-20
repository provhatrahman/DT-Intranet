import { useState } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { FeedbackMenuBar } from "./FeedbackMenuBar";
import HelpGuideDialog from "@/components/help/HelpGuideDialog";
import { useEffectiveGreenroomAccount } from "@/hooks/useGreenroomAccount";
import { useFeedbackStore } from "@/stores/useFeedbackStore";
import {
  FEEDBACK_APP_CONTEXTS,
  type FeedbackAppContext,
} from "@/lib/api/feedback";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, NoticePanel, useOsTheme } from "@/components/greenroom";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Human labels for the app dropdown. The first four values are the exact AppIds
// of the domain apps; "general" is the app-wide catch-all.
const APP_CONTEXT_LABELS: Record<FeedbackAppContext, string> = {
  "incoming-offers": "Inbox",
  pitch: "Pitch",
  "active-projects": "Active Projects",
  archive: "Archive",
  general: "General / Other",
};

export function FeedbackAppComponent({
  isWindowOpen,
  onClose,
  isForeground,
  skipInitialSound,
  instanceId,
  onNavigateNext,
  onNavigatePrevious,
}: AppProps) {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);

  // Empty until the user picks one — the field is required.
  const [appContext, setAppContext] = useState<FeedbackAppContext | "">("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const effectiveAccount = useEffectiveGreenroomAccount();
  const greenroomUserId = effectiveAccount.userId;

  const { createReport } = useFeedbackStore();

  const { isMacTheme, isXpTheme } = useOsTheme();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const canSubmit =
    !!appContext && message.trim().length > 0 && !isSubmitting;

  const clearForm = () => {
    setAppContext("");
    setMessage("");
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!appContext || !message.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createReport({
        app_context: appContext,
        message: message.trim(),
        // Fallback identity for dev / while REQUIRE_AUTH is off; in prod the
        // bearer token identifies the submitter server-side.
        user_id: greenroomUserId ?? undefined,
      });
      clearForm();
      toast.success("Thanks! Your feedback has been sent.");
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to submit feedback";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const menuBar = (
    <FeedbackMenuBar
      onClose={onClose}
      onShowHelp={() => setIsHelpDialogOpen(true)}
    />
  );

  if (!isWindowOpen) return null;

  return (
    <>
      {!isXpTheme && isForeground && menuBar}
      <WindowFrame
        title="Feedback"
        onClose={onClose}
        isForeground={isForeground}
        appId="feedback"
        skipInitialSound={skipInitialSound}
        instanceId={instanceId}
        onNavigateNext={onNavigateNext}
        onNavigatePrevious={onNavigatePrevious}
        menuBar={isXpTheme ? menuBar : undefined}
        windowConstraints={{ minWidth: 480, minHeight: 480 }}
      >
        <div
          className={cn(
            "flex flex-col h-full w-full text-foreground",
            !isMacTheme && "bg-background"
          )}
        >
          <div
            className={cn(
              "flex-1 overflow-auto",
              isMobile ? "px-4 pt-3 pb-4" : "px-6 pt-4 pb-6",
              !isMacTheme && "bg-muted/10"
            )}
          >
            <form
              onSubmit={handleSubmit}
              className={cn(
                "mx-auto space-y-5",
                isMobile ? "max-w-full" : "max-w-2xl"
              )}
            >
              <p className="text-sm text-muted-foreground">
                Found a bug or have feedback about Greenroom? Let us know what
                happened — the team reviews every report.
              </p>

              <Field label="Which app is this about?" required className="space-y-2">
                <Select
                  value={appContext}
                  onValueChange={(v) => setAppContext(v as FeedbackAppContext)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an app…" />
                  </SelectTrigger>
                  <SelectContent>
                    {FEEDBACK_APP_CONTEXTS.map((ctx) => (
                      <SelectItem key={ctx} value={ctx}>
                        {APP_CONTEXT_LABELS[ctx]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="What happened?"
                htmlFor="message"
                required
                className="space-y-2"
              >
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe the bug or feedback. What did you expect, and what happened instead?"
                  required
                  className="w-full min-h-[140px]"
                />
              </Field>

              {submitError && (
                <NoticePanel tone="error" icon={AlertCircle}>
                  {submitError}
                </NoticePanel>
              )}

              <div className={cn("flex gap-3 pt-2", isMobile && "flex-col")}>
                <Button
                  type="submit"
                  variant="default"
                  disabled={!canSubmit}
                  className={cn(
                    "flex-1 touch-manipulation",
                    isMobile && "min-h-[44px] w-full"
                  )}
                >
                  <span>{isSubmitting ? "Sending…" : "Send Feedback"}</span>
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
          </div>
        </div>

        <HelpGuideDialog
          isOpen={isHelpDialogOpen}
          onOpenChange={setIsHelpDialogOpen}
          guideId="feedback"
        />
      </WindowFrame>
    </>
  );
}
