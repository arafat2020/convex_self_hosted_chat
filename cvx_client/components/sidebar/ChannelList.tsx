"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface ChannelListProps {
  serverId: Id<"servers">;
  activeChannelId: Id<"channels"> | null;
  onSelectChannel: (id: Id<"channels">) => void;
  myRole: "admin" | "moderator" | "member";
  onOpenControlPanel: () => void;
}

export function ChannelList({
  serverId,
  activeChannelId,
  onSelectChannel,
  myRole,
  onOpenControlPanel,
}: ChannelListProps) {
  const server = useQuery(api.servers.getServer, { serverId });
  const channels = useQuery(api.channels.listChannels, { serverId }) ?? [];
  const unreadMap = useQuery(api.readStates.getUnreadStatus, { serverId }) ?? {};

  return (
    <>
      {/* Server header */}
      <div className="sidebar-header">
        <h2>{server?.name ?? "…"}</h2>
        {(myRole === "admin" || myRole === "moderator") && (
          <button
            id="btn-open-control-panel"
            className="btn btn-ghost btn-icon"
            onClick={onOpenControlPanel}
            title="Server settings"
            style={{ fontSize: 18, flexShrink: 0 }}
          >
            ⚙
          </button>
        )}
      </div>

      {/* Channel list */}
      <div className="channel-section" style={{ flex: 1, overflowY: "auto" }}>
        <div className="channel-section-label">
          <span>Text Channels</span>
          {myRole === "admin" && (
            <span
              id="btn-add-channel-hint"
              style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 18, fontWeight: 400 }}
              onClick={onOpenControlPanel}
              title="Add channel (in settings)"
            >
              +
            </span>
          )}
        </div>

        {channels.length === 0 && (
          <div className="text-muted text-sm" style={{ padding: "8px 8px" }}>
            No channels yet
          </div>
        )}

        {channels.map((ch) => {
          const unreadInfo = unreadMap[ch._id];
          const hasUnread = Boolean(unreadInfo?.hasUnread && activeChannelId !== ch._id);
          const unreadCount = unreadInfo?.unreadCount ?? 0;

          return (
            <div
              key={ch._id}
              id={`channel-item-${ch._id}`}
              className={`channel-item ${activeChannelId === ch._id ? "active" : ""} ${hasUnread ? "unread" : ""}`}
              onClick={() => onSelectChannel(ch._id)}
            >
              <span className="channel-hash">#</span>
              <span className="truncate" style={{ flex: 1 }}>{ch.name}</span>
              {hasUnread && unreadCount > 0 && (
                <span className="channel-unread-badge">{unreadCount}</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
