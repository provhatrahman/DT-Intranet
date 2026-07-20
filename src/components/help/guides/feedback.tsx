/* eslint-disable react-refresh/only-export-components --
   Data module: exports a guide object built from private, non-exported mockup
   components. Fast-refresh HMR does not apply here. */
import { AquaCard, Field, StatusBadge } from "@/components/greenroom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { HelpGuide } from "../types";
import { Snapshot, Callout } from "../Snapshot";
import { FakeField } from "../mockups";

/** Submit a report: pick an app, describe what happened. */
function SubmitMock() {
  return (
    <Snapshot title="Feedback">
      <div className="space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Found a bug or have feedback about Greenroom? Let us know what
          happened.
        </p>
        <FakeField label="Which app is this about?" required value="Pitch" />
        <Field label="What happened?" required>
          <Textarea
            readOnly
            tabIndex={-1}
            value="Submitting a pitch showed a spinner forever and never confirmed it saved."
            className="h-16 resize-none text-xs"
          />
        </Field>
        <div className="flex gap-2 pt-1">
          <Button variant="default" size="sm" className="text-xs">
            Send Feedback
          </Button>
          <Button variant="retro" size="sm" className="text-xs">
            Clear
          </Button>
        </div>
      </div>
      <Callout n={1} label="Pick the app (required)" x={64} y={30} align="left" />
      <Callout n={2} label="Describe the bug" x={60} y={57} align="left" />
    </Snapshot>
  );
}

/** The team reads and resolves reports in the Admin Portal. */
function TriageMock() {
  return (
    <Snapshot title="Admin Portal — Feedback">
      <AquaCard className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              Spinner never confirms save
            </div>
            <div className="text-[10px] text-muted-foreground">
              jordan@greenroom.co · Pitch
            </div>
          </div>
          <StatusBadge status="open" tone="yellow" label="Open" />
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          Submitting a pitch showed a spinner forever and never confirmed it
          saved.
        </p>
      </AquaCard>
      <Callout n={1} label="Admins triage here" x={58} y={22} align="left" />
    </Snapshot>
  );
}

export const feedbackGuide: HelpGuide = {
  id: "feedback",
  pages: [
    {
      id: "submit",
      title: "Report a bug or send feedback",
      body: "Use the Feedback app to tell us about anything broken or confusing. Pick which app your report is about — Inbox, Pitch, Active Projects, Archive, or General for something app-wide — then describe what happened. Both fields are required.",
      snapshot: <SubmitMock />,
    },
    {
      id: "triage",
      title: "Where it goes",
      body: "Your report is sent straight to the Greenroom team. Admins see every report in the Admin Portal's Feedback tab — tagged with the app you chose and who sent it — and can mark each one Resolved once it's handled.",
      snapshot: <TriageMock />,
    },
  ],
};
