"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createEvaluation, updateEvaluation } from "@/lib/db";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import type { AIEngine, ComplianceAnswers, ComplianceDetails, ThesisMeta, EvalCategory } from "@/types";

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg: "#07090F", surface: "#0C1018", card: "#111827", card2: "#161F2E",
  border: "#1C2A3E", text: "#EEF2FF", sec: "#7C8FA8", muted: "#374558",
  claude: "#D97757", gemini: "#4285F4", hybrid: "#7C3AED",
  green: "#22C55E", gold: "#EAB308", orange: "#F97316", red: "#EF4444",
  blue: "#3B82F6", purple: "#A78BFA",
};

// ── Compliance groups ──────────────────────────────────────────
const GROUPS = [
  {
    id: "ugc_core", label: "UGC Core Regulations", icon: "⚖️", color: C.blue, weight: 20,
    fields: [
      { id: "min_duration", label: "PhD registration date (for duration check)", type: "date_check", benchmark: "≥ 3 years from registration", source: "UGC 2022, Cl.5", pass: (v: string) => !!v && (Date.now() - new Date(v).getTime()) / (1000*60*60*24*365) >= 3 },
      { id: "max_duration_ok", label: "Within maximum duration (≤ 6 years / 8 for women/PwD)", type: "boolean", benchmark: "≤ 6 years", source: "UGC 2022, Cl.5", pass: (v: string) => v === "yes" },
      { id: "mode_fulltime", label: "Programme mode", type: "select", options: ["Full-time","Part-time (permitted)","Distance/Online (not permitted)"], benchmark: "Cannot be distance/online", source: "UGC 2022, Cl.2", pass: (v: string) => v && v !== "Distance/Online (not permitted)" },
      { id: "coursework_credits", label: "Coursework credits completed", type: "number", unit: "credits", benchmark: "≥ 12 credits", source: "UGC 2022, Cl.9", pass: (v: string) => Number(v) >= 12 },
      { id: "coursework_marks", label: "Coursework aggregate marks", type: "number", unit: "%", benchmark: "≥ 55%", source: "UGC 2022, Cl.9", pass: (v: string) => Number(v) >= 55 },
      { id: "rpe_course", label: "RPE (Research & Publication Ethics) course completed", type: "boolean", benchmark: "Mandatory 2-credit 30-hr course", source: "UGC circular 2019", pass: (v: string) => v === "yes" },
      { id: "teaching_assist", label: "Teaching assistantship (4–6 hrs/week)", type: "select", options: ["Yes — completed","Exempted (valid reason)","Not completed"], benchmark: "4–6 hrs/week mandatory", source: "UGC 2022, Cl.9(2)", pass: (v: string) => v && v !== "Not completed" },
      { id: "pre_seminar", label: "Pre-submission seminar conducted", type: "boolean", benchmark: "Open seminar mandatory", source: "UGC 2022, Cl.13", pass: (v: string) => v === "yes" },
    ]
  },
  {
    id: "rac_drc", label: "RAC / DRC Compliance", icon: "🏛️", color: C.red, weight: 15,
    fields: [
      { id: "topic_drc", label: "Research topic DRC-approved", type: "boolean", benchmark: "Mandatory before commencing", source: "UGC 2022, Cl.8.1.1", pass: (v: string) => v === "yes" },
      { id: "rac_constituted", label: "RAC formally constituted (≥ 3 members)", type: "boolean", benchmark: "Mandatory — supervisor as convener", source: "UGC 2022, Cl.10", pass: (v: string) => v === "yes" },
      { id: "rac_reports", label: "6-monthly RAC progress reports submitted", type: "number", unit: "reports", benchmark: "≥ 1 per 6 months", source: "UGC 2022, Cl.10", pass: (v: string) => Number(v) >= 1 },
      { id: "study_design", label: "Study design and methodology RAC-approved", type: "boolean", benchmark: "RAC must approve methodology", source: "UGC 2022, Cl.8.1.2", pass: (v: string) => v === "yes" },
      { id: "intl_visit", label: "Inter-institutional research visit", type: "select", options: ["Completed (≥ 3 weeks)","Planned (RAC-approved)","Not undertaken"], benchmark: "Recommended ≥ 3 weeks", source: "UGC 2022, Cl.9.6", pass: (v: string) => v && v !== "Not undertaken" },
    ]
  },
  {
    id: "supervisor", label: "Supervisor Eligibility", icon: "👩‍🏫", color: C.orange, weight: 10,
    fields: [
      { id: "sup_designation", label: "Supervisor designation", type: "select", options: ["Professor","Associate Professor","Assistant Professor (≥5 yrs)","Retired (re-appointed ≤70)","Adjunct/Visiting (limited)"], benchmark: "Prof/AssocProf: ≥5 pubs; Asst Prof: ≥3 pubs + ≥5 yrs exp", source: "UGC 2022, Cl.6.1", pass: (v: string) => !!v },
      { id: "sup_publications", label: "Supervisor peer-reviewed publications (post-PhD)", type: "number", unit: "papers", benchmark: "Prof/Assoc: ≥ 5 · Asst Prof: ≥ 3", source: "UGC 2022, Cl.6.1", pass: (v: string) => Number(v) >= 3 },
      { id: "sup_load", label: "Total scholars under this supervisor", type: "number", unit: "scholars", benchmark: "≤ 8 total (incl. co-supervisions)", source: "UGC 2022, Cl.6.3", pass: (v: string) => Number(v) <= 8 },
      { id: "sup_active", label: "Supervisor is active faculty (not on long leave)", type: "boolean", benchmark: "Must be available for regular guidance", source: "UGC 2022, Cl.6", pass: (v: string) => v === "yes" },
      { id: "cosup_documented", label: "Co-supervisor details documented (if applicable)", type: "select", options: ["No co-supervisor","Co-supervisor from same institution (documented)","Co-supervisor from another institution (documented)","Not documented (issue)"], benchmark: "Must be formally documented with DRC", source: "UGC 2022, Cl.6.4", pass: (v: string) => v && v !== "Not documented (issue)" },
    ]
  },
  {
    id: "pub_ethics", label: "Publications & Ethics", icon: "📄", color: C.gold, weight: 15,
    fields: [
      { id: "pub_count", label: "Papers published / accepted before submission", type: "number", unit: "papers", benchmark: "≥ 1 in UGC CARE / Scopus / WoS", source: "UGC 2022, Cl.13", pass: (v: string) => Number(v) >= 1 },
      { id: "journal_type", label: "Journal indexing status", type: "select", options: ["UGC CARE Group I","UGC CARE Group II (Scopus/WoS)","Scopus only (verify with CARE)","Not indexed / predatory (HIGH RISK)"], benchmark: "Must be CARE Group I or Group II", source: "UGC CARE — ugccare.unipune.ac.in", pass: (v: string) => v && !v.includes("predatory") && !v.includes("HIGH RISK") },
      { id: "clone_check", label: "Journal verified against CARE cloned journals list", type: "boolean", benchmark: "Check ISSN and title at CARE clone list", source: "ugccare.unipune.ac.in/Clone", pass: (v: string) => v === "yes" },
      { id: "conference_pres", label: "Conference presentations", type: "number", unit: "presentations", benchmark: "≥ 2 recommended (1 national + 1 intl.)", source: "Standard PhD requirements", pass: (v: string) => Number(v) >= 1 },
      { id: "ai_disclosure", label: "AI-generated content disclosure", type: "select", options: ["No AI tools used","AI tools used — fully disclosed","AI for coding/data only (disclosed)","AI used — not disclosed (HIGH RISK)"], benchmark: "UGC 2025: undisclosed AI = misconduct", source: "UGC AI guidelines 2024-25", pass: (v: string) => v && !v.includes("not disclosed") },
      { id: "data_integrity", label: "Scholar declares no data fabrication / falsification", type: "boolean", benchmark: "Signed declaration mandatory", source: "UGC 2022, Cl.9.8", pass: (v: string) => v === "yes" },
      { id: "ipr_disclosed", label: "IPR potential disclosed to RAC/university", type: "select", options: ["No IPR potential","IPR potential disclosed and documented","IPR potential exists — not disclosed (issue)"], benchmark: "Notify university before viva if patentable", source: "UGC 2022, Cl.9.7", pass: (v: string) => v && v !== "IPR potential exists — not disclosed (issue)" },
    ]
  },
  {
    id: "plagiarism", label: "Plagiarism Compliance", icon: "🔍", color: C.orange, weight: 10,
    fields: [
      { id: "similarity", label: "Overall similarity score", type: "number", unit: "%", benchmark: "< 10% (Level 0 — safe to submit)", source: "UGC Anti-Plagiarism 2018", pass: (v: string) => Number(v) < 10 },
      { id: "plag_tool", label: "Detection tool used", type: "select", options: ["DrillBit-Extreme (ShodhShuddhi — current)","Turnitin","iThenticate","Urkund (legacy)","Other"], benchmark: "DrillBit-Extreme mandatory since Oct 2023", source: "INFLIBNET ShodhShuddhi portal", pass: (v: string) => !!v },
      { id: "chapter_check", label: "Chapter-wise plagiarism check done", type: "boolean", benchmark: "Required by IIT Madras and many universities", source: "IIT Madras thesis guidelines", pass: (v: string) => v === "yes" },
      { id: "biblio_excluded", label: "Bibliography excluded from similarity calculation", type: "boolean", benchmark: "Standard — bibliography excluded from 10% threshold", source: "UGC Anti-Plagiarism 2018 exclusion clause", pass: (v: string) => v === "yes" },
      { id: "plag_cert", label: "Library-attested plagiarism certificate obtained", type: "boolean", benchmark: "Mandatory gate condition for DRC clearance", source: "University DRC procedures", pass: (v: string) => v === "yes" },
    ]
  },
  {
    id: "shodhganga", label: "Shodhganga / INFLIBNET", icon: "🗄️", color: C.purple, weight: 8,
    fields: [
      { id: "sgangotri", label: "Synopsis deposited in ShodhGangotri first", type: "boolean", benchmark: "Must precede full thesis upload", source: "INFLIBNET ShodhGangotri 2024", pass: (v: string) => v === "yes" },
      { id: "sganga_uploaded", label: "Full thesis uploaded to Shodhganga", type: "boolean", benchmark: "Mandatory for all UGC institutions", source: "INFLIBNET Shodhganga 2024", pass: (v: string) => v === "yes" },
      { id: "file_naming", label: "INFLIBNET file naming convention followed", type: "boolean", benchmark: "01_title_ · 02_cert_ · 03_abstract_…", source: "INFLIBNET Technical Guidelines", pass: (v: string) => v === "yes" },
      { id: "dublin_core", label: "Dublin Core metadata (all 15 fields, no special chars)", type: "boolean", benchmark: "Special chars cause silent rejection", source: "INFLIBNET Dublin Core Schema", pass: (v: string) => v === "yes" },
      { id: "inflibnet_mou", label: "University MoU with INFLIBNET is active", type: "boolean", benchmark: "Required for Shodhganga participation", source: "INFLIBNET MoU register", pass: (v: string) => v === "yes" },
    ]
  },
  {
    id: "structure", label: "Thesis Structure", icon: "📚", color: C.green, weight: 7,
    fields: [
      { id: "prelim_pages", label: "All mandatory preliminary pages present", type: "boolean", benchmark: "Cover · Title · Declaration · Supervisor Certificate · ToC · Abstract", source: "IIT Bombay / IIT Madras guidelines", pass: (v: string) => v === "yes" },
      { id: "chapter_order", label: "Standard chapter structure followed", type: "boolean", benchmark: "Intro → LR → Methodology → Results → Discussion → Conclusion", source: "Standard doctoral thesis structure", pass: (v: string) => v === "yes" },
      { id: "chapter_count", label: "Number of chapters", type: "number", unit: "chapters", benchmark: "5–7 chapters (excluding prelim and end matter)", source: "Standard doctoral structure", pass: (v: string) => Number(v) >= 4 && Number(v) <= 10 },
      { id: "citation_style", label: "Citation style consistently applied", type: "select", options: ["APA 7th","Harvard","Chicago 17th","MLA 9th","Vancouver","IEEE","Discipline-specific (documented)","Mixed — non-compliant"], benchmark: "Single format throughout — no mixing", source: "Examiner rubrics across Indian universities", pass: (v: string) => v && v !== "Mixed — non-compliant" },
      { id: "appendices", label: "Raw data / questionnaires / instruments in appendices", type: "boolean", benchmark: "Needed for reproducibility verification by examiners", source: "IIT Bombay guidelines", pass: (v: string) => v === "yes" },
    ]
  },
  {
    id: "examiner_process", label: "Examiner & Viva Process", icon: "🎓", color: "#14B8A6", weight: 8,
    fields: [
      { id: "ext_examiners", label: "External examiners appointed", type: "number", unit: "examiners", benchmark: "≥ 2 (at least 1 from outside state/country)", source: "UGC 2022, Cl.14", pass: (v: string) => Number(v) >= 2 },
      { id: "outside_state", label: "At least 1 examiner from outside state / abroad", type: "boolean", benchmark: "Mandatory to prevent institutional bias", source: "UGC 2022, Cl.14", pass: (v: string) => v === "yes" },
      { id: "conflict_declared", label: "Examiner conflict of interest checked & declared", type: "boolean", benchmark: "Examiners must declare no conflict with scholar/supervisor", source: "IIITD evaluation guidelines", pass: (v: string) => v === "yes" },
      { id: "rejection_protocol", label: "Examiner rejection protocol status", type: "select", options: ["Both accepted (proceed to viva)","One rejected — alternate sent","Both/alternate rejected — thesis at risk","Not at this stage yet"], benchmark: "1 rejection → alternate. Both reject → thesis rejected.", source: "UGC 2022, Cl.14", pass: (v: string) => v && !v.includes("at risk") },
      { id: "viva_open", label: "Open viva-voce scheduled / completed", type: "boolean", benchmark: "Must be open — notice circulated publicly", source: "UGC 2022, Cl.14; IIT Indore", pass: (v: string) => v === "yes" },
    ]
  },
  {
    id: "inclusivity", label: "Inclusivity & Welfare", icon: "🌸", color: "#EC4899", weight: 7,
    fields: [
      { id: "scholar_category", label: "Scholar category", type: "select", options: ["General (full-time)","SC/ST/OBC scholar","Woman scholar","Person with Disability (PwD >40%)","Part-time (working professional)","International scholar"], benchmark: "Determines applicable extensions and provisions", source: "UGC 2022, Cl.3–5", pass: (v: string) => !!v },
      { id: "maternity_leave", label: "Maternity / child care leave documented (women scholars)", type: "select", options: ["Not applicable","Availed — documented","Entitled but not availed","Not aware of entitlement (issue)"], benchmark: "Up to 240 days — not deducted from research time", source: "UGC 2022, Cl.5(2)", pass: (v: string) => v && v !== "Not aware of entitlement (issue)" },
      { id: "noc_parttime", label: "NOC from employer (part-time scholars)", type: "select", options: ["Full-time (not required)","Part-time — NOC submitted","Part-time — NOC pending (issue)","Part-time — self-employed"], benchmark: "Mandatory for part-time scholars with employer", source: "UGC 2022, Cl.13", pass: (v: string) => v && v !== "Part-time — NOC pending (issue)" },
      { id: "fellowship", label: "Fellowship / financial support status", type: "select", options: ["UGC JRF","UGC NET Fellowship","DST/DBT/ICSSR/CSIR funded","Institutional stipend","Project JRF/SRF","Self-funded"], benchmark: "JRF scholars have additional agency reporting obligations", source: "UGC 2022, Cl.J", pass: (v: string) => !!v },
    ]
  },
];

