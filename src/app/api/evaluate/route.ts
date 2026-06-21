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

async function callClaude(prompt: string, pdfBase64?: string): Promise<string> {
  const client = getAnthropic();
  const content: any[] = [];
  if (pdfBase64 && pdfBase64.length > 100) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } });
  content.push({ type: "text", text: prompt });
  const msg = await client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 4000, messages: [{ role: "user", content }] });
  return msg.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");
}

async function callGemini(prompt: string, pdfBase64?: string): Promise<string> {
  const client = getGemini();
  const model = client.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json", temperature: 0.2 } as any });
  const parts: any[] = [];
  if (pdfBase64 && pdfBase64.length > 100) parts.push({ inlineData: { mimeType: "application/pdf", data: pdfBase64 } });
  parts.push({ text: prompt });
  const result = await model.generateContent(parts);
  return result.response.text();
}

async function callHybrid(prompt: string, pdfBase64?: string): Promise<string> {
  let insights = null;
  if (pdfBase64 && pdfBase64.length > 100) {
    try {
      const raw = await callGemini('Analyse this PhD thesis. Return ONLY JSON: {"chapters_found":["list"],"has_abstract":true,"citation_style":"APA/Harvard/Mixed","key_observations":["observations"]}', pdfBase64);
      insights = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch { insights = null; }
  }
  const enriched = insights ? `${prompt}\n\nGEMINI PDF ANALYSIS:\n${JSON.stringify(insights, null, 2)}` : prompt;
  return await callClaude(enriched);
}

export async function GET() {
  return NextResponse.json({ status: "ok", anthropic: !!process.env.ANTHROPIC_API_KEY, gemini: !!process.env.GOOGLE_GEMINI_API_KEY });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { engine, meta, answers, score, details, pdfBase64 } = body;
    if (!engine || !meta) return NextResponse.json({ error: "Missing engine or meta" }, { status: 400 });
    const rows = Object.entries(answers || {}).map(([k, v]: any) => `  ${k}: ${v ?? "Not provided"} [${(details || {})[k] ? "PASS" : "FAIL"}]`).join("\n");
    const prompt = `You are a senior PhD thesis evaluator for Indian universities. Expert in UGC 2022, Shodhganga/INFLIBNET, and IIT/IISc standards.\n\nTHESIS: ${meta.title || "Not provided"}\nScholar: ${meta.scholar} | Supervisor: ${meta.supervisor}\nUniversity: ${meta.university} | Dept: ${meta.department}\nSubject: ${meta.subject} | Year: ${meta.year} | Degree: ${meta.degreeType}\n${pdfBase64 ? "PDF provided." : "No PDF."}\n\nCOMPLIANCE SCORE: ${score}/100\n${rows}\n\nRespond ONLY in valid JSON (no markdown):\n{"executive_summary":"4-5 sentences","engine_note":"which AI model","strengths":["s1","s2","s3"],"critical_gaps":[{"issue":"","authority":"UGC/CARE/Shodhganga","action":"","priority":"High/Medium/Low","timeline":"immediate/1 month/3 months"}],"chapter_recommendations":[{"chapter":"","status":"Strong/Adequate/Needs Work","comment":""}],"examiner_readiness":{"category":"A/B/C/F","rationale":"","viva_risk_areas":[""],"viva_tips":[""]},"supervisor_note":"","ethics_assessment":{"status":"Compliant/Needs Attention/Critical Issue","notes":""},"shodhganga_readiness":{"status":"Ready/Needs Attention/Not Ready","metadata_notes":"","file_checklist":[""]},"plagiarism_assessment":{"level":"0/1/2/3","risk":"Low/Medium/High","notes":""},"publication_strategy":"","rac_drc_feedback":"","inclusivity_notes":"","overall_recommendation":"3-4 sentences"}`;
    let raw: string;
    if (engine === "claude") raw = await callClaude(prompt, pdfBase64);
    else if (engine === "gemini") raw = await callGemini(prompt, pdfBase64);
    else raw = await callHybrid(prompt, pdfBase64);
    const aiResult = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json({ success: true, result: aiResult });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error", stack: err.stack?.substring(0, 300) }, { status: 500 });
  }
}

