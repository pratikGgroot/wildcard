"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";

/**
 * Renders the admin sidebar only for non-public routes.
 * /careers/* is the public candidate portal — no sidebar there.
 */
export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = pathname.startsWith("/careers");

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
