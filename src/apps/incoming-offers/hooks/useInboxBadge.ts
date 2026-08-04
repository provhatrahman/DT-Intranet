import { useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePitchesStore } from "@/stores/usePitchesStore";
import { useBookingsStore } from "@/stores/useBookingsStore";
import { useEffectiveGreenroomAccount } from "@/hooks/useGreenroomAccount";
import { INBOX_PITCH_STATUSES } from "../data";

// Re-poll cadence for the badge's background sync (mirrors "check for new
// mail" apps): every 5 minutes, plus on window focus (throttled below).
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const FOCUS_REFETCH_THROTTLE_MS = 30 * 1000;

/**
 * How many Inbox items (submitted/under_review pitches + pending bookings)
 * the effective user has NOT yet voted on. Drives the red badge on the Inbox
 * app icon everywhere it renders.
 *
 * "Voted" means the item's loaded detail record has a vote row for this user
 * with vote_value 1 or -1 — a 0 (abstain/cleared) row does NOT count as
 * voted, matching the counting rule for the Inbox badge. Items whose detail
 * hasn't loaded yet are excluded entirely so the badge never flashes a guess
 * and then corrects itself; it settles once details arrive (fetched by
 * InboxBadgeSync, mounted once in the app shell).
 */
export function useInboxUnvotedCount(): number {
  const { userId } = useEffectiveGreenroomAccount();

  const { pitches, pitchDetails } = usePitchesStore(
    useShallow((s) => ({ pitches: s.pitches, pitchDetails: s.pitchDetails }))
  );
  const { bookings, bookingDetails } = useBookingsStore(
    useShallow((s) => ({ bookings: s.bookings, bookingDetails: s.bookingDetails }))
  );

  return useMemo(() => {
    if (!userId) return 0;

    let count = 0;

    for (const pitch of pitches) {
      if (!INBOX_PITCH_STATUSES.includes(pitch.status)) continue;
      const detail = pitchDetails[pitch.id];
      if (!detail) continue; // detail not loaded yet — exclude, never guess
      const hasVoted = detail.votes.some(
        (v) => v.user_id === userId && (v.vote_value === 1 || v.vote_value === -1)
      );
      if (!hasVoted) count++;
    }

    for (const booking of bookings) {
      if (booking.status !== "pending") continue;
      const detail = bookingDetails[booking.booking_id];
      if (!detail) continue;
      const hasVoted = detail.votes.some(
        (v) => v.user_id === userId && (v.vote_value === 1 || v.vote_value === -1)
      );
      if (!hasVoted) count++;
    }

    return count;
  }, [userId, pitches, pitchDetails, bookings, bookingDetails]);
}

/**
 * Render-nothing singleton that keeps the data behind the Inbox badge fresh:
 * fetches the pitch/booking lists (and, for any inbox item missing its
 * detail, the detail itself so the vote-based count can be computed) on
 * mount, on a 5-minute interval, and on window focus (throttled).
 *
 * Mount exactly once in the always-rendered app shell (see AppManager.tsx) —
 * NOT inside the Inbox app itself, so the badge stays accurate even while the
 * Inbox window is closed.
 */
export function InboxBadgeSync(): null {
  const { userId } = useEffectiveGreenroomAccount();

  const { pitches, pitchDetails, fetchPitches, refreshPitch } = usePitchesStore(
    useShallow((s) => ({
      pitches: s.pitches,
      pitchDetails: s.pitchDetails,
      fetchPitches: s.fetchPitches,
      refreshPitch: s.refreshPitch,
    }))
  );
  const { bookings, bookingDetails, fetchBookings, refreshBooking } = useBookingsStore(
    useShallow((s) => ({
      bookings: s.bookings,
      bookingDetails: s.bookingDetails,
      fetchBookings: s.fetchBookings,
      refreshBooking: s.refreshBooking,
    }))
  );

  const lastFetchRef = useRef<number>(0);

  // Initial load + 5-minute poll + focus-triggered refetch (throttled).
  useEffect(() => {
    if (!userId) return;

    const load = () => {
      lastFetchRef.current = Date.now();
      fetchPitches().catch((err) => {
        console.error("[InboxBadgeSync] Failed to fetch pitches:", err);
      });
      fetchBookings().catch((err) => {
        console.error("[InboxBadgeSync] Failed to fetch bookings:", err);
      });
    };

    load();

    const interval = setInterval(load, POLL_INTERVAL_MS);

    const handleFocus = () => {
      if (Date.now() - lastFetchRef.current < FOCUS_REFETCH_THROTTLE_MS) return;
      load();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [userId, fetchPitches, fetchBookings]);

  // Whenever the pitch/booking lists contain inbox items whose details
  // haven't loaded yet, fetch just those — mirrors
  // IncomingOffersAppComponent's own detail-loading effects, guarded the same
  // way (only ids missing from *Details) so this can't loop.
  useEffect(() => {
    if (!userId) return;
    const missingIds = pitches
      .filter((p) => INBOX_PITCH_STATUSES.includes(p.status))
      .map((p) => p.id)
      .filter((id) => !pitchDetails[id]);
    if (missingIds.length === 0) return;
    Promise.all(
      missingIds.map((id) =>
        refreshPitch(id).catch((err) =>
          console.error(`[InboxBadgeSync] Failed to load pitch ${id}:`, err)
        )
      )
    );
  }, [userId, pitches, pitchDetails, refreshPitch]);

  useEffect(() => {
    if (!userId) return;
    const missingIds = bookings
      .filter((b) => b.status === "pending")
      .map((b) => b.booking_id)
      .filter((id) => !bookingDetails[id]);
    if (missingIds.length === 0) return;
    Promise.all(
      missingIds.map((id) =>
        refreshBooking(id).catch((err) =>
          console.error(`[InboxBadgeSync] Failed to load booking ${id}:`, err)
        )
      )
    );
  }, [userId, bookings, bookingDetails, refreshBooking]);

  return null;
}
