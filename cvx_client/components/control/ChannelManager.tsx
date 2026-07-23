"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";

interface ChannelManagerProps {
  serverId: Id<"servers">;
}

export function ChannelManager({ serverId }: ChannelManagerProps) {
  const channels = useQuery(api.channels.listChannels, { serverId }) ?? [];
  const createChannel = useMutation(api.channels.createChannel);
  const updateChannel = useMutation(api.channels.updateChannel);
  const deleteChannel = useMutation(api.channels.deleteChannel);
  const { toast } = useToast();

  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelTopic, setNewChannelTopic] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const [editingId, setEditingId] = useState<Id<"channels"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editTopic, setEditTopic] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    setCreateLoading(true);
    try {
      await createChannel({
        serverId,
        name: newChannelName.trim(),
        topic: newChannelTopic.trim() || undefined,
      });
      toast("Channel created!", "success");
      setNewChannelName("");
      setNewChannelTopic("");
    } catch (err: any) {
      toast(err?.message ?? "Failed to create channel", "error");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdate = async (channelId: Id<"channels">) => {
    try {
      await updateChannel({
        channelId,
        name: editName.trim() || undefined,
        topic: editTopic.trim() || undefined,
      });
      toast("Channel updated", "success");
      setEditingId(null);
    } catch (err: any) {
      toast(err?.message ?? "Failed to update channel", "error");
    }
  };

  const handleDelete = async (channelId: Id<"channels">, name: string) => {
    if (!confirm(`Are you sure you want to delete #${name}?`)) return;
    try {
      await deleteChannel({ channelId });
      toast("Channel deleted", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to delete channel", "error");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Create channel form */}
      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <div className="form-group">
          <label className="form-label" htmlFor="new-channel-name">New Channel Name</label>
          <input
            id="new-channel-name"
            className="form-input"
            placeholder="e.g. announcements"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="new-channel-topic">Topic (Optional)</label>
          <input
            id="new-channel-topic"
            className="form-input"
            placeholder="Channel topic or description"
            value={newChannelTopic}
            onChange={(e) => setNewChannelTopic(e.target.value)}
          />
        </div>

        <button
          id="btn-create-channel-submit"
          type="submit"
          className="btn btn-primary"
          disabled={createLoading}
          style={{ alignSelf: "flex-start" }}
        >
          {createLoading ? <Spinner size="sm" /> : "+ Create Channel"}
        </button>
      </form>

      <div className="divider" />

      {/* Existing Channels List */}
      <div className="form-label">Existing Channels ({channels.length})</div>

      <div className="flex flex-col gap-2">
        {channels.map((ch) => (
          <div
            key={ch._id}
            className="flex items-center justify-between"
            style={{
              padding: "10px 12px",
              background: "var(--bg-900)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
            }}
          >
            {editingId === ch._id ? (
              <div className="flex flex-col gap-2 w-full">
                <input
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Channel name"
                />
                <input
                  className="form-input"
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  placeholder="Topic"
                />
                <div className="flex gap-2" style={{ marginTop: 4 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleUpdate(ch._id)}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col min-w-0 flex-1">
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    # {ch.name}
                  </span>
                  {ch.topic && (
                    <span className="text-xs text-muted truncate">
                      {ch.topic}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditingId(ch._id);
                      setEditName(ch.name);
                      setEditTopic(ch.topic ?? "");
                    }}
                  >
                    ✏ Edit
                  </button>
                  {channels.length > 1 && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(ch._id, ch.name)}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
