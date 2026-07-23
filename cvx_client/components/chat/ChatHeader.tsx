"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface ChatHeaderProps {
  channelId: Id<"channels">;
  serverId: Id<"servers">;
  onToggleMembers: () => void;
  membersVisible: boolean;
}

export function ChatHeader({
  channelId,
  serverId,
  onToggleMembers,
  membersVisible,
}: ChatHeaderProps) {
  const channel = useQuery(api.channels.getChannel, { channelId });

  return (
    <div className="chat-header">
      <span style={{ fontSize: 20, color: "var(--text-muted)" }}>#</span>
      <span className="chat-header-channel">{channel?.name ?? "…"}</span>
      {channel?.topic && (
        <span className="chat-header-topic">{channel.topic}</span>
      )}
      <button
        id="btn-toggle-members"
        className="btn btn-ghost btn-icon"
        onClick={onToggleMembers}
        title={membersVisible ? "Hide members" : "Show members"}
        style={{ marginLeft: "auto", fontSize: 18 }}
      >
        👥
      </button>
    </div>
  );
}
