"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="su-root">
      <div className="su-stage">
        <header className="su-topbar">
          <div className="su-logo" style={{ fontSize: 20 }}>
            <span className="su-logo-mark" aria-hidden="true">S</span>
            <span className="su-logo-text">
              Spanish<span className="su-accent-text">Up</span>
            </span>
          </div>
        </header>

        <main className="su-main">
          <div className="su-card su-screen" style={{ gap: 20 }}>
            <div>
              <h1 className="su-h1">Welcome back</h1>
              <p className="su-lead" style={{ marginTop: 8 }}>Sign in to continue your learning streak.</p>
            </div>

            {error && <p className="su-error-banner">{error}</p>}

            <form onSubmit={handleSubmit} className="su-form" noValidate>
              <label className="su-field">
                <span className="su-field-label">Email</span>
                <input
                  className="su-input"
                  type="email"
                  required
                  value={email}
                  placeholder="you@email.com"
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="su-field">
                <span className="su-field-label">Password</span>
                <input
                  className="su-input"
                  type="password"
                  required
                  value={password}
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <button
                className="su-btn su-btn-primary su-btn-lg"
                type="submit"
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span className="su-fineprint" style={{ margin: 0 }}>or</span>
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            <Link href="/register" className="su-btn" style={{
              display: "block",
              textAlign: "center",
              textDecoration: "none",
              background: "var(--surface-2)",
              color: "var(--ink)",
              border: "1.5px solid var(--border)",
              padding: "16px 22px",
              fontSize: 16,
              minHeight: 56,
              lineHeight: "24px",
            }}>
              Create a free account
            </Link>

            <p className="su-fineprint">
              New here? Take a 20-question placement test first — no account needed to start.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
