/* eslint-disable react-refresh/only-export-components --
   Data module: exports a guide object built from private, non-exported mockup
   components. Fast-refresh HMR does not apply here. */
import { Calendar, Clock, MapPin, PoundSterling } from "lucide-react";
import { AquaCard, Field, StatusBadge } from "@/components/greenroom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { HelpGuide } from "../types";
import { Snapshot, Callout } from "../Snapshot";
import { Fact, FakeField } from "../mockups";

/** New Pitch: the form the user fills out. */
function NewPitchMock() {
  return (
    <Snapshot title="New Pitch">
      <div className="space-y-3">
        <FakeField
          label="Name"
          required
          value="Rooftop Summer Sessions"
        />
        <Field label="Description / Idea" required>
          <Textarea
            readOnly
            tabIndex={-1}
            value="An open-air day party series with a rotating cast of house DJs across three weekends."
            className="h-14 resize-none text-xs"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <FakeField label="Key Date(s)" value="Aug 2026" />
          <FakeField label="Venue / Location" value="Peckham, London" />
          <FakeField label="Budget" value="£8,000" />
          <FakeField label="Timelines" value="14:00 – 22:00" />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="default" size="sm" className="text-xs">
            Submit Pitch
          </Button>
          <Button variant="retro" size="sm" className="text-xs">
            Clear
          </Button>
        </div>
      </div>
      <Callout n={1} label="Name + idea are required" x={62} y={9} align="left" />
      <Callout n={2} label="Extra detail is optional" x={70} y={54} align="left" />
    </Snapshot>
  );
}

/** After submitting, the pitch appears in the Inbox as a PITCH card. */
function PitchLandsMock() {
  return (
    <Snapshot title="Inbox">
      <AquaCard className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              Rooftop Summer Sessions
            </div>
            <div className="text-[10px] text-muted-foreground">
              Internal Pitch
            </div>
          </div>
          <StatusBadge status="submitted" tone="purple" label="PITCH" />
        </div>
        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
          An open-air day party series with a rotating cast of house DJs.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Fact icon={Calendar} label="Event Date" value="Aug 2026" />
          <Fact icon={PoundSterling} label="Fee" value="£8,000" />
        </div>
      </AquaCard>
      <Callout n={1} label="Your pitch, flagged PITCH" x={68} y={20} align="left" />
    </Snapshot>
  );
}

/** My Pitches: track status and read reviewer feedback. */
function MyPitchesMock() {
  return (
    <Snapshot title="My Pitches">
      <AquaCard className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Rooftop Summer Sessions</div>
          <StatusBadge status="approved" label="Approved" />
        </div>
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> Peckham, London
          <span className="opacity-40">·</span>
          <Clock className="h-3.5 w-3.5" /> 4/5 votes
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <div className="mb-1 text-[10px] font-medium text-muted-foreground">
            Feedback (2)
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <StatusBadge status="approved" tone="green" label="Voted Yes" />
              <span className="text-muted-foreground">
                Love the rooftop angle.
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <StatusBadge status="rejected" tone="red" label="Voted No" />
              <span className="text-muted-foreground">
                Budget looks tight.
              </span>
            </div>
          </div>
        </div>
      </AquaCard>
      <Callout n={1} label="Live status" x={70} y={11} align="left" />
      <Callout n={2} label="Anonymous reviewer votes" x={58} y={62} align="left" />
    </Snapshot>
  );
}

export const pitchGuide: HelpGuide = {
  id: "pitch",
  pages: [
    {
      id: "submit",
      title: "Submit a new pitch",
      body: "Use the New Pitch tab to float a project idea or an offer. Name and Description are the only required fields; everything else (dates, venue, budget, timelines) is optional but helps reviewers. You'll need a linked Greenroom account first, and a prompt lets you set one up if you don't have it.",
      snapshot: <NewPitchMock />,
    },
    {
      id: "lands",
      title: "It lands in the Inbox",
      body: "Once submitted, your pitch is sent off for review and shows up in the Inbox as a card flagged PITCH, with a status of Submitted. From there the team can vote on it and, if it gets the go-ahead, turn it into a project.",
      snapshot: <PitchLandsMock />,
    },
    {
      id: "track",
      title: "Track your pitches",
      body: "The My Pitches tab lists everything you've submitted with its live status (Submitted, Under Review, Approved, Rejected or Closed), plus the vote tally and any anonymous reviewer feedback. Each note shows whether that reviewer voted yes or no.",
      snapshot: <MyPitchesMock />,
    },
  ],
};
