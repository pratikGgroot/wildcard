"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { RequireAuth } from "@/components/auth/require-auth";
import { ChatPanel } from "@/components/chat/chat-panel";

// Routes that don't need the sidebar or auth guard
const PUBLIC_PATHS = ["/careers", "/login"];

/**
 * Renders the admin sidebar only for non-public routes.
 * /careers/* and /login are public — no sidebar or auth guard there.
 */
export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <RequireAuth>
      <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
        <Sidebar />
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          {children}
        </main>
        <ChatPanel />
      </div>
    </RequireAuth>
  );
}
