// Greenroom-domain "admin" designation.
//
// HISTORICAL NOTE: this list originated as a frontend-only allowlist back when
// the Greenroom API had no auth or roles. That is no longer the source of truth.
// Admin status is now driven by the backend's authoritative `is_admin` flag on
// the signed-in user (derived from their `users.role`), which the backend ALSO
// enforces server-side. See useEffectiveGreenroomAccount / useIsGreenroomAdmin.
//
// This ID list is kept only as a FALLBACK for identities that have no auth user
// (the local-dev VITE_DEV_GREENROOM_USER_ID account and legacy manual links) and
// to back the dev-only "View as" preview below. To grant a real (logged-in) user
// admin, set their role in the backend `users` table — do NOT add their ID here.
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
