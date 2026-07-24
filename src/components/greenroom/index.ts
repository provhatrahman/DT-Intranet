// Shared theme-adaptive UI kit for the Greenroom domain apps
// (Pitch, Inbox/Incoming Offers, Active Projects, Archive).
// Aqua (macosx) styling lives in the "Greenroom Aqua surfaces" section of
// src/styles/themes.css; every component falls back to the flat shadcn look
// under the system7/xp/win98 themes.
export { AquaCard } from "./AquaCard";
export { ArtistFacts } from "./ArtistFacts";
export { StatusBadge, type BadgeTone } from "./StatusBadge";
export { AppToolbar } from "./AppToolbar";
export { InfoTile } from "./InfoTile";
export { EmptyState } from "./EmptyState";
export { SidebarRow } from "./SidebarRow";
export { Field } from "./Field";
export { FormDialog } from "./FormDialog";
export { NoticePanel, type NoticeTone } from "./NoticePanel";
export { CommentThread, type ThreadComment } from "./CommentThread";
export { useOsTheme } from "@/hooks/useOsTheme";
