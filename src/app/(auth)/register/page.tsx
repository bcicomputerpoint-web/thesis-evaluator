"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/types";

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: "scholar", label: "PhD Scholar", desc: "Evaluate my own thesis" },
  { value: "supervisor", label: "Research Supervisor", desc: "Review my scholars' evaluations" },
  { value: "rac_member", label: "RAC Member", desc: "Department-level evaluation oversight" },
  { value: "drc_admin", label: "DRC Coordinator", desc: "University-wide admin access" },
];

export default function RegisterPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("scholar");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inp: React.CSSProperties = {
    background: "#0C1018", border: "1px solid #1C2A3E", borderRadius: 7,
    color: "#EEF2FF", fontSize: 14, padding: "10px 14px", width: "100%",
    outline: "none", fontFamily: "inherit",
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#374558",
    textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 5,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await signUp(email, password, name, role);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message?.replace("Firebase: ", "") || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(""); setLoading(true);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message?.replace("Firebase: ", "") || "Google sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#07090F", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "#111827", border: "1px solid #1C2A3E", borderRadius: 14, padding: 36, width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📜</div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Create Account</h1>
          <p style={{ color: "#7C8FA8", fontSize: 13, marginTop: 4 }}>Onusandhan — PhD Thesis Evaluator</p>
        </div>

        <button onClick={handleGoogle} disabled={loading} style={{ width: "100%", background: "#161F2E", border: "1px solid #1C2A3E", borderRadius: 8, color: "#EEF2FF", fontSize: 14, fontWeight: 600, padding: "11px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16, fontFamily: "inherit" }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.32-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.68 28.18A13.9 13.9 0 0 1 10.8 24c0-1.45.25-2.85.88-4.18v-5.7H4.34A21.96 21.96 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.34-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.34 5.7c1.74-5.2 6.59-9.07 12.32-9.07z"/></svg>
          Continue with Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: "#1C2A3E" }} />
          <span style={{ fontSize: 11, color: "#374558" }}>or register with email</span>
          <div style={{ flex: 1, height: 1, background: "#1C2A3E" }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Full Name</label>
            <input style={inp} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Dr. / Mr. / Ms. Full Name" required />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Email</label>
            <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@university.edu" required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Password</label>
            <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" minLength={8} required />
          </div>

          {/* Role selection */}
          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>I am a…</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {ROLES.map(r => (
                <div key={r.value} onClick={() => setRole(r.value)} style={{ background: role === r.value ? "#3B82F620" : "#0C1018", border: `1px solid ${role === r.value ? "#3B82F6" : "#1C2A3E"}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: role === r.value ? "#3B82F6" : "#EEF2FF" }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: "#7C8FA8", marginTop: 2 }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {error && <div style={{ background: "#EF444415", border: "1px solid #EF444444", borderRadius: 7, padding: "8px 12px", fontSize: 13, color: "#EF4444", marginBottom: 14 }}>{error}</div>}

          <button type="submit" disabled={loading} style={{ width: "100%", background: "#3B82F6", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 700, padding: 12, cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "#7C8FA8", marginTop: 18 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#3B82F6", textDecoration: "none", fontWeight: 600 }}>Sign In</Link>
        </p>
      </div>
    </main>
  );
}
