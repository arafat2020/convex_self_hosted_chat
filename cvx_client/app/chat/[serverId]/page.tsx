"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageSpinner } from "@/components/ui/Spinner";

export default function ServerResolverPage() {
  const params = useParams();
  const serverId = params.serverId as Id<"servers">;
  const channels = useQuery(api.channels.listChannels, { serverId });
  const router = useRouter();

  useEffect(() => {
    if (channels && channels.length > 0) {
      const firstChannel = channels[0]!;
      router.replace(`/chat/${serverId}/${firstChannel._id}`);
    }
  }, [channels, serverId, router]);

  if (!channels || channels.length > 0) {
    return <FullPageSpinner />;
  }

  // Server has 0 channels (should rarely happen):
  return (
    <div className="empty-state">
      <h3>No channels found in this server</h3>
    </div>
  );
}
