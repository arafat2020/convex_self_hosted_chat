"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";

interface MessageInputProps {
  channelId: Id<"channels">;
  channelName: string;
  serverId: Id<"servers">;
}

interface PendingAttachment {
  file: File;
  previewUrl?: string;
}

export function MessageInput({
  channelId,
  channelName,
  serverId,
}: MessageInputProps) {
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const sendMessage = useMutation(api.messages.sendMessage);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const membership = useQuery(api.members.getMyMembership, { serverId });
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMuted =
    membership?.mutedUntil && membership.mutedUntil > Date.now();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const newPending: PendingAttachment[] = files.map((file) => {
      if (file.type.startsWith("image/")) {
        return { file, previewUrl: URL.createObjectURL(file) };
      }
      return { file };
    });

    setPendingFiles((prev) => [...prev, ...newPending]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSend = async () => {
    if ((!body.trim() && pendingFiles.length === 0) || uploading || isMuted)
      return;

    setUploading(true);

    try {
      const attachments = [];

      for (const pending of pendingFiles) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": pending.file.type || "application/octet-stream" },
          body: pending.file,
        });

        if (!res.ok) throw new Error(`Failed to upload ${pending.file.name}`);

        const { storageId } = await res.json();
        attachments.push({
          storageId,
          name: pending.file.name,
          mimeType: pending.file.type || "application/octet-stream",
          size: pending.file.size,
        });
      }

      await sendMessage({
        channelId,
        body: body.trim(),
        attachments,
      });

      setBody("");
      pendingFiles.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      setPendingFiles([]);
    } catch (err: any) {
      toast(err?.message ?? "Failed to send message", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isMuted) {
    return (
      <div className="message-input-area">
        <div className="message-input-box" style={{ justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
          🔇 You are muted in this server.
        </div>
      </div>
    );
  }

  return (
    <div className="message-input-area">
      {/* File Previews */}
      {pendingFiles.length > 0 && (
        <div className="attachments-preview">
          {pendingFiles.map((p, idx) => (
            <div key={idx} className="attachment-preview-item">
              {p.previewUrl ? (
                <img src={p.previewUrl} alt={p.file.name} />
              ) : (
                <div className="attachment-file-chip">
                  📄 <span>{p.file.name}</span>
                </div>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => removePendingFile(idx)}
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 20,
                  height: 20,
                  fontSize: 12,
                  background: "rgba(0,0,0,0.6)",
                  borderRadius: "50%",
                  color: "#fff",
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="message-input-box">
        <button
          type="button"
          className="input-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Upload file or image"
          disabled={uploading}
        >
          📎
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        <textarea
          className="message-textarea"
          placeholder={`Message #${channelName}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={uploading}
        />

        <button
          type="button"
          className="input-btn send"
          onClick={handleSend}
          disabled={uploading || (!body.trim() && pendingFiles.length === 0)}
          title="Send message"
        >
          {uploading ? <Spinner size="sm" /> : "➤"}
        </button>
      </div>
    </div>
  );
}
