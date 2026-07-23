"use client";

type Role = "admin" | "moderator" | "member";

interface BadgeProps {
  role: Role;
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  moderator: "Mod",
  member: "Member",
};

export function RoleBadge({ role }: BadgeProps) {
  return (
    <span className={`role-badge ${role}`}>{ROLE_LABELS[role]}</span>
  );
}
