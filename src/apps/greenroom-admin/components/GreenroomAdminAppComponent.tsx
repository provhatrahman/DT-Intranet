import { useState, useEffect, useMemo } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { GreenroomAdminMenuBar } from "./GreenroomAdminMenuBar";
import HelpGuideDialog from "@/components/help/HelpGuideDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { useUsersStore } from "@/stores/useUsersStore";
import { useIsGreenroomAdmin } from "@/hooks/useGreenroomAccount";
import {
  GreenroomUser,
  USER_ROLES,
  UserRole,
  CreateUserPayload,
} from "@/lib/api/users";
import {
  AppToolbar,
  AquaCard,
  EmptyState,
  Field,
  FormDialog,
  StatusBadge,
  type BadgeTone,
  useOsTheme,
} from "@/components/greenroom";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Loader2,
  Pencil,
  Plus,
  Trash2,
  ShieldCheck,
  UserPlus,
  AlertTriangle,
} from "lucide-react";

// Role → badge tone. Role values aren't in the shared STATUS_TONES map, so pass
// an explicit tone. Admin roles (admin/manager) get the warmer tones.
const ROLE_TONES: Record<string, BadgeTone> = {
  admin: "purple",
  manager: "blue",
  coordinator: "green",
  staff: "gray",
};

