"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/ui/Avatar";
import { RoleBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

interface MemberManagerProps {
  serverId: Id<"servers">;
  myRole: "admin" | "moderator" | "member";
}

type Role = "admin" | "moderator" | "member";

export function MemberManager({ serverId, myRole }: MemberManagerProps) {
  const members = useQuery(api.members.listMembers, { serverId }) ?? [];
  const server = useQuery(api.servers.getServer, { serverId });
  const currentUser = useQuery(api.users.getCurrentUser);

  const updateRole = useMutation(api.members.updateRole);
  const kickMember = useMutation(api.members.kickMember);
  const muteMember = useMutation(api.members.muteMember);
  const { toast } = useToast();

  const handleRoleChange = async (targetUserId: Id<"users">, newRole: Role) => {
    try {
      await updateRole({ serverId, targetUserId, newRole });
      toast("Role updated", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to update role", "error");
    }
  };

  const handleKick = async (targetUserId: Id<"users">, name: string) => {
    if (!confirm(`Are you sure you want to kick ${name}?`)) return;
    try {
      await kickMember({ serverId, targetUserId });
      toast(`${name} was kicked from the server`, "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to kick member", "error");
    }
  };

  const handleMute = async (
    targetUserId: Id<"users">,
    name: string,
    currentlyMuted: boolean
  ) => {
    try {
      if (currentlyMuted) {
        await muteMember({ serverId, targetUserId, mutedUntil: undefined });
        toast(`${name} was unmuted`, "success");
      } else {
        // Mute for 1 hour default
        const mutedUntil = Date.now() + 60 * 60 * 1000;
        await muteMember({ serverId, targetUserId, mutedUntil });
        toast(`${name} was muted for 1 hour`, "success");
      }
    } catch (err: any) {
      toast(err?.message ?? "Failed to mute/unmute member", "error");
    }
  };

  const isMuted = (mutedUntil?: number) =>
    mutedUntil !== undefined && mutedUntil > Date.now();

  return (
    <div className="flex flex-col gap-3">
      <div className="form-label">Server Members ({members.length})</div>

      <div className="flex flex-col gap-2">
        {members.map((m) => {
          const isOwner = server?.ownerId === m.userId;
          const isSelf = currentUser?._id === m.userId;
          const muted = isMuted(m.mutedUntil);

          return (
            <div
              key={m._id}
              className="flex items-center justify-between"
              style={{
                padding: "10px 12px",
                background: "var(--bg-900)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
              }}
            >
              {/* Member Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar
                  name={m.profile.displayName}
                  src={m.profile.profileImageUrl}
                  size="md"
                  status={m.profile.status as "online" | "away" | "offline"}
                  showStatus
                />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm truncate">
                      {m.profile.displayName}
                    </span>
                    {isOwner && (
                      <span title="Server Owner" style={{ fontSize: 12 }}>👑</span>
                    )}
                    <RoleBadge role={m.role} />
                  </div>
                  <span className="text-xs text-muted">
                    Joined {new Date(m.joinedAt).toLocaleDateString()}
                    {muted && " • Muted"}
                  </span>
                </div>
              </div>

              {/* Actions */}
              {!isOwner && !isSelf && (
                <div className="flex items-center gap-2">
                  {/* Role Selector (Admin only) */}
                  {myRole === "admin" && (
                    <select
                      className="form-select"
                      style={{ width: "auto", padding: "4px 28px 4px 8px", fontSize: 12 }}
                      value={m.role}
                      onChange={(e) =>
                        handleRoleChange(m.userId, e.target.value as Role)
                      }
                    >
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}

                  {/* Mute/Unmute */}
                  <button
                    className={`btn btn-sm ${muted ? "btn-primary" : "btn-ghost"}`}
                    onClick={() =>
                      handleMute(m.userId, m.profile.displayName, muted)
                    }
                    title={muted ? "Unmute member" : "Mute for 1 hour"}
                  >
                    {muted ? "🔊 Unmute" : "🔇 Mute"}
                  </button>

                  {/* Kick */}
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleKick(m.userId, m.profile.displayName)}
                    title="Kick member"
                  >
                    Kick
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
