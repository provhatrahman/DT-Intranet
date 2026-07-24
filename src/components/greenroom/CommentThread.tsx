import { useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useOsTheme } from "@/hooks/useOsTheme";
import { cn } from "@/lib/utils";

// Structural shape both PitchComment (src/lib/api/pitches.ts) and
// BookingComment (src/lib/api/bookings.ts) satisfy, so this component stays
// backend-agnostic — the Inbox routes by offer.source and passes whichever
// shape applies.
export interface ThreadComment {
  id: number;
  user_id: number;
  username: string;
  comment: string;
  parent_comment_id: number | null;
  date_created: string;
  date_last_updated?: string | null;
}

interface CommentThreadProps {
  // Callers pre-filter to public comments (comment_type === "public") before
  // passing them in — this component has no opinion on comment_type.
  comments: ThreadComment[];
  currentUserId: number | null;
  // Admins can delete anyone's comment (moderation); non-admins only their
  // own. Editing stays author-only regardless.
  isAdmin?: boolean;
  onPost: (text: string, parentCommentId: number | null) => Promise<void>;
  onEdit: (commentId: number, text: string) => Promise<void>;
  onRequestDelete: (commentId: number) => void;
  className?: string;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} ${date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function wasEdited(comment: ThreadComment): boolean {
  if (!comment.date_last_updated) return false;
  const updated = new Date(comment.date_last_updated).getTime();
  const created = new Date(comment.date_created).getTime();
  return !isNaN(updated) && !isNaN(created) && updated > created;
}

/**
 * Reusable public/threaded comment section — one level of replies, edit/
 * delete on own comments only. Lives inside a card (Inbox offer/pitch cards),
 * so styling stays compact. No toasts here: containers own toast feedback per
 * house convention; failed submits keep the draft so the user can retry.
 */
export function CommentThread({
  comments,
  currentUserId,
  isAdmin = false,
  onPost,
  onEdit,
  onRequestDelete,
  className,
}: CommentThreadProps) {
  const { isMacTheme } = useOsTheme();
  const canInteract = currentUserId != null;

  const [draft, setDraft] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  // Only one reply box open at a time, across all top-level rows.
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  // Only one inline edit open at a time, across all rows (top-level + reply).
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const { topLevel, repliesByParent } = useMemo(() => {
    const byDateAsc = (a: ThreadComment, b: ThreadComment) =>
      new Date(a.date_created).getTime() - new Date(b.date_created).getTime();

    const top = comments
      .filter((c) => c.parent_comment_id === null)
      .sort(byDateAsc);

    const byParent = new Map<number, ThreadComment[]>();
    comments
      .filter((c) => c.parent_comment_id !== null)
      .forEach((c) => {
        const parentId = c.parent_comment_id as number;
        const list = byParent.get(parentId) ?? [];
        list.push(c);
        byParent.set(parentId, list);
      });
    byParent.forEach((list) => list.sort(byDateAsc));

    return { topLevel: top, repliesByParent: byParent };
  }, [comments]);

  const bubbleClass = cn(
    "rounded-md text-xs p-2.5",
    isMacTheme ? "aqua-well" : "bg-muted/50"
  );

  const startEdit = (comment: ThreadComment) => {
    setEditingId(comment.id);
    setEditDraft(comment.comment);
    setReplyingToId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = async (commentId: number) => {
    const text = editDraft.trim();
    if (!text || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await onEdit(commentId, text);
      setEditingId(null);
      setEditDraft("");
    } catch {
      // Keep the draft on failure so the user can retry; the container
      // surfaces the error toast.
    } finally {
      setIsSavingEdit(false);
    }
  };

  const startReply = (parentId: number) => {
    setReplyingToId(parentId);
    setReplyDraft("");
    setEditingId(null);
  };

  const cancelReply = () => {
    setReplyingToId(null);
    setReplyDraft("");
  };

  const submitReply = async (parentId: number) => {
    const text = replyDraft.trim();
    if (!text || isReplying) return;
    setIsReplying(true);
    try {
      await onPost(text, parentId);
      setReplyingToId(null);
      setReplyDraft("");
    } catch {
      // Keep the draft on failure.
    } finally {
      setIsReplying(false);
    }
  };

  const submitTopLevel = async () => {
    const text = draft.trim();
    if (!text || isPosting || !canInteract) return;
    setIsPosting(true);
    try {
      await onPost(text, null);
      setDraft("");
    } catch {
      // Keep the draft on failure.
    } finally {
      setIsPosting(false);
    }
  };

  // Render function, NOT a nested component: defining a component inside
  // CommentThread would give it a new identity every render, remounting the
  // edit Textarea (and dropping focus) on each keystroke.
  const renderCommentRow = (comment: ThreadComment, isReply: boolean) => {
    const isOwn = currentUserId != null && comment.user_id === currentUserId;
    // Author can edit + delete their own; an admin can also delete (moderate)
    // anyone's comment, but not edit someone else's.
    const canDelete = isOwn || isAdmin;
    const isEditingThis = editingId === comment.id;

    return (
      <div className={bubbleClass}>
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <span className="font-medium">{comment.username}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatTimestamp(comment.date_created)}
            {wasEdited(comment) && " (edited)"}
          </span>
        </div>
        {isEditingThis ? (
          <div className="space-y-1.5">
            <Textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              className="text-xs min-h-14"
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelEdit}
                className="h-6 text-[11px] px-2"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={isMacTheme ? "default" : "outline"}
                size="sm"
                onClick={() => saveEdit(comment.id)}
                disabled={isSavingEdit || !editDraft.trim()}
                className="h-6 text-[11px] px-2"
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="whitespace-pre-wrap break-words">
              {comment.comment}
            </div>
            <div className="flex items-center gap-2.5 mt-1">
              {!isReply && (
                <button
                  type="button"
                  onClick={() => startReply(comment.id)}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline touch-manipulation"
                >
                  Reply
                </button>
              )}
              {isOwn && (
                <button
                  type="button"
                  onClick={() => startEdit(comment)}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline touch-manipulation"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(comment.id)}
                  className="text-[10px] text-muted-foreground hover:text-destructive underline-offset-2 hover:underline touch-manipulation"
                >
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-2.5", className)}>
      {topLevel.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No comments yet — start the discussion below.
        </p>
      ) : (
        <div className="space-y-2.5">
          {topLevel.map((comment) => {
            const replies = repliesByParent.get(comment.id) ?? [];
            return (
              <div key={comment.id} className="space-y-1.5">
                {renderCommentRow(comment, false)}
                {replies.length > 0 && (
                  <div className="ml-3 pl-3 space-y-1.5 border-l border-black/10 dark:border-white/10">
                    {replies.map((reply) => (
                      <div key={reply.id}>{renderCommentRow(reply, true)}</div>
                    ))}
                  </div>
                )}
                {replyingToId === comment.id && (
                  <div className="ml-3 pl-3 space-y-1.5">
                    <Textarea
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder={`Reply to ${comment.username}...`}
                      className="text-xs min-h-14"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelReply}
                        className="h-6 text-[11px] px-2"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant={isMacTheme ? "default" : "outline"}
                        size="sm"
                        onClick={() => submitReply(comment.id)}
                        disabled={isReplying || !replyDraft.trim()}
                        className="h-6 text-[11px] px-2"
                      >
                        Reply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5 pt-1">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!canInteract}
          placeholder={
            canInteract
              ? "Add a comment..."
              : "Set up your Greenroom account to comment"
          }
          className="text-xs min-h-14"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            variant={isMacTheme ? "default" : "outline"}
            size="sm"
            onClick={submitTopLevel}
            disabled={!canInteract || isPosting || !draft.trim()}
            className="h-7 text-xs px-3"
          >
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}
