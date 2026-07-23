"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/ui/Avatar";
import { RoleBadge } from "@/components/ui/Badge";

interface MemberListProps {
  serverId: Id<"servers">;
}

type Role = "admin" | "moderator" | "member";

const ROLE_ORDER: Role[] = ["admin", "moderator", "member"];

export function MemberList({ serverId }: MemberListProps) {
  const members = useQuery(api.members.listMembers, { serverId }) ?? [];

  const grouped = ROLE_ORDER.reduce<Record<Role, typeof members>>(
    (acc, role) => {
      acc[role] = members.filter((m) => m.role === role);
      return acc;
    },
    { admin: [], moderator: [], member: [] }
  );

  const isMuted = (mutedUntil?: number) =>
    mutedUntil !== undefined && mutedUntil > Date.now();

  return (
    <div className="member-list-panel">
      <div className="member-list-header">Members — {members.length}</div>

      {ROLE_ORDER.map((role) => {
        const group = grouped[role];
        if (group.length === 0) return null;
        return (
          <div key={role}>
            <div className="member-group-label">
              {role.charAt(0).toUpperCase() + role.slice(1)}s — {group.length}
            </div>
            {group.map((m) => (
              <div
                key={m._id}
                id={`member-item-${m.userId}`}
                className="member-item"
                title={isMuted(m.mutedUntil) ? "Muted" : undefined}
              >
                <Avatar
                  name={m.profile.displayName}
                  src={m.profile.profileImageUrl}
                  size="sm"
                  status={m.profile.status as "online" | "away" | "offline"}
                  showStatus
                />
                <span
                  className="member-name"
                  style={{ opacity: isMuted(m.mutedUntil) ? 0.5 : 1 }}
                >
                  {m.profile.displayName}
                </span>
                {isMuted(m.mutedUntil) && (
                  <span title="Muted" style={{ fontSize: 12 }}>🔇</span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
