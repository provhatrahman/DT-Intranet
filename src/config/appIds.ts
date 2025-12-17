export const appIds = [
  "finder",
  "soundboard",
  "internet-explorer",
  "chats",
  "textedit",
  "paint",
  "photo-booth",
  "minesweeper",
  "videos",
  "ipod",
  "synth",
  "pc",
  "terminal",
  "applet-viewer",
  "control-panels",
  "admin",
  "incoming-offers",
  "active-projects",
] as const;

export type AppId = (typeof appIds)[number];
