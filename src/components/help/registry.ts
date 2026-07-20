import type { HelpGuide, HelpGuideId } from "./types";
import { overviewGuide } from "./guides/overview";
import { pitchGuide } from "./guides/pitch";
import { inboxGuide } from "./guides/inbox";
import { activeProjectsGuide } from "./guides/activeProjects";
import { artistsGuide } from "./guides/artists";
import { archiveGuide } from "./guides/archive";
import { feedbackGuide } from "./guides/feedback";
import { greenroomAdminGuide } from "./guides/greenroomAdmin";

/**
 * All available help guides, keyed by guide id. Only the five Greenroom
 * domain guides exist today, so this is a partial map over `HelpGuideId`
 * (which spans every `AppId`); consumers must handle a missing entry.
 */
export const HELP_GUIDES: Partial<Record<HelpGuideId, HelpGuide>> = {
  overview: overviewGuide,
  pitch: pitchGuide,
  "incoming-offers": inboxGuide,
  "active-projects": activeProjectsGuide,
  artists: artistsGuide,
  archive: archiveGuide,
  "greenroom-admin": greenroomAdminGuide,
  feedback: feedbackGuide,
};
