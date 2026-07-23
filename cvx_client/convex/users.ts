import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the current authenticated user with their profile.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    let profileImageUrl: string | null = null;
    if (profile?.profileImageId) {
      profileImageUrl = await ctx.storage.getUrl(profile.profileImageId);
    }

    const fallbackName =
      (user as any).name || (user as any).email?.split("@")[0] || "User";

    const effectiveProfile = profile ?? {
      _id: userId as any,
      _creationTime: user._creationTime,
      userId,
      name: fallbackName,
      displayName: fallbackName,
      status: "online" as const,
      createdAt: user._creationTime,
    };

    return { ...user, profile: effectiveProfile, profileImageUrl };
  },
});

/**
 * Get or create a user profile (called after sign-up).
 */
export const ensureProfile = mutation({
  args: {
    name: v.optional(v.string()),
    displayName: v.optional(v.string()),
    profileImageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    const fallbackName =
      args.name ||
      args.displayName ||
      (user as any).name ||
      (user as any).email?.split("@")[0] ||
      "User";

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: fallbackName,
        displayName: args.displayName || existing.displayName || fallbackName,
        ...(args.profileImageId && { profileImageId: args.profileImageId }),
      });
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", {
      userId,
      name: fallbackName,
      displayName: args.displayName || fallbackName,
      profileImageId: args.profileImageId,
      status: "online",
      createdAt: Date.now(),
    });
  },
});

/**
 * Update profile (name, displayName, bio, profileImageId).
 */
export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    profileImageId: v.optional(v.id("_storage")),
    status: v.optional(
      v.union(v.literal("online"), v.literal("away"), v.literal("offline"))
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      ...(args.displayName !== undefined && { displayName: args.displayName }),
      ...(args.bio !== undefined && { bio: args.bio }),
      ...(args.profileImageId !== undefined && {
        profileImageId: args.profileImageId,
      }),
      ...(args.status !== undefined && { status: args.status }),
    });
  },
});

/**
 * Set user status (online / away / offline).
 */
export const setStatus = mutation({
  args: {
    status: v.union(v.literal("online"), v.literal("away"), v.literal("offline")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (profile) {
      await ctx.db.patch(profile._id, { status: args.status });
    }
  },
});

/**
 * Generate an upload URL for profile picture.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get a user profile by userId (for display in member list, messages, etc.)
 */
export const getUserProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) return null;

    let profileImageUrl: string | null = null;
    if (profile.profileImageId) {
      profileImageUrl = await ctx.storage.getUrl(profile.profileImageId);
    }

    return { ...profile, profileImageUrl };
  },
});
