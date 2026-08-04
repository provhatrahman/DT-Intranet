import { useState, useEffect, useMemo } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { GreenroomAdminMenuBar } from "./GreenroomAdminMenuBar";
import { NotificationsAdminTab } from "./NotificationsAdminTab";
import HelpGuideDialog from "@/components/help/HelpGuideDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { useUsersStore } from "@/stores/useUsersStore";
import {
  useEffectiveGreenroomAccount,
  useIsGreenroomAdmin,
} from "@/hooks/useGreenroomAccount";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeedbackStore } from "@/stores/useFeedbackStore";
import {
  FeedbackReport,
  FeedbackStatus,
  FeedbackAppContext,
} from "@/lib/api/feedback";
import { getTabStyles } from "@/utils/tabStyles";
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
  Inbox,
  Ban,
  UserCheck,
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
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [pendingDisable, setPendingDisable] = useState<GreenroomUser | null>(
    null
  );
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  const { themeId, isXpTheme, isMacTheme } = useOsTheme();
  const tabStyles = getTabStyles(themeId);
  const [activeTab, setActiveTab] = useState("users");

  // Admin gate. useIsGreenroomAdmin resolves the effective account (real login,
  // dev account, or local-dev "View as"), so this works in dev and prod. The
  // real protection is server-side — the backend rejects non-admin tokens on
  // the write endpoints regardless of this UI gate.
  const isAdmin = useIsGreenroomAdmin();
  // The signed-in user's own id, to hide the Disable control on their own row
  // (the backend also blocks disabling yourself, but hiding it avoids a
  // confusing 400 round-trip).
  const { userId: currentUserId } = useEffectiveGreenroomAccount();

  const {
    users,
    isLoading,
    error,
    fetchUsers,
    updateUser,
    deleteUser,
    clearError,
  } = useUsersStore();

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
    if (!pendingDelete || isDeletingUser) return;
    setIsDeletingUser(true);
    try {
      await deleteUser(pendingDelete.id);
      toast.success(`Removed ${pendingDelete.username}`);
    } catch {
      // error surfaced via the store error toast
    } finally {
      setIsDeletingUser(false);
      setPendingDelete(null);
    }
  };

  // Enabling is reversible and non-destructive, so it fires immediately —
  // no confirm step.
  const handleEnableUser = async (user: GreenroomUser) => {
    try {
      await updateUser(user.id, { is_active: true });
      toast.success(`Enabled ${user.username}`);
    } catch {
      // error surfaced via the store error toast
    }
  };

  const handleDisableConfirm = async () => {
    if (!pendingDisable || isTogglingActive) return;
    setIsTogglingActive(true);
    try {
      await updateUser(pendingDisable.id, { is_active: false });
      toast.success(`Disabled ${pendingDisable.username}`);
    } catch {
      // error surfaced via the store error toast
    } finally {
      setIsTogglingActive(false);
      setPendingDisable(null);
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
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col h-full min-h-0"
          >
            <AppToolbar>
              <TabsList className={cn(tabStyles.tabListClasses, "w-auto!")}>
                <TabsTrigger
                  className={tabStyles.tabTriggerClasses}
                  value="users"
                >
                  Users{users.length > 0 ? ` (${users.length})` : ""}
                </TabsTrigger>
                <TabsTrigger
                  className={tabStyles.tabTriggerClasses}
                  value="feedback"
                >
                  Feedback
                </TabsTrigger>
                <TabsTrigger
                  className={tabStyles.tabTriggerClasses}
                  value="notifications"
                >
                  Notifications
                </TabsTrigger>
              </TabsList>
              {activeTab === "users" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setEditingUser(true)}
                  className="ml-auto min-h-[32px] touch-manipulation"
                >
                  <span className="inline-flex items-center">
                    <Plus className="h-4 w-4 mr-1" />
                    New User
                  </span>
                </Button>
              )}
            </AppToolbar>

            <TabsContent
              value="users"
              className={cn(
                "flex-1 min-h-0 p-4 mt-0",
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
                    {sortedUsers.map((user) => {
                      const isSelf = currentUserId === user.id;
                      return (
                      <div
                        key={user.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-md",
                          isMacTheme ? "aqua-well" : "border",
                          !user.is_active && "opacity-60"
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
                        {!user.is_active && (
                          <StatusBadge
                            status="disabled"
                            label="Disabled"
                            tone="red"
                            className="shrink-0"
                          />
                        )}
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
                          {user.is_active ? (
                            !isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setPendingDisable(user)}
                                title={`Disable ${user.username}`}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleEnableUser(user)}
                              title={`Enable ${user.username}`}
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          )}
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
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent
              value="feedback"
              className={cn(
                "flex-1 min-h-0 p-4 mt-0",
                isMacTheme ? "pt-3" : "bg-background"
              )}
            >
              <FeedbackTriageList isMacTheme={isMacTheme} />
            </TabsContent>

            <TabsContent
              value="notifications"
              className={cn(
                "flex-1 min-h-0 p-4 mt-0",
                isMacTheme ? "pt-3" : "bg-background"
              )}
            >
              <NotificationsAdminTab users={users} />
            </TabsContent>
          </Tabs>
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
            if (!open && !isDeletingUser) setPendingDelete(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Delete User"
          description={`Permanently delete "${
            pendingDelete?.username ?? "this user"
          }"? This removes their feedback and team history for good and cannot be undone. To reversibly revoke their access instead, use "Disable."`}
          confirmDisabled={isDeletingUser}
        />

        <ConfirmDialog
          isOpen={pendingDisable !== null}
          onOpenChange={(open) => {
            if (!open && !isTogglingActive) setPendingDisable(null);
          }}
          onConfirm={handleDisableConfirm}
          title="Disable User"
          description={`Disable "${
            pendingDisable?.username ?? "this user"
          }"? They will no longer be able to sign in. Their history is kept.`}
          confirmDisabled={isTogglingActive}
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

// app_context -> human label for the feedback triage list. Values mirror
// FEEDBACK_APP_CONTEXTS in src/lib/api/feedback.ts.
const FEEDBACK_APP_LABELS: Record<FeedbackAppContext, string> = {
  "incoming-offers": "Inbox",
  pitch: "Pitch",
  "active-projects": "Active Projects",
  archive: "Archive",
  general: "General",
};

// status -> badge tone (not in the shared STATUS_TONES map, so passed explicitly).
const FEEDBACK_STATUS_TONES: Record<FeedbackStatus, BadgeTone> = {
  open: "yellow",
  resolved: "green",
};

function formatFeedbackDate(iso: string): string {
  const date = new Date(iso);
  return isNaN(date.getTime()) ? "" : date.toLocaleString();
}

// Admin-only triage list: every submitted bug report / feedback item, newest
// first, with a status dropdown to resolve/reopen. Server enforces admin on the
// list + update endpoints. Rendered inside the Admin Portal's Feedback tab.
function FeedbackTriageList({ isMacTheme }: { isMacTheme: boolean }) {
  const { reports, isLoading, error, fetchReports, updateStatus, clearError } =
    useFeedbackStore();

  useEffect(() => {
    fetchReports().catch((err) => {
      console.error("Failed to fetch feedback:", err);
    });
  }, [fetchReports]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handleStatusChange = async (
    report: FeedbackReport,
    status: FeedbackStatus
  ) => {
    if (status === report.status) return;
    try {
      await updateStatus(report.id, status);
      toast.success(status === "resolved" ? "Marked resolved" : "Reopened");
    } catch {
      // error surfaced via the store error toast
    }
  };

  return (
    <ScrollArea className="h-full [&_[data-radix-scroll-area-viewport]>div]:block!">
      {isLoading && reports.length === 0 ? (
        <EmptyState title="Loading feedback…" className="py-10" />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No feedback yet"
          hint="Bug reports and feedback submitted from the Feedback app show up here."
          className="py-10"
        />
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <div
              key={report.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-md",
                isMacTheme ? "aqua-well" : "border"
              )}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <StatusBadge
                    status={report.app_context}
                    tone="blue"
                    label={
                      FEEDBACK_APP_LABELS[report.app_context] ??
                      report.app_context
                    }
                  />
                  <span className="text-xs text-muted-foreground truncate">
                    {report.submitter_username ||
                      report.submitter_email ||
                      `User ${report.submitter_user_id}`}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {report.message}
                </p>
                <div className="text-[10px] text-muted-foreground">
                  {formatFeedbackDate(report.date_created)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <StatusBadge
                  status={report.status}
                  tone={FEEDBACK_STATUS_TONES[report.status] ?? "gray"}
                  label={report.status === "resolved" ? "Resolved" : "Open"}
                />
                <Select
                  value={report.status}
                  onValueChange={(v) =>
                    handleStatusChange(report, v as FeedbackStatus)
                  }
                >
                  <SelectTrigger className="h-7 w-[110px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
