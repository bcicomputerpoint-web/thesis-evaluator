import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { Evaluation } from "@/types";

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

export async function POST(req: NextRequest) {
  const uid = await verifyToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data: Partial<Evaluation> = await req.json();
  const now = new Date().toISOString();

  if (data.id) {
    // Update existing
    await adminDb.collection("evaluations").doc(data.id).update({
      ...data,
      uid,
      updatedAt: now,
    });
    return NextResponse.json({ success: true, id: data.id });
  } else {
    // Create new
    const ref = adminDb.collection("evaluations").doc();
    await ref.set({
      ...data,
      id: ref.id,
      uid,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ success: true, id: ref.id });
  }
}
