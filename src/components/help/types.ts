import type { ReactNode } from "react";
import type { AppId } from "@/config/appIds";

/**
 * Identifies a help guide. `"overview"` is the cross-app "How to use
 * Greenroom" walkthrough; the rest map 1:1 to a domain app id.
 */
export type HelpGuideId = "overview" | AppId;

/**
 * One page of a multi-page help guide: a short explanation paired with a
 * hand-built mockup "snapshot" of the app UI. Callouts are authored inside
 * the `snapshot` node itself (via `<Callout />`), so the dialog only has to
 * render `snapshot` — it never needs to know callout geometry.
 */
export interface HelpGuidePage {
  /** Stable key for React lists and the page indicator. */
  id: string;
  /** Page heading (hardcoded English, matching the untranslated app copy). */
  title: string;
  /** Short explanatory copy — plain string or a rich node. */
  body: ReactNode;
  /** Non-interactive mockup of the app screen this page describes. */
  snapshot: ReactNode;
}

/** An ordered, multi-page guide for a single app (or the overview). */
export interface HelpGuide {
  id: HelpGuideId;
  pages: HelpGuidePage[];
}
