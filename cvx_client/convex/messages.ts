import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Id } from "./_generated/dataModel";

const attachmentValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  mimeType: v.string(),
  size: v.number(),
});

/**
 * List messages in a channel (paginated, newest last).
 */
export const listMessages = query({
  args: {
    channelId: v.id("channels"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: "" };

    const channel = await ctx.db.get(args.channelId);
    if (!channel) return { page: [], isDone: true, continueCursor: "" };

    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", channel.serverId).eq("userId", userId)
      )
      .unique();
    if (!membership) return { page: [], isDone: true, continueCursor: "" };

    const result = await ctx.db
      .query("messages")
      .withIndex("by_channel_time", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Resolve author profiles and attachment URLs
    const enriched = await Promise.all(
      result.page.map(async (msg) => {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", msg.authorId))
          .unique();

        const user = await ctx.db.get(msg.authorId);

        let profileImageUrl: string | null = null;
        if (profile?.profileImageId) {
          profileImageUrl = await ctx.storage.getUrl(profile.profileImageId);
        }

        const attachmentsWithUrls = await Promise.all(
          msg.attachments.map(async (att) => ({
            ...att,
            url: await ctx.storage.getUrl(att.storageId),
          }))
        );

        const name =
          profile?.displayName ||
          profile?.name ||
          (user as any)?.name ||
          (user as any)?.email?.split("@")[0] ||
          (user ? "User" : "Deleted User");

        return {
          ...msg,
          authorProfile: {
            displayName: name,
            name,
            profileImageUrl,
            status: profile?.status ?? ("online" as const),
          },
          attachments: attachmentsWithUrls,
        };
      })
    );

    return { ...result, page: enriched.reverse() };
  },
});

/**
 * Send a message to a channel.
 */
export const sendMessage = mutation({
  args: {
    channelId: v.id("channels"),
    body: v.string(),
    attachments: v.optional(v.array(attachmentValidator)),
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

    if (!membership) throw new Error("Not a member of this server");

    // Check mute
    if (membership.mutedUntil && membership.mutedUntil > Date.now())
      throw new Error("You are muted");

    if (!args.body.trim() && (!args.attachments || args.attachments.length === 0))
      throw new Error("Message cannot be empty");

    return await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: userId,
      body: args.body,
      attachments: args.attachments ?? [],
      reactions: [],
      createdAt: Date.now(),
    });
  },
});

/**
 * Edit a message (author only).
 */
export const editMessage = mutation({
  args: {
    messageId: v.id("messages"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.authorId !== userId) throw new Error("Cannot edit others' messages");
    if (message.deletedAt) throw new Error("Cannot edit deleted message");

    await ctx.db.patch(args.messageId, {
      body: args.body,
      editedAt: Date.now(),
    });
  },
});

/**
 * Delete a message. Authors can delete their own; admin/mod can delete any.
 */
export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    const channel = await ctx.db.get(message.channelId);
    if (!channel) throw new Error("Channel not found");

    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", channel.serverId).eq("userId", userId)
      )
      .unique();

    const isAuthor = message.authorId === userId;
    const isAdminOrMod =
      membership?.role === "admin" || membership?.role === "moderator";

    if (!isAuthor && !isAdminOrMod)
      throw new Error("Insufficient permissions to delete this message");

    await ctx.db.patch(args.messageId, { deletedAt: Date.now() });
  },
});

/**
 * Toggle an emoji reaction on a message.
 */
export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message || message.deletedAt) throw new Error("Message not found");

    let currentReactions: Array<{ emoji: string; users: Id<"users">[] }> = [];
    if (Array.isArray(message.reactions)) {
      currentReactions = [...message.reactions];
    } else if (message.reactions && typeof message.reactions === "object") {
      currentReactions = Object.entries(
        message.reactions as Record<string, Id<"users">[]>
      ).map(([emoji, users]) => ({ emoji, users }));
    }

    const existingIndex = currentReactions.findIndex(
      (r) => r.emoji === args.emoji
    );

    if (existingIndex >= 0) {
      const existing = currentReactions[existingIndex]!;
      if (existing.users.includes(userId)) {
        const updatedUsers = existing.users.filter((id) => id !== userId);
        if (updatedUsers.length === 0) {
          currentReactions.splice(existingIndex, 1);
        } else {
          currentReactions[existingIndex] = {
            ...existing,
            users: updatedUsers,
          };
        }
      } else {
        currentReactions[existingIndex] = {
          ...existing,
          users: [...existing.users, userId],
        };
      }
    } else {
      currentReactions.push({
        emoji: args.emoji,
        users: [userId],
      });
    }

    await ctx.db.patch(args.messageId, { reactions: currentReactions });
  },
});

/**
 * Generate an upload URL for message attachments.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});
