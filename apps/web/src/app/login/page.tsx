"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0f172a",
    }}>
      <div style={{
        width: 400, background: "#1e293b", borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)", padding: 40,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 38, height: 38,
            background: "linear-gradient(135deg, #111827, #1f2937)",
            borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(234,179,8,0.3)",
            boxShadow: "0 0 0 2px rgba(234,179,8,0.1)",
          }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 4 L28 28 H22 L19 21 H13 L10 28 H4 L16 4Z" fill="#eab308" />
              <rect x="11.5" y="18" width="9" height="2.5" rx="1.25" fill="#111827" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
              <span style={{ color: "#eab308" }}>Apex</span> Hire
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Intelligence Platform</div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>Sign in</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
            Enter your credentials to continue
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 16, padding: "10px 12px", borderRadius: 8,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5", fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "11px", borderRadius: 8, border: "none",
              background: loading ? "rgba(234,179,8,0.4)" : "linear-gradient(135deg, #1f2937, #111827)",
              color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              border: "1px solid rgba(234,179,8,0.3)",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
          Default password for dev accounts: <code style={{ color: "rgba(255,255,255,0.4)" }}>password123</code>
        </p>
      </div>
    </div>
  );
}
