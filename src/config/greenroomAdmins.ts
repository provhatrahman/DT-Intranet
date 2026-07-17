// Greenroom-domain "admin" designation.
//
// IMPORTANT: the external Greenroom API has NO authentication and NO user roles
// (see FUNCTIONALITY_AUDIT.md and BACKEND_STATE.md). Every write is anonymous and
// credited server-side to a default user. So "admin" here is a **frontend-only**
// allowlist of Greenroom user IDs — it controls what the UI *offers* (e.g. the
// admin-only "decline" action on pitches), but it is NOT enforced on the server.
// Anyone who calls the API directly bypasses it. Treat this as UI gating for a
// prototype, not real access control. Real enforcement needs backend auth + roles.
//
// This is intentionally separate from the ryOS platform admin (`username === "ryo"`),
// which gates the desktop shell's admin app and is unrelated to Greenroom users.
//
// Dummy admin accounts seeded below map to real users on the live backend:
//   8  = "admin"     — the natural domain admin
//   9  = "manager1"
//   10 = "manager2"
// Other known users (non-admin by default): 11 coordinator1, 12 coordinator2,
//   13 staff1, 14 staff2. Edit the list to change who is treated as an admin.
//
// See also VIEW_AS_* below and useDevViewAsStore — the admin-gated "View as"
// menu impersonates one of these identities to preview role-gated UI.

export interface GreenroomAdminAccount {
  userId: number;
  username: string;
}

export const GREENROOM_ADMIN_ACCOUNTS: readonly GreenroomAdminAccount[] = [
  { userId: 8, username: "admin" },
  { userId: 9, username: "manager1" },
  { userId: 10, username: "manager2" },
];

export const GREENROOM_ADMIN_USER_IDS: readonly number[] =
  GREENROOM_ADMIN_ACCOUNTS.map((a) => a.userId);

/** Whether a given Greenroom user ID is a (frontend-designated) admin. */
export function isGreenroomAdminUserId(
  userId: number | null | undefined
): boolean {
  return userId != null && GREENROOM_ADMIN_USER_IDS.includes(userId);
}

// The two live-backend identities the dev-only "View as" menu flips between.
// Admin id 8 is in the allowlist above; non-admin id 13 ("staff1") is not.
export const VIEW_AS_ADMIN_USER_ID = 8; // "admin"
export const VIEW_AS_NON_ADMIN_USER_ID = 13; // "staff1"
