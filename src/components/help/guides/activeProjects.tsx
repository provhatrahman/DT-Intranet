/* eslint-disable react-refresh/only-export-components --
   Data module: exports a guide object built from private, non-exported mockup
   components. Fast-refresh HMR does not apply here. */
import type { ReactNode } from "react";
import {
  Building2,
  CheckCircle2,
  Music,
  Plus,
  Search,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";
import {
  AquaCard,
  SidebarRow,
  StatusBadge,
} from "@/components/greenroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { HelpGuide } from "../types";
import { Snapshot, Callout } from "../Snapshot";

/** A titled section card matching the app's SectionCard blocks. */
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Building2;
  title: string;
  children: ReactNode;
}) {
  return (
    <AquaCard className="p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {title}
      </div>
      {children}
    </AquaCard>
  );
}

/** A tab strip label row. */
function Tabs({ active }: { active: string }) {
  const tabs = ["Overview", "Curation", "Final Lineup"];
  return (
    <div className="mb-2 flex gap-1 text-[11px]">
      {tabs.map((t) => (
        <span
          key={t}
          className={cn(
            "rounded-md px-2 py-1",
            t === active
              ? "bg-foreground/10 font-semibold"
              : "text-muted-foreground"
          )}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function ProjectChrome({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-2">
      {/* Sidebar */}
      <div className="space-y-1.5">
        <SidebarRow selected className="p-2!">
          <div className="text-[11px] font-semibold leading-tight">
            Warehouse Opening
          </div>
          <StatusBadge status="active" className="mt-1" />
        </SidebarRow>
        <SidebarRow className="p-2!">
          <div className="text-[11px] font-medium leading-tight">
            Rooftop Sessions
          </div>
        </SidebarRow>
      </div>
      {/* Detail */}
      <div>
        <Tabs active={active} />
        {children}
      </div>
    </div>
  );
}

/** Page 1: the Overview tab. */
function OverviewMock() {
  return (
    <Snapshot title="Active Projects">
      <ProjectChrome active="Overview">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">Warehouse Opening</div>
            <StatusBadge status="active" />
            <span className="ml-auto text-[10px] text-muted-foreground">
              Saved ✓
            </span>
          </div>
          <Section icon={Building2} title="Details">
            <div className="text-[11px] text-muted-foreground">
              Type · Gig size · Budget · Description
            </div>
          </Section>
          <Section icon={Users} title="Project Team">
            <div className="flex flex-wrap gap-1">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                Lead: Sam
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                Alex ✕
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                + Add…
              </span>
            </div>
          </Section>
        </div>
      </ProjectChrome>
      <Callout n={1} label="Pick a project" x={13} y={30} />
      <Callout n={2} label="Edits auto-save" x={80} y={22} align="left" />
    </Snapshot>
  );
}

/** Page 2: the Curation tab. */
function CurationMock() {
  return (
    <Snapshot title="Curation">
      <ProjectChrome active="Curation">
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Input
              readOnly
              tabIndex={-1}
              placeholder="Artist name"
              className="h-7 text-xs"
            />
            <Button variant="default" size="sm" className="text-xs">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {[
            { name: "DJ Seinfeld", up: 4, down: 0 },
            { name: "Peggy Gou", up: 2, down: 1 },
          ].map((a) => (
            <AquaCard key={a.name} className="flex items-center gap-2 p-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{a.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  Suggested by Sam
                </div>
              </div>
              <span className="flex items-center gap-0.5 text-[10px] text-green-700 dark:text-green-300">
                <ThumbsUp className="h-3.5 w-3.5" /> {a.up}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <ThumbsDown className="h-3.5 w-3.5" /> {a.down}
              </span>
            </AquaCard>
          ))}
        </div>
      </ProjectChrome>
      <Callout n={1} label="Suggest anyone" x={30} y={22} />
      <Callout n={2} label="Vote to rank" x={82} y={52} align="left" />
    </Snapshot>
  );
}

/** Page 3: the Final Lineup tab. */
function LineupMock() {
  return (
    <Snapshot title="Final Lineup">
      <ProjectChrome active="Final Lineup">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold">Final Lineup (2)</div>
          {["DJ Seinfeld", "Peggy Gou"].map((n) => (
            <AquaCard
              key={n}
              className="flex items-center gap-2 p-2 text-xs font-medium"
            >
              <Music className="h-3.5 w-3.5 text-muted-foreground" /> {n}
              <span className="ml-auto text-[10px] text-muted-foreground">
                house · London
              </span>
            </AquaCard>
          ))}
          <div className="flex gap-1.5 border-t pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                readOnly
                tabIndex={-1}
                placeholder="Filter artist database…"
                className="h-7 pl-7 text-xs"
              />
            </div>
            <Button variant="default" size="sm" className="text-xs">
              New Artist
            </Button>
          </div>
        </div>
      </ProjectChrome>
      <Callout n={1} label="Confirmed acts" x={78} y={22} align="left" />
      <Callout n={2} label="Search / add DJs" x={35} y={72} />
    </Snapshot>
  );
}

/** Page 4: mark complete, then Archive. */
function CompleteMock() {
  return (
    <Snapshot title="Active Projects">
      <AquaCard className="p-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="text-sm font-semibold">Warehouse Opening</div>
          <StatusBadge status="active" />
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
            Status: Active ▾
          </div>
          <Button variant="default" size="sm" className="text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
          </Button>
        </div>
        <div className="mt-3 rounded-md bg-muted/40 p-2 text-[10px] text-muted-foreground">
          Marking a project complete sets its end date and moves it to the
          Archive.
        </div>
      </AquaCard>
      <Callout n={1} label="Wraps up & archives" x={60} y={40} align="left" />
    </Snapshot>
  );
}

export const activeProjectsGuide: HelpGuide = {
  id: "active-projects",
  pages: [
    {
      id: "overview",
      title: "Manage a project",
      body: "Pick a project from the sidebar to open it. The Overview tab holds everything about it: details, schedule, venue & promoter, a Google Drive link, the project team (lead + members), and a running log of status updates. Edits save automatically as you type.",
      snapshot: <OverviewMock />,
    },
    {
      id: "curation",
      title: "Curate a longlist",
      body: "On the Curation tab, anyone can suggest artists (with an optional link). The team votes them up or down with thumbs, and the list ranks by votes. It's an easy way to build consensus on who to book before committing.",
      snapshot: <CurationMock />,
    },
    {
      id: "lineup",
      title: "Build the final lineup",
      body: "The Final Lineup tab is where you lock in acts. Search the shared artist database and add DJs to the lineup; if someone's new, use New Artist to add them to the database and the lineup in one go.",
      snapshot: <LineupMock />,
    },
    {
      id: "complete",
      title: "Wrap up",
      body: "When the project is done, set the status to Completed or hit Mark Complete (admins). That stamps the end date and moves the project over to the Archive, where its payments and wrap-up notes live.",
      snapshot: <CompleteMock />,
    },
  ],
};
