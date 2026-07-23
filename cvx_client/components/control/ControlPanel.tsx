"use client";

import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { Modal } from "@/components/ui/Modal";
import { ServerSettings } from "./ServerSettings";
import { ChannelManager } from "./ChannelManager";
import { MemberManager } from "./MemberManager";

interface ControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: Id<"servers">;
  myRole: "admin" | "moderator" | "member";
}

type Tab = "settings" | "channels" | "members";

export function ControlPanel({
  isOpen,
  onClose,
  serverId,
  myRole,
}: ControlPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>(
    myRole === "admin" ? "settings" : "members"
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Server Management">
      {/* Tabs */}
      <div className="control-panel-tabs" style={{ marginBottom: 16 }}>
        {myRole === "admin" && (
          <button
            id="tab-settings"
            className={`control-tab ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            ⚙ Overview
          </button>
        )}
        {myRole === "admin" && (
          <button
            id="tab-channels"
            className={`control-tab ${activeTab === "channels" ? "active" : ""}`}
            onClick={() => setActiveTab("channels")}
          >
            # Channels
          </button>
        )}
        <button
          id="tab-members"
          className={`control-tab ${activeTab === "members" ? "active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          👥 Members & Roles
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "settings" && myRole === "admin" && (
        <ServerSettings serverId={serverId} />
      )}
      {activeTab === "channels" && myRole === "admin" && (
        <ChannelManager serverId={serverId} />
      )}
      {activeTab === "members" && (
        <MemberManager serverId={serverId} myRole={myRole} />
      )}
    </Modal>
  );
}
