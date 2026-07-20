/* eslint-disable react-refresh/only-export-components --
   Data module: exports a guide object built from private, non-exported mockup
   components. Fast-refresh HMR does not apply here. */
import type { ReactNode } from "react";
import {
  Calendar,
  Check,
  Clock,
  MapPin,
  PoundSterling,
  Search,
  Star,
  X,
} from "lucide-react";
import { AquaCard, AppToolbar, StatusBadge } from "@/components/greenroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { HelpGuide } from "../types";
import { Snapshot, Callout } from "../Snapshot";
import { Fact, FakeField } from "../mockups";

/** A vote button used in the mock footer (Yes = green, No = red). */
function VoteButton({
  tone,
  children,
}: {
  tone: "green" | "red";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
        tone === "green"
          ? "border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-200"
          : "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200"
      )}
    >
      {children}
    </div>
  );
}

function OfferCardMock({
  title,
  subtitle,
  badge,
  badgeTone,
}: {
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: "purple" | "blue";
}) {
  return (
    <AquaCard className="p-3">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="text-[10px] text-muted-foreground">{subtitle}</div>
        </div>
        <StatusBadge status="submitted" tone={badgeTone} label={badge} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Fact icon={Calendar} label="Event Date" value="Sat 12 Sep" />
        <Fact icon={PoundSterling} label="Fee" value="£1,500" />
        <Fact icon={MapPin} label="Venue" value="The Cause" />
        <Fact icon={Clock} label="Time" value="Doors 9pm" />
      </div>
    </AquaCard>
  );
}

/** Page 1: the offer dashboard. */
function DashboardMock() {
  return (
    <Snapshot title="Inbox">
      <AppToolbar className="mb-3 rounded-md">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            readOnly
            tabIndex={-1}
            placeholder="Search offers…"
            className="h-7 pl-7 text-xs"
          />
        </div>
        <div className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
          Sort by ▾
        </div>
        <Button variant="default" size="sm" className="text-xs">
          Log Offer
        </Button>
      </AppToolbar>
      <div className="grid grid-cols-2 gap-2">
        <OfferCardMock
          title="Warehouse Opening"
          subtitle="London, UK"
          badge="OFFER"
          badgeTone="blue"
        />
        <OfferCardMock
          title="Rooftop Sessions"
          subtitle="Internal Pitch"
          badge="PITCH"
          badgeTone="purple"
        />
      </div>
      <Callout n={1} label="Search + sort" x={20} y={13} />
      <Callout n={2} label="OFFER vs PITCH" x={78} y={40} align="left" />
    </Snapshot>
  );
}

/** Page 2: voting footer. */
function VotingMock() {
  return (
    <Snapshot title="Offer card">
      <AquaCard className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Warehouse Opening</div>
          <StatusBadge status="submitted" tone="blue" label="OFFER" />
        </div>
        <div className="mb-3 flex gap-2">
          <VoteButton tone="green">
            <Check className="h-3.5 w-3.5" /> Yes (3)
          </VoteButton>
          <VoteButton tone="red">
            <X className="h-3.5 w-3.5" /> No (1)
          </VoteButton>
        </div>
        <div className="flex items-center justify-center gap-1 rounded-md border border-yellow-300 bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200">
          <Star className="h-3.5 w-3.5 fill-current" /> Count me in (2)
        </div>
      </AquaCard>
      <Callout n={1} label="Yes / No with tallies" x={50} y={40} />
      <Callout n={2} label="Flag your involvement" x={50} y={70} />
    </Snapshot>
  );
}

/** Page 3: logging an offer manually. */
function LogOfferMock() {
  return (
    <Snapshot title="Log Incoming Offer">
      <div className="space-y-2.5">
        <FakeField
          label="Offer / Event Name"
          required
          value="Warehouse Project Opening"
        />
        <div className="grid grid-cols-2 gap-2">
          <FakeField label="Event Date" value="12 Sep 2026" />
          <FakeField label="Fee Offered" value="1500" />
          <FakeField label="Venue" value="The Cause" />
          <FakeField label="Promoter" value="Nightshift" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="retro" size="sm" className="text-xs">
            Cancel
          </Button>
          <Button variant="default" size="sm" className="text-xs">
            Log Offer
          </Button>
        </div>
      </div>
      <Callout n={1} label="Only the name is required" x={64} y={12} align="left" />
    </Snapshot>
  );
}

/** Page 4: admin approval turns an offer into a project. */
function ApproveMock() {
  return (
    <Snapshot title="Admin controls">
      <AquaCard className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Warehouse Opening</div>
          <StatusBadge status="submitted" tone="blue" label="OFFER" />
        </div>
        <div className="mb-3 flex gap-2 border-t pt-2">
          <Button variant="default" size="sm" className="flex-1 text-xs">
            Approve
          </Button>
          <Button variant="retro" size="sm" className="flex-1 text-xs">
            Decline
          </Button>
        </div>
        <div className="rounded-md bg-muted/40 p-2 text-[10px] text-muted-foreground">
          Approving opens “Complete Project Details” (name, type, budget, dates,
          venue…) and creates the project.
        </div>
      </AquaCard>
      <Callout n={1} label="Admins only" x={50} y={44} />
    </Snapshot>
  );
}

export const inboxGuide: HelpGuide = {
  id: "incoming-offers",
  pages: [
    {
      id: "dashboard",
      title: "Browse incoming offers",
      body: "The Inbox is a dashboard of everything awaiting a decision: gig/brand offers (blue OFFER badge) and internal pitches (purple PITCH badge). Each card shows the key facts like event date, fee, venue and time. Use the search box and Sort by menu to find what you're after.",
      snapshot: <DashboardMock />,
    },
    {
      id: "vote",
      title: "Cast your vote",
      body: "Vote Yes or No on any offer. The buttons show the running tally from the whole team, and casting a fresh vote lets you leave an optional note. Separately, the “☆ I'm interested” toggle becomes “★ Count me in” to flag that you'd want to be involved.",
      snapshot: <VotingMock />,
    },
    {
      id: "log",
      title: "Log an offer",
      body: "Got an offer that came in outside the system? Hit Log Offer and capture it. Only the Offer / Event Name is required; add the fee, date, venue and promoter if you have them. It's saved as a new offer for the team to vote on.",
      snapshot: <LogOfferMock />,
    },
    {
      id: "approve",
      title: "Approve into a project",
      body: "Admins get Approve / Reject (pitches) and Approve / Decline (offers). Approving opens a short “Complete Project Details” form and promotes the offer into a real project. From there it moves to Active Projects.",
      snapshot: <ApproveMock />,
    },
  ],
};