const GW: Record<string, number> = { ugc_core: 20, rac_drc: 15, supervisor: 10, pub_ethics: 15, plagiarism: 10, shodhganga: 8, structure: 7, examiner_process: 8, inclusivity: 7 };

function scoreAll(answers: ComplianceAnswers) {
  let total = 0, earned = 0;
  const details: ComplianceDetails = {};
  GROUPS.forEach(g => {
    const w = GW[g.id] / g.fields.length;
    g.fields.forEach((f: any) => {
      total += w;
      const v = answers[f.id];
      const ok = v !== undefined && v !== "" && f.pass(String(v));
      if (ok) earned += w;
      details[f.id] = ok;
    });
  });
  return { score: Math.round((earned / total) * 100), details };
}

function gScore(gid: string, details: ComplianceDetails): number {
  const g = GROUPS.find(x => x.id === gid);
  if (!g) return 0;
  return Math.round(g.fields.filter((f: any) => details[f.id]).length / g.fields.length * 100);
}

function getVerdict(s: number) {
  if (s >= 85) return { label: "Category A — Ready", short: "Cat. A", color: C.green, cat: "A" as EvalCategory };
  if (s >= 65) return { label: "Category B — Minor Revisions", short: "Cat. B", color: C.gold, cat: "B" as EvalCategory };
  if (s >= 45) return { label: "Category C — Major Revisions", short: "Cat. C", color: C.orange, cat: "C" as EvalCategory };
  return { label: "Category F — Not Ready", short: "Cat. F", color: C.red, cat: "F" as EvalCategory };
}

