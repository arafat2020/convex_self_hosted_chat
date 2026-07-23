"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface ServerListProps {
  activeServerId: Id<"servers"> | null;
  onSelectServer: (id: Id<"servers">) => void;
}

export function ServerList({ activeServerId, onSelectServer }: ServerListProps) {
  const servers = useQuery(api.servers.listServers) ?? [];
  const serversUnreadMap = useQuery(api.readStates.getServersUnreadMap) ?? {};
  const createServer = useMutation(api.servers.createServer);
  const joinByInvite = useMutation(api.servers.joinByInvite);
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [serverName, setServerName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim()) return;
    setLoading(true);
    try {
      const id = await createServer({ name: serverName.trim() });
      toast("Server created!", "success");
      setShowCreate(false);
      setServerName("");
      onSelectServer(id);
    } catch (err: any) {
      toast(err?.message ?? "Failed to create server", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      const id = await joinByInvite({ inviteCode: inviteCode.trim() });
      toast("Joined server!", "success");
      setShowJoin(false);
      setInviteCode("");
      onSelectServer(id);
    } catch (err: any) {
      toast(err?.message ?? "Invalid invite code", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="server-list">
      {servers.map((s) => {
        const hasUnread = Boolean(serversUnreadMap[s!._id] && activeServerId !== s!._id);
        return (
          <div
            key={s!._id}
            className={`server-icon ${activeServerId === s!._id ? "active" : ""} ${hasUnread ? "unread" : ""}`}
            onClick={() => onSelectServer(s!._id)}
            title={s!.name}
            id={`server-icon-${s!._id}`}
          >
            <span className="server-pip" />
            {hasUnread && <span className="server-unread-dot" />}
            {s!.iconUrl ? (
              <img src={s!.iconUrl} alt={s!.name} />
            ) : (
              <span>{s!.name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
        );
      })}

      {/* Divider */}
      <div style={{ width: 32, height: 2, background: "var(--border)", borderRadius: 1 }} />

      {/* Add server */}
      <div
        className="server-icon server-icon-add"
        onClick={() => setShowCreate(true)}
        title="Create a server"
        id="btn-create-server"
      >
        +
      </div>

      {/* Join server */}
      <div
        className="server-icon server-icon-add"
        onClick={() => setShowJoin(true)}
        title="Join a server"
        id="btn-join-server"
        style={{ fontSize: 16 }}
      >
        🔗
      </div>

      {/* Create server modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create a Server">
        <form onSubmit={handleCreateServer} className="flex flex-col gap-4">
          <div className="form-group">
            <label className="form-label" htmlFor="server-name">Server Name</label>
            <input
              id="server-name"
              className="form-input"
              placeholder="e.g. My Awesome Server"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex gap-2" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
            <button
              id="btn-create-server-submit"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Creating…" : "Create Server"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Join server modal */}
      <Modal isOpen={showJoin} onClose={() => setShowJoin(false)} title="Join a Server">
        <form onSubmit={handleJoinServer} className="flex flex-col gap-4">
          <div className="form-group">
            <label className="form-label" htmlFor="invite-code">Invite Code</label>
            <input
              id="invite-code"
              className="form-input"
              placeholder="Enter invite code (e.g. ABC12345)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              required
              autoFocus
            />
          </div>
          <div className="flex gap-2" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowJoin(false)}
            >
              Cancel
            </button>
            <button
              id="btn-join-server-submit"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Joining…" : "Join Server"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
