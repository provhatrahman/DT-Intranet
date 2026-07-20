import type { LucideIcon } from "lucide-react";
import { MapPin, Mic, Music } from "lucide-react";
import type { ArtistListItem } from "@/lib/api/artists";

/**
 * Compact fact row for an artist: each datapoint prefixed with a small icon
 * (mic = type of act, note = genres, pin = city) instead of plain-text
 * separators, so rows scan at a glance. Shared by the Artists app roster and
 * the Active Projects lineup tab.
 */
export function ArtistFacts({ artist }: { artist: ArtistListItem }) {
  const facts: { icon: LucideIcon; text: string; title?: string }[] = [];
  if (artist.type_of_act) {
    facts.push({ icon: Mic, text: artist.type_of_act });
  }
  if (artist.genres.length > 0) {
    const shown = artist.genres.slice(0, 3).join(", ");
    facts.push({
      icon: Music,
      text:
        artist.genres.length > 3
          ? `${shown} +${artist.genres.length - 3}`
          : shown,
      title: artist.genres.join(", "),
    });
  }
  if (artist.locations.length > 0) {
    facts.push({
      icon: MapPin,
      text: artist.locations[0].city,
      title: artist.locations
        .map((l) => `${l.city} (${l.country})`)
        .join(", "),
    });
  }
  if (facts.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground min-w-0">
      {facts.map(({ icon: Icon, text, title }, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 min-w-0"
          title={title ?? text}
        >
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{text}</span>
        </span>
      ))}
    </div>
  );
}
