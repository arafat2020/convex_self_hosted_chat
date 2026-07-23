"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useState } from "react";
import { FileAttachment } from "./FileAttachment";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

interface MessageItemProps {
  message: {
    _id: Id<"messages">;
    authorId: Id<"users">;
    body: string;
    attachments: Array<{
      storageId: Id<"_storage">;
      name: string;
      mimeType: string;
      size: number;
      url: string | null;
    }>;
    reactions:
      | Array<{ emoji: string; users: Id<"users">[] }>
      | Record<string, Id<"users">[]>;
    editedAt?: number;
    deletedAt?: number;
    createdAt: number;
    authorProfile: {
      displayName: string;
      profileImageUrl: string | null;
      status?: "online" | "away" | "offline";
    };
  };
  currentUserId: Id<"users">;
  myRole: "admin" | "moderator" | "member";
  showHeader: boolean;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatCompactTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function MessageItem({
  message,
  currentUserId,
  myRole,
  showHeader,
}: MessageItemProps) {
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const editMessage = useMutation(api.messages.editMessage);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(message.body);
  const [showEmoji, setShowEmoji] = useState(false);

  const isAuthor = message.authorId === currentUserId;
  const canDelete = isAuthor || myRole === "admin" || myRole === "moderator";
  const canEdit = isAuthor && !message.deletedAt;

  const reactionList: Array<{ emoji: string; users: Id<"users">[] }> =
    Array.isArray(message.reactions)
      ? message.reactions
      : message.reactions && typeof message.reactions === "object"
      ? Object.entries(
          message.reactions as Record<string, Id<"users">[]>
        ).map(([emoji, users]) => ({ emoji, users }))
      : [];

  const handleDelete = async () => {
    try {
      await deleteMessage({ messageId: message._id });
    } catch (err: any) {
      toast(err?.message ?? "Failed to delete", "error");
    }
  };

  const handleEdit = async () => {
    if (!editBody.trim()) return;
    try {
      await editMessage({ messageId: message._id, body: editBody });
      setEditing(false);
    } catch (err: any) {
      toast(err?.message ?? "Failed to edit", "error");
    }
  };

  const handleReaction = async (emoji: string) => {
    try {
      await toggleReaction({ messageId: message._id, emoji });
      setShowEmoji(false);
    } catch {}
  };

  return (
    <div
      className={`message-item ${showHeader ? "has-header" : "grouped"} ${message.deletedAt ? "deleted" : ""}`}
    >
      {/* Avatar col */}
      <div className="message-avatar">
        {showHeader ? (
          <Avatar
            name={message.authorProfile.displayName}
            src={message.authorProfile.profileImageUrl}
            size="md"
          />
        ) : (
          <span className="compact-timestamp">
            {formatCompactTime(message.createdAt)}
          </span>
        )}
      </div>

      {/* Message body */}
      <div className="message-body">
        {showHeader && (
          <div className="message-author-line">
            <span className="message-author">
              {message.authorProfile.displayName}
            </span>
            <span className="message-timestamp">{formatTime(message.createdAt)}</span>
          </div>
        )}

        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <textarea
              className="form-input"
              style={{ resize: "vertical", minHeight: 60 }}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleEdit();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={handleEdit}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {message.deletedAt ? (
              <span className="message-text deleted-text">
                🗑 This message was deleted
              </span>
            ) : (
              <span className="message-text">
                {message.body}
                {message.editedAt && (
                  <span className="message-edited">(edited)</span>
                )}
              </span>
            )}
          </>
        )}

        {/* Attachments */}
        {!message.deletedAt && message.attachments.length > 0 && (
          <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
            {message.attachments.map((att, i) => (
              <FileAttachment key={i} attachment={att} />
            ))}
          </div>
        )}

        {/* Reactions */}
        {!message.deletedAt && reactionList.length > 0 && (
          <div className="message-reactions">
            {reactionList.map(({ emoji, users }) => (
              <button
                key={emoji}
                className={`reaction-chip ${users.includes(currentUserId) ? "active" : ""}`}
                onClick={() => handleReaction(emoji)}
                title={`${users.length} reaction${users.length > 1 ? "s" : ""}`}
              >
                {emoji} <span>{users.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {!message.deletedAt && !editing && (
        <div
          className={`message-actions ${showEmoji ? "active" : ""}`}
          onMouseLeave={() => setShowEmoji(false)}
        >
          <div style={{ position: "relative" }}>
            <button
              className="msg-action-btn"
              onClick={() => setShowEmoji(!showEmoji)}
              title="Add reaction"
            >
              😊
            </button>
            {showEmoji && (
              <div className="emoji-row">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    className="emoji-btn"
                    onClick={() => handleReaction(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          {canEdit && (
            <button
              className="msg-action-btn"
              onClick={() => { setEditing(true); setEditBody(message.body); }}
              title="Edit message"
            >
              ✏
            </button>
          )}
          {canDelete && (
            <button
              className="msg-action-btn danger"
              onClick={handleDelete}
              title="Delete message"
            >
              🗑
            </button>
          )}
        </div>
      )}
    </div>
  );
}
