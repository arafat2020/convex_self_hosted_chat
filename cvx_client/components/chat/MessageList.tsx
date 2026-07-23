"use client";

import { usePaginatedQuery, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRef, useEffect } from "react";
import { MessageItem } from "./MessageItem";
import { Spinner } from "@/components/ui/Spinner";

interface MessageListProps {
  channelId: Id<"channels">;
  serverId: Id<"servers">;
  myRole: "admin" | "moderator" | "member";
}

export function MessageList({
  channelId,
  serverId,
  myRole,
}: MessageListProps) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const channel = useQuery(api.channels.getChannel, { channelId });
  const markChannelRead = useMutation(api.readStates.markChannelRead);

  const {
    results: messages,
    status,
    loadMore,
    isLoading,
  } = usePaginatedQuery(
    api.messages.listMessages,
    { channelId },
    { initialNumItems: 50 }
  );

  const listRef = useRef<HTMLDivElement>(null);
  const isBottomRef = useRef(true);

  // Auto-scroll to bottom on new message if user was at bottom & mark read
  useEffect(() => {
    if (isBottomRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    if (messages.length > 0) {
      markChannelRead({ channelId }).catch(() => {});
    }
  }, [messages, channelId, markChannelRead]);

  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    isBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  if (!currentUser) return null;

  return (
    <div
      ref={listRef}
      className="message-list"
      onScroll={handleScroll}
      id="message-list-container"
    >
      {/* Load More Button */}
      {status === "CanLoadMore" && (
        <button
          className="load-more-btn"
          onClick={() => loadMore(30)}
          disabled={isLoading}
        >
          {isLoading ? <Spinner size="sm" /> : "Load older messages"}
        </button>
      )}

      {/* Channel Welcome Banner */}
      {status === "Exhausted" && (
        <div className="channel-welcome">
          <div className="channel-welcome-hash">#</div>
          <h2>Welcome to #{channel?.name ?? "channel"}!</h2>
          <p>
            {channel?.topic
              ? channel.topic
              : `This is the start of the #${channel?.name ?? "channel"} channel.`}
          </p>
        </div>
      )}

      {/* Messages */}
      {messages.map((msg, index) => {
        const prevMsg = messages[index - 1];
        const isSameAuthor =
          prevMsg &&
          prevMsg.authorId === msg.authorId &&
          msg.createdAt - prevMsg.createdAt < 5 * 60 * 1000 && // 5 mins
          !prevMsg.deletedAt;

        return (
          <MessageItem
            key={msg._id}
            message={msg as any}
            currentUserId={currentUser._id}
            myRole={myRole}
            showHeader={!isSameAuthor}
          />
        );
      })}
    </div>
  );
}