function prettifyRole(role: string | null): string {
  if (!role) return "No role";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function GreenroomAdminAppComponent({
  isWindowOpen,
  onClose,
  isForeground,
  skipInitialSound,
  instanceId,
  onNavigateNext,
  onNavigatePrevious,
}: AppProps) {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  // The user being edited, or `true` to signal "create a new user".
  const [editingUser, setEditingUser] = useState<GreenroomUser | true | null>(
    null
  );
  const [pendingDelete, setPendingDelete] = useState<GreenroomUser | null>(
    null
  );

  const { isXpTheme, isMacTheme } = useOsTheme();

  // Admin gate. useIsGreenroomAdmin resolves the effective account (real login,
  // dev account, or local-dev "View as"), so this works in dev and prod. The
  // real protection is server-side — the backend rejects non-admin tokens on
  // the write endpoints regardless of this UI gate.
  const isAdmin = useIsGreenroomAdmin();

  const { users, isLoading, error, fetchUsers, deleteUser, clearError } =
    useUsersStore();

  // Fetch users when the window opens (admins only — non-admins can't read the
  // richer list and would just hit the Access Denied screen).
  useEffect(() => {
    if (isWindowOpen && isAdmin) {
      fetchUsers().catch((err) => {
        console.error("Failed to fetch users:", err);
      });
    }
  }, [isWindowOpen, isAdmin, fetchUsers]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username)),
    [users]
  );

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    try {
      await deleteUser(pendingDelete.id);
      toast.success(`Removed ${pendingDelete.username}`);
    } catch {
      // error surfaced via the store error toast
    } finally {
      setPendingDelete(null);
    }
  };

  const menuBar = (
    <GreenroomAdminMenuBar
      onClose={onClose}
      onShowHelp={() => setIsHelpDialogOpen(true)}
      onNewUser={() => setEditingUser(true)}
      onRefresh={() => {
        fetchUsers().catch(() => {});
      }}
      canManage={isAdmin}
    />
  );

  if (!isWindowOpen) return null;

  // Access denied — not a Greenroom admin.
  if (!isAdmin) {
    return (
      <>
        {!isXpTheme && isForeground && menuBar}
        <WindowFrame
          title="Admin Portal"
          onClose={onClose}
          isForeground={isForeground}
          appId="greenroom-admin"
          skipInitialSound={skipInitialSound}
          instanceId={instanceId}
          onNavigateNext={onNavigateNext}
          onNavigatePrevious={onNavigatePrevious}
          menuBar={isXpTheme ? menuBar : undefined}
        >
          <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground/60" />
            <h2 className="text-sm font-bold">Access Denied</h2>
            <p className="text-xs text-muted-foreground max-w-xs">
              The Admin Portal is only available to Greenroom admins. Ask an
              admin to grant your account access.
            </p>
          </div>
        </WindowFrame>
      </>
    );
  }

  return (
    <>
      {!isXpTheme && isForeground && menuBar}
      <WindowFrame
        title="Admin Portal"
        onClose={onClose}
        isForeground={isForeground}
        appId="greenroom-admin"
        skipInitialSound={skipInitialSound}
        instanceId={instanceId}
        onNavigateNext={onNavigateNext}
        onNavigatePrevious={onNavigatePrevious}
        menuBar={isXpTheme ? menuBar : undefined}
      >
        <div className="flex flex-col h-full w-full min-h-0">
          <AppToolbar>
            <div className="flex items-center gap-2 mr-auto">
              <h2 className="text-sm font-semibold">Users</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {users.length > 0 ? `(${users.length})` : ""}
              </span>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setEditingUser(true)}
              className="min-h-[32px] touch-manipulation"
            >
              <span className="inline-flex items-center">
                <Plus className="h-4 w-4 mr-1" />
                New User
              </span>
            </Button>
          </AppToolbar>

          <div
            className={cn(
              "flex-1 min-h-0 p-4",
              isMacTheme ? "pt-3" : "bg-background"
            )}
          >
            <ScrollArea className="h-full [&_[data-radix-scroll-area-viewport]>div]:block!">
              {isLoading && users.length === 0 ? (
                <EmptyState title="Loading users…" className="py-10" />
              ) : sortedUsers.length === 0 ? (
                <EmptyState
                  icon={UserPlus}
                  title="No users yet"
                  hint="Add the first user to grant them access to Greenroom."
                  className="py-10"
                />
              ) : (
                <div className="space-y-2">
                  {sortedUsers.map((user) => (
                    <div
                      key={user.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-md",
                        isMacTheme ? "aqua-well" : "border"
                      )}
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-sm truncate">
                            {user.username}
                          </span>
                          {user.is_admin && (
                            <ShieldCheck
                              className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                              aria-label="Admin access"
                            />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </div>
                      </div>
                      <StatusBadge
                        status={user.role ?? "none"}
                        label={prettifyRole(user.role)}
                        tone={
                          user.role ? ROLE_TONES[user.role] ?? "gray" : "gray"
                        }
                        className="shrink-0"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setEditingUser(user)}
                          title={`Edit ${user.username}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setPendingDelete(user)}
                          title={`Delete ${user.username}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <UserFormDialog
          // `true` = create; an object = edit. Keyed so the form resets between
          // opening for different users / create.
          key={editingUser === true ? "new" : editingUser?.id ?? "closed"}
          user={editingUser === true ? null : editingUser}
          isOpen={editingUser !== null}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null);
          }}
        />

        <ConfirmDialog
          isOpen={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Delete User"
          description={`Remove "${
            pendingDelete?.username ?? "this user"
          }" from Greenroom? They will lose access to the app. This cannot be undone.`}
        />

        <HelpGuideDialog
          isOpen={isHelpDialogOpen}
          onOpenChange={setIsHelpDialogOpen}
          guideId="greenroom-admin"
        />
      </WindowFrame>
    </>
  );
}

// Create/edit form. `user === null` means create; otherwise edit that user.
function UserFormDialog({
  user,
  isOpen,
  onOpenChange,
}: {
  user: GreenroomUser | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createUser, updateUser } = useUsersStore();
  const isEdit = user !== null;

  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<UserRole>(
    (user?.role as UserRole) ?? "staff"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit =
    username.trim().length > 0 &&
    email.trim().length > 0 &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      if (isEdit && user) {
        await updateUser(user.id, {
          username: username.trim(),
          email: email.trim(),
          role,
        });
        toast.success("User updated");
      } else {
        const payload: CreateUserPayload = {
          username: username.trim(),
          email: email.trim(),
          role,
        };
        await createUser(payload);
        toast.success("User created");
      }
      onOpenChange(false);
    } catch {
      // error surfaced via the store error toast; keep the dialog open to retry
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit User" : "New User"}
      description={
        isEdit
          ? "Update this user's details. Their email is the Google account allowed to sign in."
          : "Add a user to Greenroom. Their email is the Google account allowed to sign in; only admin/manager roles get admin access."
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button variant="default" onClick={handleSubmit} disabled={!canSubmit}>
            <span className="inline-flex items-center">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {isSubmitting
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save Changes"
                  : "Create User"}
            </span>
          </Button>
        </>
      }
    >
      <AquaCard>
        <CardContent className="p-4 space-y-3">
          <Field label="Username" required>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. jordan"
              autoFocus
            />
          </Field>
          <Field label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </Field>
          <Field label="Role" required>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {prettifyRole(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </AquaCard>
    </FormDialog>
  );
}
