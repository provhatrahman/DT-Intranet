/* eslint-disable react-refresh/only-export-components --
   Data module: exports a guide object built from private, non-exported mockup
   components. Fast-refresh HMR does not apply here. */
import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { AquaCard, StatusBadge } from "@/components/greenroom";
import { cn } from "@/lib/utils";
import type { HelpGuide } from "../types";
import { Snapshot, Callout } from "../Snapshot";

/** A small "flow" strip showing the four stages, with one highlighted. */
function FlowStrip({ active }: { active: number }) {
  const steps = ["Pitch", "Inbox", "Projects", "Archive"];
  return (
    <div className="flex items-center justify-center gap-1 text-[10px]">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <span
            className={cn(
              "rounded-full px-2 py-0.5",
              i === active
                ? "bg-foreground font-semibold text-background"
                : "bg-muted text-muted-foreground"
            )}
          >
            {s}
          </span>
          {i < steps.length - 1 && (
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}

function StageMock({
  step,
  children,
}: {
  step: number;
  children: ReactNode;
}) {
  return (
    <Snapshot title="Greenroom">
      <FlowStrip active={step} />
      <div className="mt-3">{children}</div>
    </Snapshot>
  );
}

const PitchStage = (
  <StageMock step={0}>
    <AquaCard className="p-3">
      <div className="mb-1 text-xs font-semibold">New Pitch</div>
      <div className="space-y-1 text-[11px] text-muted-foreground">
        <div className="rounded border bg-background px-2 py-1">
          Rooftop Summer Sessions
        </div>
        <div className="rounded border bg-background px-2 py-1">
          An open-air day party series…
        </div>
      </div>
    </AquaCard>
  </StageMock>
);

const InboxStage = (
  <StageMock step={1}>
    <AquaCard className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold">Rooftop Sessions</span>
        <StatusBadge status="submitted" tone="purple" label="PITCH" />
      </div>
      <div className="flex gap-2 text-[11px]">
        <span className="flex-1 rounded-md border border-green-200 bg-green-100 py-1 text-center text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-200">
          Yes (3)
        </span>
        <span className="flex-1 rounded-md border border-red-200 bg-red-100 py-1 text-center text-red-800 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200">
          No (1)
        </span>
      </div>
    </AquaCard>
  </StageMock>
);

const ProjectsStage = (
  <StageMock step={2}>
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <div className="space-y-1">
        <div className="rounded-md border bg-muted px-2 py-1 text-[10px] font-medium">
          Rooftop
        </div>
        <div className="rounded-md border bg-background px-2 py-1 text-[10px] text-muted-foreground">
          Warehouse
        </div>
      </div>
      <AquaCard className="p-2">
        <div className="mb-1 flex gap-1 text-[10px]">
          <span className="rounded bg-foreground/10 px-1.5 py-0.5 font-semibold">
            Overview
          </span>
          <span className="px-1.5 py-0.5 text-muted-foreground">Curation</span>
          <span className="px-1.5 py-0.5 text-muted-foreground">Lineup</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Details · Team · Status updates
        </div>
      </AquaCard>
    </div>
  </StageMock>
);

const ArchiveStage = (
  <StageMock step={3}>
    <AquaCard className="p-3 text-center">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
        Final Lineup
      </div>
      <div className="text-xs font-semibold">Rooftop Summer Sessions</div>
      <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-green-700 dark:text-green-300">
        <Check className="h-3 w-3" /> Completed &amp; archived
      </div>
    </AquaCard>
  </StageMock>
);

const GettingAroundMock = (
  <Snapshot title="Desktop">
    {/* Menu bar strip */}
    <div className="mb-3 flex items-center gap-3 rounded-md border bg-muted/40 px-2 py-1 text-[11px]">
      <span className="font-semibold">◍</span>
      <span>File</span>
      <span>Go</span>
      <span className="rounded bg-foreground/10 px-1 font-semibold">Help</span>
    </div>
    {/* App tiles */}
    <div className="grid grid-cols-4 gap-2 text-center">
      {[
        { emoji: "🎤", name: "Pitch" },
        { emoji: "📥", name: "Inbox" },
        { emoji: "📋", name: "Projects" },
        { emoji: "🗄️", name: "Archive" },
      ].map((a) => (
        <div key={a.name} className="flex flex-col items-center gap-1">
          <div className="text-xl">{a.emoji}</div>
          <div className="text-[10px] text-muted-foreground">{a.name}</div>
        </div>
      ))}
    </div>
    <Callout n={1} label="Per-app Help lives here" x={80} y={12} align="left" />
  </Snapshot>
);

export const overviewGuide: HelpGuide = {
  id: "overview",
  pages: [
    {
      id: "pitch",
      title: "1 · Pitch an idea",
      body: "Everything starts in the Pitch app. Submit a project idea or an offer with a name and a short description, and it's sent off for review and lands in the Inbox.",
      snapshot: PitchStage,
    },
    {
      id: "inbox",
      title: "2 · Review in the Inbox",
      body: "Pitches and logged offers gather in the Inbox. The team votes Yes/No and flags interest, and you can see the tally before anything moves forward. Admins approve the winners into projects.",
      snapshot: InboxStage,
    },
    {
      id: "projects",
      title: "3 · Track in Active Projects",
      body: "Approved offers become live projects. Manage the details and team, curate a longlist of artists, and build the final lineup, all in one place and saved as you go.",
      snapshot: ProjectsStage,
    },
    {
      id: "archive",
      title: "4 · Wrap up in Archive",
      body: "Completed projects move to the Archive as a read-only record: a printed running order of the acts, plus wrap-up threads for what went well and what to learn from.",
      snapshot: ArchiveStage,
    },
    {
      id: "around",
      title: "Getting around",
      body: "Open apps from the desktop icons or the menu bar. Each app has its own menus at the top, including its own Help guide like this one. You can revisit any of these guides any time from the Help menu.",
      snapshot: GettingAroundMock,
    },
  ],
};
