/* eslint-disable react-refresh/only-export-components --
   Data module: exports a guide object built from private, non-exported mockup
   components. Fast-refresh HMR does not apply here. */
import { InfoTile, StatusBadge } from "@/components/greenroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  CalendarCheck,
  Clock,
  Mic,
  Music,
  Plus,
  Search,
  Star,
} from "lucide-react";
import type { HelpGuide } from "../types";
import { Snapshot, Callout } from "../Snapshot";
import { FakeField } from "../mockups";

/** Browse & search the whole roster. */
function BrowseMock() {
  return (
    <Snapshot title="Artists">
      <div className="space-y-2">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              readOnly
              tabIndex={-1}
              value="house"
              className="h-7 pl-6 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" />
            New Artist
          </Button>
        </div>
        {[
          { name: "Abana", facts: "DJ · electro, house", score: 9 },
          { name: "Somatic", facts: "DJ · house, garage", score: 5 },
        ].map((a) => (
          <div key={a.name} className="rounded-md border p-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-medium">{a.name}</div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Mic className="h-2.5 w-2.5" />
                    DJ
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Music className="h-2.5 w-2.5" />
                    {a.facts.split("· ")[1]}
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Star className="h-2.5 w-2.5" />
                {a.score}
              </span>
            </div>
          </div>
        ))}
      </div>
      <Callout n={1} label="Search name, genre, or city" x={38} y={16} />
      <Callout n={2} label="Gig score at a glance" x={88} y={48} align="left" />
    </Snapshot>
  );
}

/** The profile pane: stats tiles + booking history. */
function ProfileMock() {
  return (
    <Snapshot title="Artists — Somatic">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Somatic</span>
          <StatusBadge status="active" label="Active" tone="green" />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <InfoTile icon={Star} label="Total gig score">
            9
          </InfoTile>
          <InfoTile icon={CalendarCheck} label="Completed gigs">
            2
          </InfoTile>
          <InfoTile icon={Clock} label="Last booked">
            16 Aug 2025
          </InfoTile>
        </div>
        <div className="rounded-md border p-2">
          <div className="text-xs font-medium">Summer Warehouse Rave 2025</div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-2.5 w-2.5" />
              16 Aug 2025 · Drumsheds
            </span>
            <StatusBadge status="completed" label="Completed" />
          </div>
        </div>
      </div>
      <Callout n={1} label="Score, gigs & last booked" x={50} y={38} />
      <Callout n={2} label="Full booking history" x={55} y={74} />
    </Snapshot>
  );
}

/** Adding a new artist to the database. */
function AddMock() {
  return (
    <Snapshot title="New Artist">
      <div className="space-y-2">
        <FakeField label="Artist name" required value="DJ Nova" />
        <div className="grid grid-cols-2 gap-2">
          <FakeField label="Type of act" value="DJ" />
          <FakeField label="Genres" value="House, UKG" />
        </div>
        <div className="flex justify-end gap-1.5 pt-1">
          <Button variant="outline" size="sm" className="text-xs">
            Cancel
          </Button>
          <Button variant="default" size="sm" className="text-xs">
            Add to Database
          </Button>
        </div>
      </div>
      <Callout n={1} label="Only the name is required" x={55} y={20} />
    </Snapshot>
  );
}

export const artistsGuide: HelpGuide = {
  id: "artists",
  pages: [
    {
      id: "browse",
      title: "Browse the artist database",
      body: "The Artists app is the roster's home: every artist in the database, searchable by name, genre, or city, with filters for active/inactive artists and sorting by name, gig score, or last booked. No need to go through a project or event to find someone.",
      snapshot: <BrowseMock />,
    },
    {
      id: "profile",
      title: "Profiles & gig stats",
      body: "Select an artist to see their full profile — contact details, socials, genres, and bio — alongside their stats: total gig score (completed bookings weighted by gig size, XS = 1 up to XL = 5), how many gigs they've played, and the last time we booked them. Their full booking history is listed below.",
      snapshot: <ProfileMock />,
    },
    {
      id: "add",
      title: "Add & edit artists",
      body: "Use New Artist to add someone straight to the database — only the name is required, and the rest of the profile can be completed later. Open any profile and press Edit to update details, links, or their active status. If a search comes up empty, you can create the artist from the search itself.",
      snapshot: <AddMock />,
    },
  ],
};
