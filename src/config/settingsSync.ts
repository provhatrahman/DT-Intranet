// Configuration for the account-tied UI-settings sync layer (see
// src/hooks/useSettingsSync.ts). The whole feature is dormant unless
// AUTH_ENABLED (src/config/auth.ts) — it only runs for a logged-in user.

/**
 * How to reconcile this device's local styling with the account's saved
 * styling when a user logs in and the two differ.
 *
 * - `"server-wins"` (default): on login, apply the account's saved settings;
 *   if the account has no row yet, seed it from this device. Best for "my look
 *   follows my account across devices".
 * - `"last-write-wins"`: whichever side was edited most recently wins
 *   (compares snapshot `updatedAt` vs the server's).
 * - `"local-wins"`: never pull; this device only ever pushes its settings up
 *   (a one-way backup).
 *
 * Kept as a single constant so the policy is a one-line swap; the pull() action
 * in useSettingsSyncStore is the only consumer.
 */
export type SettingsConflictStrategy =
  | "server-wins"
  | "last-write-wins"
  | "local-wins";

export const SETTINGS_CONFLICT_STRATEGY: SettingsConflictStrategy = "server-wins";

/** Trailing debounce before a styling change is pushed to the account. */
export const SETTINGS_SYNC_DEBOUNCE_MS = 1500;

/**
 * Max time a stream of rapid changes can defer a push, so a continuous drag/
 * toggle spree still checkpoints instead of starving the debounce forever.
 */
export const SETTINGS_SYNC_MAX_WAIT_MS = 10000;
