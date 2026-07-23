"use client";

import { useState, useRef } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";

type Tab = "signIn" | "signUp";

export function AuthForm() {
  const [tab, setTab] = useState<Tab>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const { signIn } = useAuthActions();
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const ensureProfile = useMutation(api.users.ensureProfile);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === "signUp") {
        await signIn("password", {
          email,
          password,
          flow: "signUp",
          name: displayName || email.split("@")[0],
        });
      } else {
        await signIn("password", { email, password, flow: "signIn" });
      }
    } catch (err: any) {
      setError(err?.message ?? "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">💬</div>
          <span className="auth-logo-text">CVX Chat</span>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            id="tab-signin"
            className={`auth-tab ${tab === "signIn" ? "active" : ""}`}
            onClick={() => { setTab("signIn"); setError(null); }}
          >
            Sign In
          </button>
          <button
            id="tab-signup"
            className={`auth-tab ${tab === "signUp" ? "active" : ""}`}
            onClick={() => { setTab("signUp"); setError(null); }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Avatar upload (sign up only) */}
          {tab === "signUp" && (
            <div className="avatar-upload">
              <div
                className="avatar-upload-btn"
                onClick={() => fileRef.current?.click()}
              >
                <Avatar
                  name={displayName || "User"}
                  src={avatarPreview}
                  size="xl"
                />
                <div className="avatar-upload-overlay">📷</div>
              </div>
              <span className="text-xs text-muted">Click to upload avatar</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          )}

          {tab === "signUp" && (
            <div className="form-group">
              <label className="form-label" htmlFor="displayName">Display Name</label>
              <input
                id="displayName"
                className="form-input"
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required={tab === "signUp"}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="form-input"
              type="password"
              placeholder={tab === "signUp" ? "Min 8 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={tab === "signUp" ? "new-password" : "current-password"}
              minLength={tab === "signUp" ? 8 : undefined}
            />
          </div>

          {error && <div className="form-error">⚠ {error}</div>}

          <button
            id={tab === "signIn" ? "btn-signin" : "btn-signup"}
            className="btn btn-primary w-full"
            type="submit"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? <Spinner size="sm" /> : tab === "signIn" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="text-xs text-muted" style={{ textAlign: "center", marginTop: 16 }}>
          {tab === "signIn" ? "Don't have an account? " : "Already have an account? "}
          <button
            className="btn btn-ghost btn-sm"
            style={{ display: "inline", padding: "0 4px", background: "none", border: "none", color: "var(--brand-purple-light)", cursor: "pointer" }}
            onClick={() => setTab(tab === "signIn" ? "signUp" : "signIn")}
          >
            {tab === "signIn" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
