"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { ServerList } from "@/components/sidebar/ServerList";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";

export default function ChatLandingPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const servers = useQuery(api.servers.listServers);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/auth");
      return;
    }

    if (servers && servers.length > 0) {
      const firstServer = servers[0]!;
      router.replace(`/chat/${firstServer._id}/default`);
    }
  }, [isAuthenticated, isLoading, servers, router]);

  if (isLoading || !servers) {
    return <FullPageSpinner />;
  }

  // If authed but 0 servers:
  return (
    <ToastProvider>
      <div className="app-layout">
        <ErrorBoundary name="Sidebar">
          <ServerList
            activeServerId={null}
            onSelectServer={(sId) => router.push(`/chat/${sId}/default`)}
          />
        </ErrorBoundary>
        <div className="main-content flex items-center justify-center">
          <div className="empty-state">
            <div className="empty-state-icon">🚀</div>
            <h3>Welcome to CVX Chat!</h3>
            <p>
              You're not in any servers yet. Click the <strong>+</strong> icon on the left sidebar to create a server, or <strong>🔗</strong> to join one with an invite code.
            </p>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
