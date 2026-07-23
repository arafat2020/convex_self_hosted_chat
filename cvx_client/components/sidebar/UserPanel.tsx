"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/ui/Avatar";
import { useAuthActions } from "@convex-dev/auth/react";
import { useToast } from "@/components/ui/Toast";

import { useMutation } from "convex/react";

interface UserPanelProps {
  serverId: Id<"servers"> | null;
}

export function UserPanel({ serverId }: UserPanelProps) {
  const user = useQuery(api.users.getCurrentUser);
  const setStatus = useMutation(api.users.setStatus);
  const { signOut } = useAuthActions();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await setStatus({ status: "offline" });
    } catch {}
    try {
      await signOut();
    } catch {
      toast("Sign out failed", "error");
    }
  };

  if (!user?.profile) return null;

  return (
    <div className="user-panel">
      <div className="relative">
        <Avatar
          name={user.profile.displayName}
          src={user.profileImageUrl}
          size="sm"
          status={user.profile.status as "online" | "away" | "offline"}
          showStatus
        />
      </div>
      <div className="user-panel-info">
        <div className="user-panel-name">{user.profile.displayName}</div>
        <div className="user-panel-status">
          {user.profile.status === "online" ? "🟢" : user.profile.status === "away" ? "🟡" : "⚫"} {user.profile.status}
        </div>
      </div>
      <button
        id="btn-signout"
        className="btn btn-ghost btn-icon"
        onClick={handleSignOut}
        title="Sign out"
        style={{ fontSize: 16, flexShrink: 0 }}
      >
        ↪
      </button>
    </div>
  );
}
