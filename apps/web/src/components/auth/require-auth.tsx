"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0f172a",
      }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
