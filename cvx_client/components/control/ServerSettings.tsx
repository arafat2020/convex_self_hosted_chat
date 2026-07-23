"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";

interface ServerSettingsProps {
  serverId: Id<"servers">;
}

export function ServerSettings({ serverId }: ServerSettingsProps) {
  const server = useQuery(api.servers.getServer, { serverId });
  const updateServer = useMutation(api.servers.updateServer);
  const regenerateInviteCode = useMutation(api.servers.regenerateInviteCode);
  const { toast } = useToast();

  const [name, setName] = useState(server?.name ?? "");
  const [description, setDescription] = useState(server?.description ?? "");
  const [loading, setLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateServer({
        serverId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast("Server updated successfully", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to update server", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenInvite = async () => {
    setRegenLoading(true);
    try {
      await regenerateInviteCode({ serverId });
      toast("Invite code regenerated", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to regenerate invite code", "error");
    } finally {
      setRegenLoading(false);
    }
  };

  const copyInvite = () => {
    if (!server?.inviteCode) return;
    navigator.clipboard.writeText(server.inviteCode);
    setCopied(true);
    toast("Invite code copied to clipboard", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* General Settings */}
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="form-group">
          <label className="form-label" htmlFor="settings-name">Server Name</label>
          <input
            id="settings-name"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="settings-desc">Description</label>
          <input
            id="settings-desc"
            className="form-input"
            placeholder="What is this server about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button
          id="btn-save-server-settings"
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ alignSelf: "flex-start", marginTop: 4 }}
        >
          {loading ? <Spinner size="sm" /> : "Save Changes"}
        </button>
      </form>

      <div className="divider" />

      {/* Invite Code */}
      <div className="form-group">
        <label className="form-label">Server Invite Code</label>
        <div className="invite-box">
          <span className="invite-code">{server?.inviteCode ?? "…"}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={copyInvite}
          >
            {copied ? "Copied! ✓" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleRegenInvite}
          disabled={regenLoading}
          style={{ alignSelf: "flex-start", marginTop: 6 }}
        >
          {regenLoading ? <Spinner size="sm" /> : "↻ Regenerate Invite Code"}
        </button>
      </div>
    </div>
  );
}