// ── Field input component ──────────────────────────────────────
function FieldInput({ field, value, onChange }: { field: any, value: any, onChange: (v: string) => void }) {
  const base: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, padding: "7px 10px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

  if (field.type === "boolean") {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        {["yes", "no"].map(o => (
          <button key={o} onClick={() => onChange(o)} style={{ ...base, width: "auto", padding: "6px 18px", cursor: "pointer", background: value === o ? (o === "yes" ? C.green + "22" : C.red + "22") : C.surface, borderColor: value === o ? (o === "yes" ? C.green : C.red) : C.border, color: value === o ? (o === "yes" ? C.green : C.red) : C.sec, fontWeight: value === o ? 700 : 400 }}>
            {o === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    );
  }
  if (field.type === "select") {
    return <select value={value || ""} onChange={e => onChange(e.target.value)} style={{ ...base, width: "100%", cursor: "pointer" }}><option value="">Select…</option>{field.options.map((o: string) => <option key={o}>{o}</option>)}</select>;
  }
  if (field.type === "date_check") {
    const yrs = value ? ((Date.now() - new Date(value).getTime()) / (1000*60*60*24*365)).toFixed(1) : null;
    const ok = value && field.pass(String(value));
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="date" value={value || ""} onChange={e => onChange(e.target.value)} style={{ ...base, width: 160 }} />
        {yrs && <span style={{ fontSize: 11, color: ok ? C.green : C.red, fontWeight: 700 }}>{ok ? `✓ ${yrs} yrs — meets minimum` : `✗ ${yrs} yrs — below 3-year minimum`}</span>}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type="number" value={value || ""} onChange={e => onChange(e.target.value)} min="0" style={{ ...base, width: 90 }} />
      {field.unit && <span style={{ color: C.sec, fontSize: 12 }}>{field.unit}</span>}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function EvaluatePage() {
  const { user, appUser, loading } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [engine, setEngine] = useState<AIEngine>("claude");
  const [meta, setMeta] = useState<ThesisMeta>({ title: "", scholar: "", supervisor: "", university: "", universityType: "state", department: "", subject: "", year: new Date().getFullYear(), degreeType: "PhD" });
  const [answers, setAnswers] = useState<ComplianceAnswers>({});
  const [activeGroup, setActiveGroup] = useState(GROUPS[0].id);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfB64, setPdfB64] = useState("");
  const [evalId, setEvalId] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [saving, setSaving] = useState(false);

  const { score, details } = scoreAll(answers);
  const vrd = getVerdict(score);

  useEffect(() => { if (!loading && !user) router.push("/login"); }, [user, loading, router]);

  const handleFile = useCallback((f: File) => {
    if (!f || f.type !== "application/pdf") return;
    setPdfFile(f);
    const r = new FileReader();
    r.onload = e => {
      const arr = new Uint8Array(e.target!.result as ArrayBuffer);
      let bin = "";
      arr.forEach(b => { bin += String.fromCharCode(b); });
      setPdfB64(btoa(bin));
    };
    r.readAsArrayBuffer(f);
  }, []);

  // Save draft to Firestore
  const saveDraft = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const body = { id: evalId || undefined, status: "draft", engine, meta, answers, score, details, category: vrd.cat };
      const res = await fetch("/api/save-evaluation", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.id && !evalId) setEvalId(data.id);
    } finally { setSaving(false); }
  };

  // Upload PDF to Firebase Storage
  const uploadPdf = async (id: string): Promise<string | null> => {
    if (!pdfFile || !user) return null;
    const storageRef = ref(storage, `theses/${user.uid}/${id}/thesis.pdf`);
    await uploadBytes(storageRef, pdfFile);
    return await getDownloadURL(storageRef);
  };

  // Run AI analysis
  const runAnalysis = async () => {
    if (!user) return;
    setAiLoading(true); setAiError("");
    try {
      // Save/create evaluation first
      const token = await user.getIdToken();
      let currentId = evalId;
      if (!currentId) {
        const saveRes = await fetch("/api/save-evaluation", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: "in_progress", engine, meta, answers, score, details, category: vrd.cat }) });
        const saveData = await saveRes.json();
        currentId = saveData.id;
        setEvalId(currentId);
      }

      // Upload PDF if present
      if (pdfFile && currentId) await uploadPdf(currentId);

      // Call AI
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ engine, meta, answers, score, details, pdfBase64: pdfB64 || undefined, evaluationId: currentId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "AI analysis failed");
      setAiResult(data.result);
      setStep(4);
    } catch (err: any) {
      setAiError(err.message || "Analysis failed");
    } finally { setAiLoading(false); }
  };

  if (loading || !user) return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: C.sec }}>Loading…</div></div>;

  const S = {
    card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 } as React.CSSProperties,
    ghost: { background: "transparent", color: C.sec, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
    inp: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, padding: "8px 12px", width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } as React.CSSProperties,
    lbl: { fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, display: "block" } as React.CSSProperties,
    btn: (col: string) => ({ background: col, color: "#fff", border: "none", borderRadius: 7, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }) as React.CSSProperties,
  };

  const Header = () => (
    <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link href="/dashboard" style={{ color: C.sec, textDecoration: "none", fontSize: 13 }}>← Dashboard</Link>
        <span style={{ color: C.muted }}>·</span>
        <span style={{ fontWeight: 700, fontSize: 13 }}>New Evaluation</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: C.sec }}>
          {["Engine","Details","Compliance","Upload","Report"].map((s, i) => (
            <span key={s}>
              <span style={{ color: i === step ? C.blue : i < step ? C.green : C.muted, fontWeight: i === step ? 700 : 400 }}>{s}</span>
              {i < 4 && <span style={{ color: C.muted }}> → </span>}
            </span>
          ))}
        </span>
        {step >= 2 && (
          <button onClick={saveDraft} disabled={saving} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, color: C.sec, fontSize: 11, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "Saving…" : "Save Draft"}
          </button>
        )}
      </div>
    </header>
  );

  // ── STEP 0: ENGINE ─────────────────────────────────────────
  if (step === 0) return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif", color: C.text }}>
      <Header />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 18px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Choose AI Engine</h2>
        <p style={{ color: C.sec, fontSize: 13, marginBottom: 24 }}>All engines evaluate against the same 9 groups · 52 criteria. API keys are stored server-side only.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { id: "claude" as AIEngine, name: "Claude", color: C.claude, icon: "🟠", desc: "Artifact native · Zero extra key needed · Best structured JSON · 200K context" },
            { id: "gemini" as AIEngine, name: "Gemini", color: C.gemini, icon: "🔵", desc: "1M token context · Entire thesis in one call · Free tier · Native PDF" },
            { id: "hybrid" as AIEngine, name: "Hybrid", color: C.hybrid, icon: "⚡", desc: "Gemini reads full PDF (1M) · Claude writes structured report · Best quality" },
          ].map(e => (
            <div key={e.id} onClick={() => setEngine(e.id)} style={{ ...S.card, cursor: "pointer", borderColor: engine === e.id ? e.color : C.border, borderWidth: engine === e.id ? 2 : 1, background: engine === e.id ? e.color + "0D" : C.card }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{e.icon}</div>
              <div style={{ fontWeight: 800, color: e.color, fontSize: 14, marginBottom: 6 }}>{e.name}</div>
              <div style={{ fontSize: 12, color: C.sec, lineHeight: 1.6 }}>{e.desc}</div>
              {engine === e.id && <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: e.color }}>SELECTED ✓</div>}
            </div>
          ))}
        </div>
        <button style={S.btn(C.blue)} onClick={() => setStep(1)}>Continue with {engine.charAt(0).toUpperCase() + engine.slice(1)} →</button>
      </div>
    </div>
  );

  // ── STEP 1: THESIS DETAILS ─────────────────────────────────
  if (step === 1) return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif", color: C.text }}>
      <Header />
      <div style={{ maxWidth: 660, margin: "0 auto", padding: "28px 18px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Thesis & Scholar Details</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
          {[{ key: "title", label: "Thesis Title", span: 2 }, { key: "scholar", label: "Scholar Name" }, { key: "supervisor", label: "Supervisor Name" }, { key: "university", label: "University Name" }, { key: "department", label: "Department / Centre" }, { key: "subject", label: "Subject / Discipline" }, { key: "year", label: "Year", type: "number" }].map(f => (
            <div key={f.key} style={{ gridColumn: f.span === 2 ? "1 / -1" : "auto" }}>
              <label style={S.lbl}>{f.label}</label>
              <input style={S.inp} type={f.type || "text"} value={(meta as any)[f.key] || ""} onChange={e => setMeta(m => ({ ...m, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={S.lbl}>University Type</label>
            <select style={S.inp} value={meta.universityType} onChange={e => setMeta(m => ({ ...m, universityType: e.target.value as any }))}>
              {["central","state","deemed","iit_nit","private","autonomous"].map(t => <option key={t} value={t}>{t.replace("_"," ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </select>
          </div>
          <div>
            <label style={S.lbl}>Degree Type</label>
            <select style={S.inp} value={meta.degreeType} onChange={e => setMeta(m => ({ ...m, degreeType: e.target.value as any }))}>
              <option>PhD</option><option>MPhil</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 22 }}>
          <button style={S.ghost} onClick={() => setStep(0)}>← Back</button>
          <button style={S.btn(C.blue)} onClick={() => setStep(2)} disabled={!meta.title || !meta.scholar}>Next: Compliance →</button>
        </div>
      </div>
    </div>
  );

  // ── STEP 2: COMPLIANCE ─────────────────────────────────────
  if (step === 2) {
    const ag = GROUPS.find(g => g.id === activeGroup)!;
    const ai = GROUPS.findIndex(g => g.id === activeGroup);
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif", color: C.text }}>
        <Header />
        <div style={{ maxWidth: 940, margin: "0 auto", padding: "16px", display: "grid", gridTemplateColumns: "190px 1fr", gap: 14 }}>
          {/* Sidebar */}
          <div>
            {GROUPS.map(g => {
              const gs = gScore(g.id, details);
              const bc = gs >= 70 ? C.green : gs >= 40 ? C.gold : C.red;
              return (
                <button key={g.id} onClick={() => setActiveGroup(g.id)} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", background: activeGroup === g.id ? g.color + "10" : "transparent", border: `1px solid ${activeGroup === g.id ? g.color + "44" : "transparent"}`, borderLeft: `3px solid ${activeGroup === g.id ? g.color : "transparent"}`, borderRadius: 7, padding: "7px 9px", cursor: "pointer", marginBottom: 3, textAlign: "left" }}>
                  <span style={{ fontSize: 12 }}>{g.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: activeGroup === g.id ? g.color : C.sec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</div>
                    <div style={{ background: C.border, borderRadius: 99, height: 3, overflow: "hidden", marginTop: 2 }}><div style={{ width: `${gs}%`, height: "100%", background: bc, borderRadius: 99 }} /></div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: bc }}>{gs}%</span>
                </button>
              );
            })}
            <div style={{ ...S.card, marginTop: 10, textAlign: "center", padding: 12 }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: score >= 85 ? C.green : score >= 65 ? C.gold : score >= 45 ? C.orange : C.red }}>{score}</div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 5 }}>/ 100 · 52 criteria</div>
              <div style={{ background: C.border, borderRadius: 99, height: 5, overflow: "hidden" }}><div style={{ width: `${score}%`, height: "100%", background: score >= 85 ? C.green : score >= 65 ? C.gold : score >= 45 ? C.orange : C.red, borderRadius: 99, transition: "width 0.5s" }} /></div>
              <div style={{ fontSize: 10, color: vrd.color, fontWeight: 700, marginTop: 5 }}>{vrd.short}</div>
            </div>
          </div>
          {/* Fields */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
              <span style={{ fontSize: 18 }}>{ag.icon}</span>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{ag.label}</h2>
                <div style={{ fontSize: 11, color: C.sec }}>Weight: {GW[ag.id]}% · {ag.fields.length} criteria</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {ag.fields.map((field: any) => {
                const val = answers[field.id];
                const passed = details[field.id];
                const has = val !== undefined && val !== "";
                return (
                  <div key={field.id} style={{ ...S.card, borderLeft: `3px solid ${has ? (passed ? C.green : C.red) : C.border}`, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7, gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{field.label}</div>
                        <div style={{ fontSize: 11, color: C.sec }}>Benchmark: <strong style={{ color: C.text }}>{field.benchmark}</strong> · <span style={{ color: C.blue }}>{field.source}</span></div>
                      </div>
                      {has && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: (passed ? C.green : C.red) + "22", color: passed ? C.green : C.red, border: `1px solid ${(passed ? C.green : C.red)}44`, whiteSpace: "nowrap" }}>{passed ? "PASS" : "FAIL"}</span>}
                    </div>
                    <FieldInput field={field} value={val} onChange={v => setAnswers(a => ({ ...a, [field.id]: v }))} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, gap: 10 }}>
              <button style={S.ghost} onClick={() => { if (ai > 0) setActiveGroup(GROUPS[ai - 1].id); else setStep(1); }}>{ai > 0 ? "← Prev Section" : "← Back"}</button>
              <button style={S.btn(C.blue)} onClick={() => { if (ai < GROUPS.length - 1) setActiveGroup(GROUPS[ai + 1].id); else setStep(3); }}>
                {ai < GROUPS.length - 1 ? `Next: ${GROUPS[ai + 1].label} →` : "Upload PDF →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 3: UPLOAD + ANALYSE ───────────────────────────────
  if (step === 3) return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif", color: C.text }}>
      <Header />
      <div style={{ maxWidth: 580, margin: "0 auto", padding: "32px 18px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Upload Thesis PDF (optional)</h2>
        <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }} onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${pdfFile ? C.green : C.border}`, borderRadius: 12, padding: "32px 18px", textAlign: "center", cursor: "pointer", background: pdfFile ? C.green + "08" : C.surface, marginBottom: 20 }}>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          <div style={{ fontSize: 28, marginBottom: 8 }}>{pdfFile ? "✅" : "📄"}</div>
          {pdfFile ? <><div style={{ fontWeight: 700, color: C.green }}>{pdfFile.name}</div><div style={{ color: C.sec, fontSize: 12, marginTop: 4 }}>Click to replace</div></> : <><div style={{ fontWeight: 600 }}>Drop PDF here or click to browse</div><div style={{ color: C.sec, fontSize: 12, marginTop: 4 }}>Optional — enables AI structural analysis. Max 50MB.</div></>}
        </div>

        {/* Score summary */}
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Compliance Score</span>
            <span style={{ fontWeight: 900, fontSize: 22, color: score >= 85 ? C.green : score >= 65 ? C.gold : score >= 45 ? C.orange : C.red }}>{score}/100</span>
          </div>
          {GROUPS.map(g => { const gs = gScore(g.id, details); return (<div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ fontSize: 11 }}>{g.icon}</span><span style={{ fontSize: 10, color: C.sec, flex: 1 }}>{g.label}</span><div style={{ width: 55, background: C.border, borderRadius: 99, height: 4, overflow: "hidden" }}><div style={{ width: `${gs}%`, height: "100%", background: gs >= 70 ? C.green : gs >= 40 ? C.gold : C.red, borderRadius: 99 }} /></div><span style={{ fontSize: 10, fontWeight: 700, color: gs >= 70 ? C.green : gs >= 40 ? C.gold : C.red, width: 28, textAlign: "right" }}>{gs}%</span></div>); })}
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 7, fontSize: 12, color: vrd.color, fontWeight: 700 }}>{vrd.label}</div>
        </div>

        {aiError && <div style={{ background: C.red + "15", border: `1px solid ${C.red}44`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.red, marginBottom: 14 }}>{aiError}</div>}

        <button onClick={runAnalysis} disabled={aiLoading} style={{ ...S.btn(C.blue), width: "100%", padding: 13, fontSize: 14, opacity: aiLoading ? 0.6 : 1 }}>
          {aiLoading ? "⏳ Running AI Analysis…" : "Run AI Evaluation →"}
        </button>
        <button style={{ ...S.ghost, marginTop: 10, width: "100%" }} onClick={() => setStep(2)}>← Back to Compliance</button>
      </div>
    </div>
  );

  // ── STEP 4: REPORT ─────────────────────────────────────────
  if (step === 4 && aiResult) {
    const catC: Record<string, string> = { A: C.green, B: C.gold, C: C.orange, F: C.red };
    const priC: Record<string, string> = { High: C.red, Medium: C.gold, Low: C.green };
    const stC: Record<string, string> = { Strong: C.green, Adequate: C.gold, "Needs Work": C.orange };
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif", color: C.text }}>
        <Header />
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "16px" }}>
          {/* Hero */}
          <div style={{ ...S.card, borderTop: `3px solid ${vrd.color}`, marginBottom: 12, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>{meta.title}</h1>
                <div style={{ color: C.sec, fontSize: 12, marginTop: 5 }}>{meta.scholar} · {meta.university} · {meta.year}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 42, fontWeight: 900, color: vrd.color, lineHeight: 1 }}>{score}</div>
                <div style={{ fontSize: 11, color: C.muted }}>/ 100</div>
              </div>
            </div>
            <div style={{ marginTop: 12, background: C.border, borderRadius: 99, height: 7, overflow: "hidden" }}><div style={{ width: `${score}%`, height: "100%", background: vrd.color, borderRadius: 99 }} /></div>
            <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
              {[vrd.label, `Cat. ${aiResult.examiner_readiness?.category}`, `Plagiarism L${aiResult.plagiarism_assessment?.level}: ${aiResult.plagiarism_assessment?.risk}`, `Ethics: ${aiResult.ethics_assessment?.status}`, `Shodhganga: ${aiResult.shodhganga_readiness?.status}`].map((tag, i) => {
                const cols = [vrd.color, catC[aiResult.examiner_readiness?.category] || C.muted, aiResult.plagiarism_assessment?.risk === "Low" ? C.green : aiResult.plagiarism_assessment?.risk === "Medium" ? C.gold : C.red, aiResult.ethics_assessment?.status === "Compliant" ? C.green : C.orange, aiResult.shodhganga_readiness?.status === "Ready" ? C.green : C.orange];
                return <span key={i} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: cols[i] + "22", color: cols[i], border: `1px solid ${cols[i]}44` }}>{tag}</span>;
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ ...S.card, gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Executive Summary</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8 }}>{aiResult.executive_summary}</p>
            </div>
            <div style={S.card}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>✅ Strengths</div>
              {(aiResult.strengths || []).map((s: string, i: number) => <div key={i} style={{ display: "flex", gap: 7, marginBottom: 6 }}><span style={{ color: C.green }}>▸</span><span style={{ fontSize: 13, lineHeight: 1.6 }}>{s}</span></div>)}
            </div>
            <div style={{ ...S.card, borderTop: `3px solid ${catC[aiResult.examiner_readiness?.category] || C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 7 }}>🎓 Examiner Readiness</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: catC[aiResult.examiner_readiness?.category] || C.muted, marginBottom: 4 }}>Cat. {aiResult.examiner_readiness?.category}</div>
              <p style={{ fontSize: 13, color: C.sec, margin: "0 0 8px", lineHeight: 1.6 }}>{aiResult.examiner_readiness?.rationale}</p>
              {(aiResult.examiner_readiness?.viva_risk_areas || []).map((a: string, i: number) => <div key={i} style={{ fontSize: 12, color: C.sec, marginBottom: 2 }}>⚠ {a}</div>)}
            </div>
          </div>

          {(aiResult.critical_gaps || []).length > 0 && (
            <div style={{ ...S.card, marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>🔧 Critical Gaps ({aiResult.critical_gaps.length})</div>
              {aiResult.critical_gaps.map((gap: any, i: number) => (
                <div key={i} style={{ background: C.bg, borderRadius: 8, padding: "11px 13px", borderLeft: `3px solid ${priC[gap.priority] || C.border}`, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{gap.issue}</div>
                      <div style={{ fontSize: 12, color: C.blue }}>→ {gap.action}</div>
                      {gap.timeline && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Timeline: {gap.timeline}</div>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: (priC[gap.priority] || C.muted) + "22", color: priC[gap.priority] || C.muted, border: `1px solid ${(priC[gap.priority] || C.muted)}44`, whiteSpace: "nowrap", alignSelf: "flex-start" }}>{gap.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Compliance breakdown */}
          <div style={{ ...S.card, marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>📊 Compliance Breakdown — 9 Groups</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 9 }}>
              {GROUPS.map(g => { const gs = gScore(g.id, details); const passed = g.fields.filter((f: any) => details[f.id]).length; const bc = gs >= 70 ? C.green : gs >= 40 ? C.gold : C.red; return (<div key={g.id} style={{ background: C.bg, borderRadius: 8, padding: "10px 12px" }}><div style={{ display: "flex", gap: 5, marginBottom: 4 }}><span>{g.icon}</span><span style={{ fontSize: 10, color: C.sec, fontWeight: 600 }}>{g.label}</span></div><div style={{ fontSize: 19, fontWeight: 900, color: bc, marginBottom: 3 }}>{gs}%</div><div style={{ background: C.border, borderRadius: 99, height: 4, overflow: "hidden" }}><div style={{ width: `${gs}%`, height: "100%", background: bc, borderRadius: 99 }} /></div><div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>{passed}/{g.fields.length} criteria</div></div>); })}
            </div>
          </div>

          {/* Final recommendation */}
          <div style={{ ...S.card, background: vrd.color + "08", borderColor: vrd.color + "28", marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: vrd.color, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 7 }}>Final Recommendation</div>
            <p style={{ fontSize: 14, lineHeight: 1.8, margin: 0 }}>{aiResult.overall_recommendation}</p>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Link href="/dashboard" style={{ background: C.card, border: `1px solid ${C.border}`, color: C.sec, textDecoration: "none", fontSize: 13, padding: "10px 18px", borderRadius: 8 }}>← Dashboard</Link>
            <button onClick={() => window.print()} style={S.btn(C.blue)}>🖨 Print / Save PDF</button>
          </div>

          <div style={{ textAlign: "center", fontSize: 10, color: C.muted, marginTop: 20, lineHeight: 2 }}>
            Onusandhan · Evaluated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })} · UGC 2022 · Anti-Plagiarism 2018 · Shodhganga Jan 2024 · Category A/B/C/F Framework
          </div>
        </div>
      </div>
    );
  }

  return null;
}
