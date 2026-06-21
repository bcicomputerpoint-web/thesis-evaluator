import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { AIEngine, ComplianceAnswers, ComplianceDetails, ThesisMeta } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

async function verifyToken(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(header.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}

function buildPrompt(
  meta: ThesisMeta,
  answers: ComplianceAnswers,
  score: number,
  details: ComplianceDetails,
  hasPdf: boolean
): string {
  const rows = Object.entries(answers)
    .map(([k, v]) => `  ${k}: ${v ?? "Not provided"} [${details[k] ? "PASS" : "FAIL"}]`)
    .join("\n");

  return `You are a senior PhD thesis evaluator for Indian universities. Expert in UGC 2022 regulations, Shodhganga/INFLIBNET standards, research ethics, and IIT/IISc institutional benchmarks.

THESIS UNDER EVALUATION:
Title: ${meta.title || "Not provided"}
Scholar: ${meta.scholar} | Supervisor: ${meta.supervisor}
University: ${meta.university} (${meta.universityType}) | Dept: ${meta.department}
Subject: ${meta.subject} | Year: ${meta.year} | Degree: ${meta.degreeType}
${hasPdf ? "A thesis PDF has been uploaded for structural analysis." : "No PDF uploaded — evaluating from compliance data only."}

COMPLIANCE SCORE: ${score}/100 across 9 groups · 52 criteria
${rows}

Respond ONLY in valid JSON (no markdown, no backticks, no extra text):
{"executive_summary":"4-5 sentence overview","engine_note":"one sentence on which AI model produced this","strengths":["s1","s2","s3","s4"],"critical_gaps":[{"issue":"","authority":"UGC 2022 Clause X / CARE / Shodhganga / DRC / Ethics","action":"","priority":"High/Medium/Low","timeline":"immediate/1 month/3 months"}],"chapter_recommendations":[{"chapter":"","status":"Strong/Adequate/Needs Work","comment":""}],"examiner_readiness":{"category":"A/B/C/F","rationale":"","viva_risk_areas":[""],"viva_tips":[""]},"supervisor_note":"","ethics_assessment":{"status":"Compliant/Needs Attention/Critical Issue","notes":""},"shodhganga_readiness":{"status":"Ready/Needs Attention/Not Ready","metadata_notes":"","file_checklist":[""]},"plagiarism_assessment":{"level":"0/1/2/3","risk":"Low/Medium/High","notes":""},"publication_strategy":"","rac_drc_feedback":"","inclusivity_notes":"","overall_recommendation":"3-4 sentences"}`;
}

async function callClaude(prompt: string, pdfBase64?: string): Promise<string> {
  const content: any[] = [];
  if (pdfBase64) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } });
  }
  content.push({ type: "text", text: prompt });
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [{ role: "user", content }],
  });
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

async function callGemini(prompt: string, pdfBase64?: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 } as any,
  });
  const parts: any[] = [];
  if (pdfBase64) parts.push({ inlineData: { mimeType: "application/pdf", data: pdfBase64 } });
  parts.push({ text: prompt });
  const result = await model.generateContent(parts);
  return result.response.text();
}

async function callHybrid(prompt: string, pdfBase64?: string): Promise<string> {
  let insights: object | null = null;
  if (pdfBase64) {
    try {
      const ep = `Analyse this PhD thesis PDF. Return ONLY JSON: {"chapters_found":["list"],"has_abstract":true,"has_declaration":true,"has_supervisor_cert":true,"citation_style":"APA/Harvard/Chicago/Mixed","methodology_type":"Qualitative/Quantitative/Mixed","conclusion_present":true,"references_count":0,"appendices_present":true,"key_observations":["3-5 observations"],"potential_gaps":["1-3 gaps"]}`;
      const raw = await callGemini(ep, pdfBase64);
      insights = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      insights = null;
    }
  }
  const enriched = insights
    ? `${prompt}\n\nGEMINI FULL-PDF ANALYSIS (1M context):\n${JSON.stringify(insights, null, 2)}\n\nIncorporate these structural findings.`
    : prompt;
  return await callClaude(enriched);
}

export async function POST(req: NextRequest) {
  // 1. Verify Firebase auth token
  const uid = await verifyToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Parse body
  const { engine, meta, answers, score, details, pdfBase64, evaluationId } = await req.json() as {
    engine: AIEngine;
    meta: ThesisMeta;
    answers: ComplianceAnswers;
    score: number;
    details: ComplianceDetails;
    pdfBase64?: string;
    evaluationId?: string;
  };

  // 3. Run AI
  const prompt = buildPrompt(meta, answers, score, details, !!pdfBase64);
  let rawResult: string;
  try {
    if (engine === "claude") rawResult = await callClaude(prompt, pdfBase64);
    else if (engine === "gemini") rawResult = await callGemini(prompt, pdfBase64);
    else rawResult = await callHybrid(prompt, pdfBase64);
  } catch (err: any) {
    return NextResponse.json({ error: `AI failed: ${err.message}` }, { status: 500 });
  }

  // 4. Parse result
  let aiResult: object;
  try {
    aiResult = JSON.parse(rawResult.replace(/```json|```/g, "").trim());
  } catch {
    return NextResponse.json({ error: "Failed to parse AI JSON response" }, { status: 500 });
  }

  // 5. Save to Firestore if evaluation ID provided
  if (evaluationId) {
    await adminDb.collection("evaluations").doc(evaluationId).update({
      aiResult,
      status: "completed",
      updatedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ success: true, result: aiResult });
}
