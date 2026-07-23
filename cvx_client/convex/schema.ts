import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const roleValidator = v.union(
  v.literal("admin"),
  v.literal("moderator"),
  v.literal("member")
);

const schema = defineSchema({
  ...authTables,

  // Extended user profiles (linked to auth users table)
  userProfiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    displayName: v.string(),
    profileImageId: v.optional(v.id("_storage")),
    bio: v.optional(v.string()),
    status: v.union(v.literal("online"), v.literal("away"), v.literal("offline")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"]),

  // Servers (workspaces)
  servers: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    iconImageId: v.optional(v.id("_storage")),
    ownerId: v.id("users"),
    inviteCode: v.string(),
    createdAt: v.number(),
  })
    .index("by_inviteCode", ["inviteCode"])
    .index("by_owner", ["ownerId"]),

  // Server membership (role per server)
  serverMembers: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    role: roleValidator,
    mutedUntil: v.optional(v.number()),
    joinedAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"])
    .index("by_server_user", ["serverId", "userId"]),

  // Channels inside a server
  channels: defineTable({
    serverId: v.id("servers"),
    name: v.string(),
    topic: v.optional(v.string()),
    type: v.literal("text"),
    createdBy: v.id("users"),
    position: v.number(),
    createdAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_server_position", ["serverId", "position"]),

  // Messages inside a channel
  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    body: v.string(),
    attachments: v.array(
      v.object({
        storageId: v.id("_storage"),
        name: v.string(),
        mimeType: v.string(),
        size: v.number(),
      })
    ),
    reactions: v.union(
      v.array(
        v.object({
          emoji: v.string(),
          users: v.array(v.id("users")),
        })
      ),
      v.record(v.string(), v.array(v.id("users")))
    ),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_channel_time", ["channelId", "createdAt"]),

  // Unread message tracking per user and channel
  channelReadStates: defineTable({
    userId: v.id("users"),
    channelId: v.id("channels"),
    lastReadTime: v.number(),
  })
    .index("by_user_channel", ["userId", "channelId"])
    .index("by_user", ["userId"]),
});

export default schema;
