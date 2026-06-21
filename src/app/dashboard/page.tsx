"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getEvaluationsByUser } from "@/lib/db";
import type { Evaluation } from "@/types";

const CAT_COLOR: Record<string, string> = { A: "#22C55E", B: "#EAB308", C: "#F97316", F: "#EF4444" };
const STATUS_COLOR: Record<string, string> = { draft: "#374558", in_progress: "#3B82F6", completed: "#22C55E", reviewed: "#A78BFA" };

export default function DashboardPage() {
  const { user, appUser, signOut, loading } = useAuth();
  const router = useRouter();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loadingEvals, setLoadingEvals] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      getEvaluationsByUser(user.uid)
        .then(setEvaluations)
        .finally(() => setLoadingEvals(false));
    }
  }, [user]);

  if (loading || !user || !appUser) {
    return (
      <div style={{ minHeight: "100vh", background: "#07090F", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#7C8FA8", fontSize: 14 }}>Loading dashboard…</div>
      </div>
    );
  }

  const roleColors: Record<string, string> = { scholar: "#3B82F6", supervisor: "#D97757", rac_member: "#22C55E", drc_admin: "#7C3AED" };
  const roleColor = roleColors[appUser.role] || "#3B82F6";

  return (
    <div style={{ minHeight: "100vh", background: "#07090F", fontFamily: "Inter, sans-serif", color: "#EEF2FF" }}>
      {/* Header */}
      <header style={{ background: "#0C1018", borderBottom: "1px solid #1C2A3E", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>📜</span>
          <span style={{ fontWeight: 800, fontSize: 14 }}>Onusandhan</span>
          <span style={{ fontSize: 10, fontWeight: 700, background: roleColor + "22", color: roleColor, border: `1px solid ${roleColor}44`, borderRadius: 4, padding: "2px 7px", textTransform: "uppercase", letterSpacing: 0.8 }}>
            {appUser.role.replace("_", " ")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#7C8FA8" }}>{appUser.displayName}</span>
          <button onClick={() => signOut().then(() => router.push("/"))} style={{ background: "transparent", border: "1px solid #1C2A3E", borderRadius: 6, color: "#7C8FA8", fontSize: 12, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>
            Sign Out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px" }}>
        {/* Welcome */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Welcome, {appUser.displayName.split(" ")[0]}</h1>
            <p style={{ color: "#7C8FA8", fontSize: 13 }}>
              {appUser.role === "scholar" && "Evaluate your thesis compliance against UGC 2022 standards."}
              {appUser.role === "supervisor" && "Review your scholars' thesis evaluations and add notes."}
              {appUser.role === "rac_member" && "View evaluation reports across your department."}
              {appUser.role === "drc_admin" && "University-wide evaluation dashboard and audit tools."}
            </p>
          </div>
          {(appUser.role === "scholar" || appUser.role === "supervisor") && (
            <Link href="/evaluate" style={{ background: "#3B82F6", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 13, padding: "10px 20px", borderRadius: 8 }}>
              + New Evaluation
            </Link>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Total Evaluations", value: evaluations.length, color: "#3B82F6" },
            { label: "Completed", value: evaluations.filter(e => e.status === "completed").length, color: "#22C55E" },
            { label: "Category A", value: evaluations.filter(e => e.category === "A").length, color: "#22C55E" },
            { label: "Needs Work", value: evaluations.filter(e => ["C", "F"].includes(e.category)).length, color: "#EF4444" },
          ].map(s => (
            <div key={s.label} style={{ background: "#111827", border: "1px solid #1C2A3E", borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#7C8FA8", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Evaluations list */}
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "#7C8FA8", textTransform: "uppercase", letterSpacing: 0.8, fontSize: 11 }}>
          {loadingEvals ? "Loading…" : `Your Evaluations (${evaluations.length})`}
        </h2>

        {!loadingEvals && evaluations.length === 0 && (
          <div style={{ background: "#111827", border: "1px solid #1C2A3E", borderRadius: 10, padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>No evaluations yet</div>
            <div style={{ color: "#7C8FA8", fontSize: 13, marginBottom: 20 }}>Start your first thesis evaluation</div>
            <Link href="/evaluate" style={{ background: "#3B82F6", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 13, padding: "10px 20px", borderRadius: 8 }}>
              Start Evaluation →
            </Link>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {evaluations.map(ev => (
            <div key={ev.id} style={{ background: "#111827", border: "1px solid #1C2A3E", borderRadius: 10, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ev.meta?.title || "Untitled Thesis"}
                </div>
                <div style={{ fontSize: 12, color: "#7C8FA8" }}>
                  {ev.meta?.scholar} · {ev.meta?.university} · {ev.meta?.year}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: CAT_COLOR[ev.category] || "#374558" }}>{ev.score}</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, background: (CAT_COLOR[ev.category] || "#374558") + "22", color: CAT_COLOR[ev.category] || "#374558", border: `1px solid ${(CAT_COLOR[ev.category] || "#374558")}44`, borderRadius: 4, padding: "1px 6px", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>
                    Cat. {ev.category}
                  </div>
                  <div style={{ fontSize: 10, color: STATUS_COLOR[ev.status] || "#374558", textTransform: "capitalize" }}>{ev.status}</div>
                </div>
                <Link href={`/evaluate?id=${ev.id}`} style={{ background: "#161F2E", border: "1px solid #1C2A3E", color: "#7C8FA8", textDecoration: "none", fontSize: 12, padding: "6px 12px", borderRadius: 6 }}>
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
