"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.push("/dashboard");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#07090F" }}>
        <div style={{ color: "#7C8FA8", fontSize: 14 }}>Loading Onusandhan…</div>
      </div>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#07090F", color: "#EEF2FF", fontFamily: "Inter, sans-serif" }}>
      {/* Nav */}
      <nav style={{ padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1C2A3E", background: "#0C1018" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📜</span>
          <span style={{ fontWeight: 800, fontSize: 16 }}>Onusandhan</span>
          <span style={{ fontSize: 11, color: "#7C8FA8", marginLeft: 4 }}>PhD Thesis Evaluator</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/login" style={{ color: "#7C8FA8", fontSize: 13, textDecoration: "none", padding: "8px 16px" }}>Sign In</Link>
          <Link href="/register" style={{ background: "#3B82F6", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", padding: "8px 18px", borderRadius: 7 }}>Get Started Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "80px 24px 60px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "#3B82F620", border: "1px solid #3B82F644", borderRadius: 20, padding: "4px 14px", fontSize: 12, color: "#3B82F6", fontWeight: 600, marginBottom: 20 }}>
          UGC 2022 · Shodhganga INFLIBNET · DRC/RAC · IIT Standards
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 900, lineHeight: 1.15, letterSpacing: -0.5, marginBottom: 20 }}>
          Evaluate Your PhD Thesis<br />
          <span style={{ color: "#3B82F6" }}>Before You Submit</span>
        </h1>
        <p style={{ fontSize: 17, color: "#7C8FA8", lineHeight: 1.7, marginBottom: 36, maxWidth: 600, margin: "0 auto 36px" }}>
          AI-powered compliance checker against <strong style={{ color: "#EEF2FF" }}>9 criterion groups · 52 individual criteria</strong> drawn from official Indian PhD evaluation standards.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" style={{ background: "#3B82F6", color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none", padding: "14px 32px", borderRadius: 8 }}>
            Start Free Evaluation →
          </Link>
          <Link href="/login" style={{ background: "#111827", color: "#7C8FA8", fontSize: 15, textDecoration: "none", padding: "14px 28px", borderRadius: 8, border: "1px solid #1C2A3E" }}>
            Sign In
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {[
          { icon: "⚖️", title: "UGC 2022 Compliance", desc: "Coursework credits, RAC reports, RPE course, teaching assistantship, pre-submission seminar, examiner requirements — all checked." },
          { icon: "🔍", title: "Plagiarism Levels", desc: "UGC Anti-Plagiarism 2018 — Level 0–3 thresholds. DrillBit-Extreme (ShodhShuddhi) current standard since October 2023." },
          { icon: "🗄️", title: "Shodhganga Ready", desc: "Dublin Core metadata validation, file naming convention, ShodhGangotri synopsis check, INFLIBNET MoU verification." },
          { icon: "👩‍🏫", title: "Supervisor Eligibility", desc: "Designation-wise publication requirements, maximum scholar load (≤8), co-supervisor documentation — UGC 2022 Clause 6." },
          { icon: "⚡", title: "3 AI Engines", desc: "Claude (Anthropic), Gemini 1.5 Flash (1M context), or Hybrid (Gemini reads PDF → Claude writes report)." },
          { icon: "🎓", title: "Category A/B/C/F Verdict", desc: "Maps to the official Indian university examiner category system used across all HEIs — not just a number." },
        ].map(f => (
          <div key={f.title} style={{ background: "#111827", border: "1px solid #1C2A3E", borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 12, color: "#7C8FA8", lineHeight: 1.7 }}>{f.desc}</div>
          </div>
        ))}
      </section>

      {/* Roles */}
      <section style={{ borderTop: "1px solid #1C2A3E", padding: "60px 24px", textAlign: "center", background: "#0C1018" }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Built for Everyone in the PhD Ecosystem</h2>
        <p style={{ color: "#7C8FA8", fontSize: 14, marginBottom: 32 }}>Four role-based views. One evaluation platform.</p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", maxWidth: 700, margin: "0 auto" }}>
          {[
            { role: "Scholar", desc: "Run evaluation, track gaps, download report", color: "#3B82F6" },
            { role: "Supervisor", desc: "Review scholar evaluations, add notes", color: "#D97757" },
            { role: "RAC Member", desc: "View evaluations across department", color: "#22C55E" },
            { role: "DRC Admin", desc: "University-wide dashboard and audit", color: "#7C3AED" },
          ].map(r => (
            <div key={r.role} style={{ background: r.color + "15", border: `1px solid ${r.color}44`, borderRadius: 10, padding: "16px 20px", minWidth: 150 }}>
              <div style={{ fontWeight: 700, color: r.color, fontSize: 14 }}>{r.role}</div>
              <div style={{ fontSize: 12, color: "#7C8FA8", marginTop: 4, lineHeight: 1.6 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: "1px solid #1C2A3E", padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#374558" }}>
          © 2025 Onusandhan · PhD Thesis Evaluator · onusandhan-prod
        </div>
        <div style={{ fontSize: 12, color: "#374558" }}>
          UGC 2022 · Anti-Plagiarism 2018 · Shodhganga 2024 · Category A/B/C/F
        </div>
      </footer>
    </main>
  );
}
