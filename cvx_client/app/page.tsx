"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageSpinner } from "@/components/ui/Spinner";

export default function RootPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace("/chat");
      } else {
        router.replace("/auth");
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return <FullPageSpinner />;
}
