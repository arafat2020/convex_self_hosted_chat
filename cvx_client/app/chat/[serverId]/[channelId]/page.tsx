"use client";

import { useConvexAuth, useAuthActions } from "@convex-dev/auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { ServerList } from "@/components/sidebar/ServerList";
import { ChannelList } from "@/components/sidebar/ChannelList";
import { UserPanel } from "@/components/sidebar/UserPanel";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { MemberList } from "@/components/members/MemberList";
import { ControlPanel } from "@/components/control/ControlPanel";
import { ToastProvider } from "@/components/ui/Toast";
import { FullPageSpinner } from "@/components/ui/Spinner";

export default function ChatViewPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const params = useParams();

  const serverId = params.serverId as Id<"servers">;
  const rawChannelId = params.channelId as string;
  const isDefault = rawChannelId === "default";
  const channelId = isDefault ? null : (rawChannelId as Id<"channels">);

  const server = useQuery(api.servers.getServer, { serverId });
  const channels = useQuery(api.channels.listChannels, { serverId });
  const channel = useQuery(
    api.channels.getChannel,
    channelId ? { channelId } : "skip"
  );
  const membership = useQuery(api.members.getMyMembership, { serverId });

  const ensureProfile = useMutation(api.users.ensureProfile);
  const setStatus = useMutation(api.users.setStatus);
  const markChannelRead = useMutation(api.readStates.markChannelRead);

  const [membersVisible, setMembersVisible] = useState(true);
  const [showControlPanel, setShowControlPanel] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/auth");
    } else if (isAuthenticated) {
      ensureProfile({}).then(() => {
        setStatus({ status: "online" }).catch(() => {});
      }).catch(() => {});
    }
  }, [isAuthenticated, isLoading, router, ensureProfile, setStatus]);

  useEffect(() => {
    if (isDefault && channels && channels.length > 0) {
      router.replace(`/chat/${serverId}/${channels[0]!._id}`);
    }
  }, [isDefault, channels, serverId, router]);

  useEffect(() => {
    if (channelId) {
      markChannelRead({ channelId }).catch(() => {});
    }
  }, [channelId, markChannelRead]);

  if (isLoading || !isAuthenticated) {
    return <FullPageSpinner />;
  }

  const myRole = membership?.role ?? "member";

  return (
    <ToastProvider>
      <div className="app-layout">
        {/* SIDEBAR REGION (Server strip + Channel sidebar + User panel) */}
        <ErrorBoundary name="Sidebar">
          <ServerList
            activeServerId={serverId}
            onSelectServer={(sId) => {
              router.push(`/chat/${sId}/default`);
            }}
          />

          <div className="channel-sidebar">
            <ChannelList
              serverId={serverId}
              activeChannelId={channelId}
              onSelectChannel={(cId) => {
                router.push(`/chat/${serverId}/${cId}`);
              }}
              myRole={myRole}
              onOpenControlPanel={() => setShowControlPanel(true)}
            />
            <UserPanel serverId={serverId} />
          </div>
        </ErrorBoundary>

        {/* MAIN CHAT REGION */}
        <div className="main-content">
          <ErrorBoundary name="MainChat">
            {channelId && channel ? (
              <>
                <ChatHeader
                  channelId={channelId}
                  serverId={serverId}
                  onToggleMembers={() => setMembersVisible(!membersVisible)}
                  membersVisible={membersVisible}
                />
                <MessageList
                  channelId={channelId}
                  serverId={serverId}
                  myRole={myRole}
                />
                <MessageInput
                  channelId={channelId}
                  channelName={channel.name}
                  serverId={serverId}
                />
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">💬</div>
                <h3>No channel selected</h3>
                <p>Select a channel from the sidebar to start chatting.</p>
              </div>
            )}
          </ErrorBoundary>
        </div>

        {/* MEMBER LIST REGION */}
        {membersVisible && (
          <ErrorBoundary name="MemberList">
            <MemberList serverId={serverId} />
          </ErrorBoundary>
        )}

        {/* CONTROL PANEL REGION */}
        <ErrorBoundary name="ControlPanel">
          <ControlPanel
            isOpen={showControlPanel}
            onClose={() => setShowControlPanel(false)}
            serverId={serverId}
            myRole={myRole}
          />
        </ErrorBoundary>
      </div>
    </ToastProvider>
  );
}
