/* eslint-disable react-refresh/only-export-components --
   Data module: exports a guide object built from private, non-exported mockup
   components. Fast-refresh HMR does not apply here. */
import { Building2, Calendar, DollarSign } from "lucide-react";
import {
  AquaCard,
  EmptyState,
  InfoTile,
  SidebarRow,
  StatusBadge,
} from "@/components/greenroom";
import { Textarea } from "@/components/ui/textarea";
import type { HelpGuide } from "../types";
import { Snapshot, Callout } from "../Snapshot";

/** Page 1: the read-only Summary + printed running order. */
function SummaryMock() {
  return (
    <Snapshot title="Summary">
      <div className="grid grid-cols-[96px_1fr] gap-2">
        <div className="space-y-1.5">
          <SidebarRow selected className="p-2!">
            <div className="text-[11px] font-semibold leading-tight">
              Warehouse Opening
            </div>
            <StatusBadge status="completed" className="mt-1" />
          </SidebarRow>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <InfoTile icon={Building2} label="Type">
              Event
            </InfoTile>
            <InfoTile icon={Calendar} label="Event Date">
              12 Sep
            </InfoTile>
          </div>
          {/* Printed running order */}
          <AquaCard className="p-3 text-center">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
              Final Lineup
            </div>
            <div className="text-sm font-semibold">Warehouse Opening</div>
            <div className="mb-1.5 text-[10px] text-muted-foreground">
              12 Sep · The Cause, London
            </div>
            <div className="space-y-0.5 text-left text-xs">
              <div>1. DJ Seinfeld</div>
              <div>2. Peggy Gou</div>
            </div>
          </AquaCard>
        </div>
      </div>
      <Callout n={1} label="Read-only record" x={80} y={16} align="left" />
      <Callout n={2} label="Printed running order" x={60} y={72} align="left" />
    </Snapshot>
  );
}

/** Page 2: the Wrap-up comment threads. */
function WrapUpMock() {
  return (
    <Snapshot title="Wrap-up">
      <div className="grid grid-cols-2 gap-2">
        {[
          { title: "How it went", note: "Sold out, great energy." },
          { title: "Lessons learned", note: "Start the bar earlier." },
        ].map((col) => (
          <div key={col.title} className="space-y-1.5">
            <div className="text-[11px] font-semibold">{col.title}</div>
            <Textarea
              readOnly
              tabIndex={-1}
              placeholder="Add a comment…"
              className="h-10 resize-none text-xs"
            />
            <AquaCard className="p-2 text-[11px]">
              <div className="text-[9px] text-muted-foreground">Sam · today</div>
              {col.note}
            </AquaCard>
          </div>
        ))}
      </div>
      <Callout n={1} label="Anyone can post" x={50} y={40} />
    </Snapshot>
  );
}

/** Page 3: Payments (coming soon). */
function PaymentsMock() {
  return (
    <Snapshot title="Payments">
      <EmptyState
        icon={DollarSign}
        title="Payments coming soon"
        hint="Track project and artist payment status here in a future update."
      />
    </Snapshot>
  );
}

export const archiveGuide: HelpGuide = {
  id: "archive",
  pages: [
    {
      id: "summary",
      title: "Look back at a project",
      body: "The Archive holds finished projects as a read-only record. The Summary tab mirrors everything from the project (details, schedule, venue, team and status updates) and prints the confirmed acts as a clean, numbered running order.",
      snapshot: <SummaryMock />,
    },
    {
      id: "wrapup",
      title: "Capture the wrap-up",
      body: "The Wrap-up tab has two comment threads: “How it went” and “Lessons learned”. Anyone can post, and you can edit or delete your own notes. It's the place to capture what worked so the next project goes smoother.",
      snapshot: <WrapUpMock />,
    },
    {
      id: "payments",
      title: "Payments",
      body: "A Payments tab is on the way. It'll track the project's incoming payment status and outgoing artist payments. For now it shows a “coming soon” placeholder.",
      snapshot: <PaymentsMock />,
    },
  ],
};
