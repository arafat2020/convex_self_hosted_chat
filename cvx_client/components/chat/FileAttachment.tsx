"use client";

import { Id } from "@/convex/_generated/dataModel";

interface FileAttachmentProps {
  attachment: {
    storageId: Id<"_storage">;
    name: string;
    mimeType: string;
    size: number;
    url: string | null;
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function FileAttachment({ attachment }: FileAttachmentProps) {
  const isImage = attachment.mimeType.startsWith("image/");

  if (!attachment.url) {
    return (
      <div className="message-file">
        <span>📁 {attachment.name}</span>
        <span className="text-xs text-muted">({formatBytes(attachment.size)})</span>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="message-attachment">
        <a href={attachment.url} target="_blank" rel="noopener noreferrer">
          <img
            src={attachment.url}
            alt={attachment.name}
            className="message-image"
            loading="lazy"
          />
        </a>
      </div>
    );
  }

  return (
    <div className="message-attachment">
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        download={attachment.name}
        className="message-file"
      >
        <span style={{ fontSize: 18 }}>📄</span>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            {attachment.name}
          </span>
          <span className="text-xs text-muted">
            {formatBytes(attachment.size)} • Click to download
          </span>
        </div>
      </a>
    </div>
  );
}
