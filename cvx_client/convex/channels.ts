import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * List all channels in a server (must be a member).
 */
export const listChannels = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", userId)
      )
      .unique();

    if (!membership) return [];

    return await ctx.db
      .query("channels")
      .withIndex("by_server_position", (q) => q.eq("serverId", args.serverId))
      .collect();
  },
});

/**
 * Create a channel (admin only).
 */
export const createChannel = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", userId)
      )
      .unique();

    if (!membership || membership.role !== "admin")
      throw new Error("Only admins can create channels");

    // Get max position
    const existing = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();

    const maxPosition =
      existing.length > 0
        ? Math.max(...existing.map((c) => c.position))
        : -1;

    return await ctx.db.insert("channels", {
      serverId: args.serverId,
      name: args.name.toLowerCase().replace(/\s+/g, "-"),
      topic: args.topic,
      type: "text",
      createdBy: userId,
      position: maxPosition + 1,
      createdAt: Date.now(),
    });
  },
});

/**
 * Update channel name/topic (admin only).
 */
export const updateChannel = mutation({
  args: {
    channelId: v.id("channels"),
    name: v.optional(v.string()),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");

    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", channel.serverId).eq("userId", userId)
      )
      .unique();

    if (!membership || membership.role !== "admin")
      throw new Error("Only admins can update channels");

    await ctx.db.patch(args.channelId, {
      ...(args.name !== undefined && {
        name: args.name.toLowerCase().replace(/\s+/g, "-"),
      }),
      ...(args.topic !== undefined && { topic: args.topic }),
    });
  },
});

/**
 * Delete a channel (admin only). Cannot delete last channel.
 */
export const deleteChannel = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");

    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", channel.serverId).eq("userId", userId)
      )
      .unique();

    if (!membership || membership.role !== "admin")
      throw new Error("Only admins can delete channels");

    const allChannels = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", channel.serverId))
      .collect();

    if (allChannels.length <= 1)
      throw new Error("Cannot delete the last channel");

    await ctx.db.delete(args.channelId);
  },
});

/**
 * Get a single channel (must be a member of the server).
 */
export const getChannel = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const channel = await ctx.db.get(args.channelId);
    if (!channel) return null;

    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", channel.serverId).eq("userId", userId)
      )
      .unique();

    if (!membership) return null;

    return channel;
  },
});
