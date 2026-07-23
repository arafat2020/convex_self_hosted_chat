import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { roleValidator } from "./schema";

/**
 * List all members of a server with their profiles.
 */
export const listMembers = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Check caller is a member
    const callerMembership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", userId)
      )
      .unique();
    if (!callerMembership) return [];

    const memberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", m.userId))
          .unique();

        const user = await ctx.db.get(m.userId);

        let profileImageUrl: string | null = null;
        if (profile?.profileImageId) {
          profileImageUrl = await ctx.storage.getUrl(profile.profileImageId);
        }

        const name =
          profile?.displayName ||
          profile?.name ||
          (user as any)?.name ||
          (user as any)?.email?.split("@")[0] ||
          "Member";

        return {
          ...m,
          profile: {
            userId: m.userId,
            displayName: name,
            name,
            status: profile?.status ?? ("online" as const),
            profileImageUrl,
          },
        };
      })
    );

    return members;
  },
});

/**
 * Update a member's role (admin only).
 */
export const updateRole = mutation({
  args: {
    serverId: v.id("servers"),
    targetUserId: v.id("users"),
    newRole: roleValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const callerMembership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", userId)
      )
      .unique();

    if (!callerMembership || callerMembership.role !== "admin")
      throw new Error("Only admins can change roles");

    const server = await ctx.db.get(args.serverId);
    if (server?.ownerId === args.targetUserId)
      throw new Error("Cannot change the owner's role");

    const targetMembership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", args.targetUserId)
      )
      .unique();

    if (!targetMembership) throw new Error("User is not a member");

    await ctx.db.patch(targetMembership._id, { role: args.newRole });
  },
});

/**
 * Kick a member from the server (admin or moderator).
 */
export const kickMember = mutation({
  args: {
    serverId: v.id("servers"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const callerMembership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", userId)
      )
      .unique();

    if (
      !callerMembership ||
      (callerMembership.role !== "admin" &&
        callerMembership.role !== "moderator")
    )
      throw new Error("Insufficient permissions");

    const server = await ctx.db.get(args.serverId);
    if (server?.ownerId === args.targetUserId)
      throw new Error("Cannot kick the server owner");

    const targetMembership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", args.targetUserId)
      )
      .unique();

    if (!targetMembership) throw new Error("User is not a member");

    // Moderators can't kick admins
    if (
      callerMembership.role === "moderator" &&
      targetMembership.role === "admin"
    )
      throw new Error("Moderators cannot kick admins");

    await ctx.db.delete(targetMembership._id);
  },
});

/**
 * Mute a member until a specific timestamp (admin or moderator).
 */
export const muteMember = mutation({
  args: {
    serverId: v.id("servers"),
    targetUserId: v.id("users"),
    mutedUntil: v.optional(v.number()), // undefined = unmute
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const callerMembership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", userId)
      )
      .unique();

    if (
      !callerMembership ||
      (callerMembership.role !== "admin" &&
        callerMembership.role !== "moderator")
    )
      throw new Error("Insufficient permissions");

    const targetMembership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", args.targetUserId)
      )
      .unique();

    if (!targetMembership) throw new Error("User is not a member");

    await ctx.db.patch(targetMembership._id, {
      mutedUntil: args.mutedUntil,
    });
  },
});

/**
 * Get the caller's membership/role in a server.
 */
export const getMyMembership = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", userId)
      )
      .unique();
  },
});
