import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getGemini() {
  if (!process.env.GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not set");
  return new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
}

async function callClaude(prompt: string): Promise<string> {
  const client = getAnthropic();
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");
}

async function callGemini(prompt: string): Promise<string> {
  const client = getGemini();
  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 } as any,
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function GET() {
  return NextResponse.json({ status: "ok", anthropic: !!process.env.ANTHROPIC_API_KEY, gemini: !!process.env.GOOGLE_GEMINI_API_KEY });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { engine, meta, answers, score, details } = body;
    if (!engine || !meta) return NextResponse.json({ error: "Missing engine or meta" }, { status: 400 });

    const failedItems = Object.entries(details || {}).filter(([, v]) => !v).map(([k]) => k).slice(0, 15).join(", ");
    const passedCount = Object.values(details || {}).filter(Boolean).length;
    const totalCount = Object.keys(details || {}).length;
    const category = score >= 85 ? "A" : score >= 65 ? "B" : score >= 45 ? "C" : "F";

    const prompt = `You are a PhD thesis evaluator for Indian universities (UGC 2022, Shodhganga, DRC/RAC).

THESIS: "${meta.title || "Untitled"}" by ${meta.scholar || "Scholar"}
University: ${meta.university || "Unknown"} | Subject: ${meta.subject || "Unknown"} | Year: ${meta.year}
Supervisor: ${meta.supervisor || "Unknown"} | Degree: ${meta.degreeType}
Score: ${score}/100 (${passedCount}/${totalCount} passed) | Category: ${category}
Failed: ${failedItems || "none"}

Return ONLY this JSON (no markdown):
{"executive_summary":"2-3 sentences","engine_note":"Evaluated by ${engine}","strengths":["s1","s2","s3"],"critical_gaps":[{"issue":"i1","authority":"UGC 2022","action":"a1","priority":"High","timeline":"immediate"},{"issue":"i2","authority":"Shodhganga","action":"a2","priority":"Medium","timeline":"1 month"}],"chapter_recommendations":[{"chapter":"Introduction","status":"Adequate","comment":"c1"},{"chapter":"Methodology","status":"Adequate","comment":"c2"}],"examiner_readiness":{"category":"${category}","rationale":"one sentence","viva_risk_areas":["r1","r2"],"viva_tips":["t1","t2"]},"supervisor_note":"one sentence","ethics_assessment":{"status":"Compliant","notes":"brief"},"shodhganga_readiness":{"status":"Needs Attention","metadata_notes":"brief","file_checklist":["f1","f2"]},"plagiarism_assessment":{"level":"0","risk":"Low","notes":"brief"},"publication_strategy":"one sentence","rac_drc_feedback":"one sentence","inclusivity_notes":"one sentence","overall_recommendation":"2-3 sentences"}`;

    let raw: string;
    if (engine === "gemini") raw = await callGemini(prompt);
    else raw = await callClaude(prompt);

    const aiResult = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json({ success: true, result: aiResult });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
