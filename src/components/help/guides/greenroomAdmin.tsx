/* eslint-disable react-refresh/only-export-components --
   Data module: exports a guide object built from private, non-exported mockup
   components. Fast-refresh HMR does not apply here. */
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Field, StatusBadge } from "@/components/greenroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HelpGuide } from "../types";
import { Snapshot, Callout } from "../Snapshot";
import { FakeField } from "../mockups";

/** A single user row as it appears in the Admin Portal list. */
function UserRow({
  name,
  email,
  role,
  tone,
  admin,
}: {
  name: string;
  email: string;
  role: string;
  tone: "purple" | "blue" | "green" | "gray";
  admin?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium">{name}</span>
          {admin && (
            <ShieldCheck className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
        </div>
        <div className="truncate text-[10px] text-muted-foreground">{email}</div>
      </div>
      <StatusBadge status={role} tone={tone} label={role} />
      <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
        <Pencil className="h-3.5 w-3.5" />
        <Trash2 className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

/** The user list — the main screen of the Admin Portal. */
function UserListMock() {
  return (
    <Snapshot title="Admin Portal">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold">Users (4)</span>
        <Button variant="default" size="sm" className="text-xs">
          <Plus className="mr-1 h-3 w-3" /> New User
        </Button>
      </div>
      <div className="space-y-2">
        <UserRow
          name="admin"
          email="admin@daytimers.org"
          role="Admin"
          tone="purple"
          admin
        />
        <UserRow
          name="manager1"
          email="manager1@daytimers.org"
          role="Manager"
          tone="blue"
          admin
        />
        <UserRow
          name="coordinator1"
          email="coordinator1@daytimers.org"
          role="Coordinator"
          tone="green"
        />
        <UserRow
          name="staff1"
          email="staff1@daytimers.org"
          role="Staff"
          tone="gray"
        />
      </div>
      <Callout n={1} label="Add a user" x={80} y={7} align="left" />
      <Callout n={2} label="Shield = admin access" x={40} y={30} align="left" />
      <Callout n={3} label="Edit or delete" x={90} y={30} align="left" />
    </Snapshot>
  );
}

/** The create/edit form. */
function UserFormMock() {
  return (
    <Snapshot title="New User">
      <div className="space-y-3">
        <FakeField label="Username" required value="jordan" />
        <FakeField label="Email" required value="jordan@daytimers.org" />
        <Field label="Role" required>
          <Input
            readOnly
            tabIndex={-1}
            value="Coordinator"
            className="h-8 text-xs"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="text-xs">
            Cancel
          </Button>
          <Button variant="default" size="sm" className="text-xs">
            Create User
          </Button>
        </div>
      </div>
      <Callout n={1} label="Email = their Google login" x={68} y={30} align="left" />
      <Callout n={2} label="Role sets admin access" x={55} y={54} align="left" />
    </Snapshot>
  );
}

export const greenroomAdminGuide: HelpGuide = {
  id: "greenroom-admin",
  pages: [
    {
      id: "overview",
      title: "Manage who can use Greenroom",
      body: "The Admin Portal lists everyone with access to Greenroom. A user's email is the Google account allowed to sign in — no email row, no access. Only admins can open this app; the API also enforces admin access on the server, so the controls here can't be bypassed. Each row shows the user's role, and a shield marks the roles that get admin access.",
      snapshot: <UserListMock />,
    },
    {
      id: "add-edit",
      title: "Add, edit, or remove a user",
      body: "Use New User to grant access: enter a username, the Google email they'll sign in with, and a role. Admin and Manager roles get admin access; Coordinator and Staff do not. The pencil edits a user's details or role, and the trash removes their access entirely — you can't delete your own account. Changes take effect immediately.",
      snapshot: <UserFormMock />,
    },
  ],
};
