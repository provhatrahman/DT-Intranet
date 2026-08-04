// "Copy link to card" smart deep-link system for the Greenroom domain apps.
//
// Cards in Inbox/Active Projects/Archive move between apps over their
// lifecycle (pending offer -> approved -> active project -> archived), so a
// shared link encodes the underlying record ("/open/pitch/{id}" etc.) rather
// than the app it happens to live in today. AppManager parses the path on
// load and calls resolveOpenLink() to figure out where the record currently
// lives, then dispatches the normal launchApp CustomEvent — mirrors the
// existing /ipod/{videoId} and /videos/{videoId} share-link branches there.
import { getPitchById } from "@/lib/api/pitches";
import { getBookingById, getBookings } from "@/lib/api/bookings";
import { getProjectById } from "@/lib/api/projects";
import { INBOX_PITCH_STATUSES } from "@/apps/incoming-offers/data";

export type OpenLinkKind = "pitch" | "booking" | "project";

export interface OfferLinkSource {
  source: "pitch" | "booking";
  pitchId?: number;
  bookingId?: number;
}

export function generateOfferLink(offer: OfferLinkSource): string {
  if (offer.source === "pitch" && offer.pitchId != null) {
    return `${window.location.origin}/open/pitch/${offer.pitchId}`;
  }
  if (offer.source === "booking" && offer.bookingId != null) {
    return `${window.location.origin}/open/booking/${offer.bookingId}`;
  }
  throw new Error("This offer has no pitch or booking id to link to");
}

export function generateProjectLink(projectId: number): string {
  return `${window.location.origin}/open/project/${projectId}`;
}

export interface ParsedOpenLink {
  kind: OpenLinkKind;
  id: number;
}

const OPEN_PATH_RE = /^\/open\/(pitch|booking|project)\/(\d+)\/?$/;

export function parseOpenPath(path: string): ParsedOpenLink | null {
  const match = path.match(OPEN_PATH_RE);
  if (!match) return null;
  const id = Number(match[2]);
  if (!Number.isFinite(id)) return null;
  return { kind: match[1] as OpenLinkKind, id };
}

export interface ResolvedOpenLink {
  appId: "incoming-offers" | "active-projects" | "archive";
  initialData: object;
}

// Thrown for any condition a user should see verbatim in a toast (dead link,
// item not currently visible anywhere, or an underlying fetch failure). Not a
// distinct class — every other api/*.ts module in this repo throws plain
// Errors and lets callers read `.message`, so this follows the same pattern.
const FETCH_FAILURE_MESSAGE =
  "Couldn't open the link — the item may have been removed or you may not have access.";

// A pitch/booking that isn't inbox-pending recurses into its linked project;
// this is the only other hop the resolver ever takes, so no depth counter is
// needed to prevent runaway recursion.
async function resolveProject(projectId: number): Promise<ResolvedOpenLink> {
  const project = await getProjectById(projectId).catch(() => {
    throw new Error(FETCH_FAILURE_MESSAGE);
  });

  if (project.status === "active") {
    return {
      appId: "active-projects",
      initialData: { focusProjectId: projectId },
    };
  }

  if (project.status === "completed" || project.status === "cancelled") {
    return { appId: "archive", initialData: { focusProjectId: projectId } };
  }

  if (project.status === "on_hold") {
    // A "logged offer" project sits on_hold until its booking is decided.
    // While it's still pending, the record lives in the Inbox, not here.
    const bookings = await getBookings().catch(() => {
      throw new Error(FETCH_FAILURE_MESSAGE);
    });
    const pendingBooking = bookings.find(
      (b) => b.project_id === projectId && b.status === "pending"
    );
    if (pendingBooking) {
      return {
        appId: "incoming-offers",
        initialData: { focusOfferId: `booking-${pendingBooking.booking_id}` },
      };
    }
    throw new Error("This item isn't currently visible in any app");
  }

  // Any other status (e.g. "archived" with no completed/cancelled precursor,
  // or a status the frontend doesn't otherwise render) isn't shown anywhere.
  throw new Error("This item isn't currently visible in any app");
}

export async function resolveOpenLink(
  kind: OpenLinkKind,
  id: number
): Promise<ResolvedOpenLink> {
  if (kind === "pitch") {
    const pitch = await getPitchById(id).catch(() => {
      throw new Error(FETCH_FAILURE_MESSAGE);
    });

    if (INBOX_PITCH_STATUSES.includes(pitch.status)) {
      return {
        appId: "incoming-offers",
        initialData: { focusOfferId: `pitch-${id}` },
      };
    }
    if (pitch.status === "approved" && pitch.project_id != null) {
      return resolveProject(pitch.project_id);
    }
    // rejected / closed / draft, or approved-without-a-project.
    throw new Error("This pitch is no longer active");
  }

  if (kind === "booking") {
    const booking = await getBookingById(id).catch(() => {
      throw new Error(FETCH_FAILURE_MESSAGE);
    });

    if (booking.status === "pending") {
      return {
        appId: "incoming-offers",
        initialData: { focusOfferId: `booking-${id}` },
      };
    }
    return resolveProject(booking.project.id);
  }

  // kind === "project"
  return resolveProject(id);
}
