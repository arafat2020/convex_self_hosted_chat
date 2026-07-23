"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { FullPageSpinner } from "@/components/ui/Spinner";

export default function AuthPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/chat");
    }
  }, [isAuthenticated, router]);

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (isAuthenticated) return null;

  return <AuthForm />;
}
