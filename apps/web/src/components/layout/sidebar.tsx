"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Users, BarChart2, Settings, Sparkles, ChevronDown, LayoutTemplate, ExternalLink } from "lucide-react";

const NAV = [
  {
    label: "Recruitment",
    items: [
      { href: "/jobs", icon: Briefcase, label: "Job Postings", badge: null },
      { href: "/templates", icon: LayoutTemplate, label: "Templates", badge: null },
      { href: "/candidates", icon: Users, label: "Candidates", soon: true },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/analytics", icon: BarChart2, label: "Analytics", soon: true },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", icon: Settings, label: "Settings", soon: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 248,
      minWidth: 248,
      background: "#0f172a",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      position: "sticky",
      top: 0,
    }}>
      {/* Logo */}
      <div style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          width: 34, height: 34,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 0 1px rgba(99,102,241,0.4), 0 4px 12px rgba(99,102,241,0.3)",
        }}>
          <Sparkles size={16} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.01em" }}>HireIQ</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.3, letterSpacing: "0.02em" }}>Intelligence Platform</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "20px 12px" }}>
        {NAV.map((group) => (
          <div key={group.label} style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)",
              padding: "0 10px", marginBottom: 6,
            }}>
              {group.label}
            </div>
            {group.items.map(({ href, icon: Icon, label, soon }: any) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={soon ? "#" : href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 9,
                    marginBottom: 2,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? "#fff" : "rgba(255,255,255,0.5)",
                    background: active
                      ? "linear-gradient(135deg, rgba(99,102,241,0.5), rgba(139,92,246,0.3))"
                      : "transparent",
                    opacity: soon ? 0.45 : 1,
                    cursor: soon ? "not-allowed" : "pointer",
                    transition: "all 0.15s",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (!active && !soon) {
                      (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
                      (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.8)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active && !soon) {
                      (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                      (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.5)";
                    }
                  }}
                >
                  {active && (
                    <div style={{
                      position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                      width: 3, height: 18, background: "#818cf8", borderRadius: "0 3px 3px 0",
                    }} />
                  )}
                  <Icon size={15} color={active ? "#a5b4fc" : "rgba(255,255,255,0.35)"} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {soon && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.06em", background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.3)", padding: "2px 6px", borderRadius: 4,
                    }}>
                      Soon
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Notification + User footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px" }}>
        {/* Careers portal quick link */}
        <Link
          href="/careers"
          target="_blank"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 10px", borderRadius: 8, marginBottom: 8,
            textDecoration: "none", fontSize: 12, fontWeight: 500,
            color: "rgba(255,255,255,0.4)",
            background: "transparent",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
            (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.7)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.4)";
          }}
        >
          <ExternalLink size={13} color="rgba(255,255,255,0.3)" />
          <span>Careers Portal</span>
        </Link>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 10px", borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          cursor: "pointer",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>
            A
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Admin User
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              admin@hireiq.com
            </div>
          </div>
          <ChevronDown size={13} color="rgba(255,255,255,0.3)" />
        </div>
      </div>
    </aside>
  );
}
