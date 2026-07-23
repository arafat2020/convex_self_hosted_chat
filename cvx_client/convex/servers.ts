import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * Create a new server. The creator automatically becomes admin.
 */
export const createServer = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    iconImageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const serverId = await ctx.db.insert("servers", {
      name: args.name,
      description: args.description,
      iconImageId: args.iconImageId,
      ownerId: userId,
      inviteCode: generateInviteCode(),
      createdAt: Date.now(),
    });

    // Creator is admin
    await ctx.db.insert("serverMembers", {
      serverId,
      userId,
      role: "admin",
      joinedAt: Date.now(),
    });

    // Create a default #general channel
    await ctx.db.insert("channels", {
      serverId,
      name: "general",
      topic: "General discussion",
      type: "text",
      createdBy: userId,
      position: 0,
      createdAt: Date.now(),
    });

    return serverId;
  },
});

/**
 * Get a server by ID (must be a member to see it).
 */
export const getServer = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", userId)
      )
      .unique();

    if (!membership) return null;

    const server = await ctx.db.get(args.serverId);
    if (!server) return null;

    let iconUrl: string | null = null;
    if (server.iconImageId) {
      iconUrl = await ctx.storage.getUrl(server.iconImageId);
    }

    return { ...server, iconUrl, myRole: membership.role };
  },
});

/**
 * List all servers the current user is a member of.
 */
export const listServers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const servers = await Promise.all(
      memberships.map(async (m) => {
        const server = await ctx.db.get(m.serverId);
        if (!server) return null;
        let iconUrl: string | null = null;
        if (server.iconImageId) {
          iconUrl = await ctx.storage.getUrl(server.iconImageId);
        }
        return { ...server, iconUrl, myRole: m.role };
      })
    );

    return servers.filter(Boolean);
  },
});

/**
 * Join a server by invite code.
 */
export const joinByInvite = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const server = await ctx.db
      .query("servers")
      .withIndex("by_inviteCode", (q) =>
        q.eq("inviteCode", args.inviteCode.toUpperCase())
      )
      .unique();

    if (!server) throw new Error("Invalid invite code");

    // Check already member
    const existing = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", server._id).eq("userId", userId)
      )
      .unique();

    if (existing) return server._id;

    await ctx.db.insert("serverMembers", {
      serverId: server._id,
      userId,
      role: "member",
      joinedAt: Date.now(),
    });

    return server._id;
  },
});

/**
 * Update server details (admin only).
 */
export const updateServer = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    iconImageId: v.optional(v.id("_storage")),
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
      throw new Error("Only admins can update the server");

    const { serverId, ...updates } = args;
    await ctx.db.patch(serverId, {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && {
        description: updates.description,
      }),
      ...(updates.iconImageId !== undefined && {
        iconImageId: updates.iconImageId,
      }),
    });
  },
});

/**
 * Regenerate invite code (admin only).
 */
export const regenerateInviteCode = mutation({
  args: { serverId: v.id("servers") },
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
      throw new Error("Only admins can regenerate invite code");

    const newCode = generateInviteCode();
    await ctx.db.patch(args.serverId, { inviteCode: newCode });
    return newCode;
  },
});

/**
 * Generate upload URL for server icon.
 */
export const generateServerIconUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});
