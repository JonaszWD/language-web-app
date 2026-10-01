"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi, ApiError } from "@/lib/api";
import "../(app)/spanishup-app.css";

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
      router.push("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sp-root">
      <div className="sp-bg" aria-hidden="true">
        <div className="sp-blob b1" />
        <div className="sp-blob b2" />
        <div className="sp-blob b3" />
      </div>

      <div className="ob-page">
        <header className="ob-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Image src="/logo/plauda-fox.png" alt="" width={28} height={28} className="ob-brand-logo" />
            <span className="ob-brand">Plauda</span>
          </div>
        </header>

        <div className="sp-card ob-card">
          <div>
            <h1 className="sp-h1">Welcome back</h1>
            <p className="sp-sub" style={{ marginTop: 8 }}>Sign in to continue your learning streak.</p>
          </div>

          {error && <p className="ob-error-banner">{error}</p>}

          <form onSubmit={handleSubmit} className="ob-form" noValidate>
            <label className="ob-field">
              <span className="ob-field-label">Email</span>
              <input
                className="gr-input"
                style={{ margin: 0 }}
                type="email"
                required
                value={email}
                placeholder="you@email.com"
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="ob-field">
              <span className="ob-field-label">Password</span>
              <input
                className="gr-input"
                style={{ margin: 0 }}
                type="password"
                required
                value={password}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button className="sp-btn sp-btn-primary" style={{ width: "100%" }} type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="ob-divider">
            <span className="line" />
            <span className="ob-fineprint" style={{ margin: 0 }}>or</span>
            <span className="line" />
          </div>

          <Link href="/register" className="sp-btn sp-btn-ghost" style={{ width: "100%", textDecoration: "none" }}>
            Create a free account
          </Link>

          <p className="ob-fineprint">
            New here? Take a 20-question placement test first — no account needed to start.
          </p>
        </div>
      </div>
    </div>
  );
}
