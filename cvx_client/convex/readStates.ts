import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Mark a channel as read for the current user.
 */
export const markChannelRead = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const existing = await ctx.db
      .query("channelReadStates")
      .withIndex("by_user_channel", (q) =>
        q.eq("userId", userId).eq("channelId", args.channelId)
      )
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastReadTime: now });
    } else {
      await ctx.db.insert("channelReadStates", {
        userId,
        channelId: args.channelId,
        lastReadTime: now,
      });
    }
  },
});

/**
 * Get unread counts per channel for a given server.
 */
export const getUnreadStatus = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return {};

    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();

    const result: Record<string, { unreadCount: number; hasUnread: boolean }> =
      {};

    await Promise.all(
      channels.map(async (ch) => {
        const readState = await ctx.db
          .query("channelReadStates")
          .withIndex("by_user_channel", (q) =>
            q.eq("userId", userId).eq("channelId", ch._id)
          )
          .unique();

        const lastReadTime = readState?.lastReadTime ?? 0;

        // Query messages newer than lastReadTime
        const unreadMsgs = await ctx.db
          .query("messages")
          .withIndex("by_channel_time", (q) =>
            q.eq("channelId", ch._id).gt("createdAt", lastReadTime)
          )
          .collect();

        // Filter out deleted messages and messages sent by the user themselves
        const unreadCount = unreadMsgs.filter(
          (m) => !m.deletedAt && m.authorId !== userId
        ).length;

        result[ch._id] = {
          unreadCount,
          hasUnread: unreadCount > 0,
        };
      })
    );

    return result;
  },
});

/**
 * Get unread server IDs map for server strip badges.
 */
export const getServersUnreadMap = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return {};

    const memberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const result: Record<string, boolean> = {};

    await Promise.all(
      memberships.map(async (m) => {
        const channels = await ctx.db
          .query("channels")
          .withIndex("by_server", (q) => q.eq("serverId", m.serverId))
          .collect();

        let serverHasUnread = false;

        for (const ch of channels) {
          const readState = await ctx.db
            .query("channelReadStates")
            .withIndex("by_user_channel", (q) =>
              q.eq("userId", userId).eq("channelId", ch._id)
            )
            .unique();

          const lastReadTime = readState?.lastReadTime ?? 0;

          const unreadMsgs = await ctx.db
            .query("messages")
            .withIndex("by_channel_time", (q) =>
              q.eq("channelId", ch._id).gt("createdAt", lastReadTime)
            )
            .collect();

          const count = unreadMsgs.filter(
            (msg) => !msg.deletedAt && msg.authorId !== userId
          ).length;

          if (count > 0) {
            serverHasUnread = true;
            break;
          }
        }

        result[m.serverId] = serverHasUnread;
      })
    );

    return result;
  },
});
