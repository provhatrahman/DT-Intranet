import type { ArtistListItem } from "@/lib/api/artists";
import type { ArtistGigScore } from "@/lib/api/analytics";
import type { ComboboxOption } from "@/components/ui/combobox";

export type BookingFilter = "all" | "never" | "booked" | "recent" | "stale";

/** Shared "no filter" sentinel for the roster's dropdown filters. */
export const ALL = "all";

// type_of_act is free text that reads like a list — the roster holds "DJ",
// "DJ, Live Act", "DJ / Producer" and "DJ / LIVE Act" as separate strings. Split
// it into tokens so one dropdown option matches every spelling of an act type,
// rather than offering a menu of near-duplicate combinations.
export function actTypeTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,/]/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export interface FilterOption {
  /** Lowercased match key. */
  value: string;
  /** The roster's most common spelling of this value. */
  label: string;
  count: number;
}

// Builds a filter dropdown's options from the whole roster (not the filtered
// view — otherwise options vanish as you narrow). Genres and cities are
// free-text and inconsistently cased ("Jungle" and "jungle" are one genre), so
// options are keyed lowercase and labelled with the commonest spelling.
export function collectOptions(
  artists: ArtistListItem[],
  valuesOf: (artist: ArtistListItem) => string[]
): FilterOption[] {
  const groups = new Map<
    string,
    { count: number; spellings: Map<string, number> }
  >();
  for (const artist of artists) {
    // Dedupe within one artist so a repeated value can't count them twice.
    const seen = new Set<string>();
    for (const raw of valuesOf(artist)) {
      const label = raw.trim();
      const key = label.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const group = groups.get(key) ?? { count: 0, spellings: new Map() };
      group.count += 1;
      group.spellings.set(label, (group.spellings.get(label) ?? 0) + 1);
      groups.set(key, group);
    }
  }
  return [...groups.entries()]
    .map(([value, { count, spellings }]) => ({
      value,
      count,
      label: [...spellings.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
      )[0][0],
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Turns a FilterOption list into Combobox options, with an "All" row first and
// the artist count as each row's description.
export function toComboboxOptions(
  allLabel: string,
  options: FilterOption[]
): ComboboxOption[] {
  return [
    { value: ALL, label: allLabel },
    ...options.map((option) => ({
      value: option.value,
      label: option.label,
      description: `${option.count} artist${option.count === 1 ? "" : "s"}`,
    })),
  ];
}

/**
 * Cutoff date ("YYYY-MM-DD") for "booked recently" — one year before `from`.
 * last_booked_date uses the same format, so callers compare lexically.
 */
export function recentBookingCutoff(from: Date = new Date()): string {
  const cutoff = new Date(from);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return cutoff.toISOString().slice(0, 10);
}

// Booking activity, from the analytics gig scores. Artists with no completed
// bookings have no stats entry at all, so a missing entry means "never booked".
export function matchesBookingFilter(
  stat: ArtistGigScore | undefined,
  filter: BookingFilter,
  recentCutoff: string
): boolean {
  const gigCount = stat?.gig_count ?? 0;
  const lastBooked = stat?.last_booked_date ?? null;
  switch (filter) {
    case "never":
      return gigCount === 0;
    case "booked":
      return gigCount > 0;
    case "recent":
      return lastBooked !== null && lastBooked >= recentCutoff;
    case "stale":
      return gigCount > 0 && (lastBooked === null || lastBooked < recentCutoff);
    default:
      return true;
  }
}
