"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Evaluation, AppUser, University } from "@/types";

const USERS = "users";
const EVALUATIONS = "evaluations";
const UNIVERSITIES = "universities";

// ─── Users ────────────────────────────────────────────────────────
export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, USERS, uid));
  return snap.exists() ? (snap.data() as AppUser) : null;
}

export async function upsertUser(uid: string, data: Partial<AppUser>): Promise<void> {
  await setDoc(doc(db, USERS, uid), { ...data, uid }, { merge: true });
}

// ─── Evaluations ──────────────────────────────────────────────────
export async function createEvaluation(
  uid: string,
  data: Omit<Evaluation, "id" | "uid" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = doc(collection(db, EVALUATIONS));
  const now = new Date().toISOString();
  await setDoc(ref, { ...data, id: ref.id, uid, createdAt: now, updatedAt: now });
  return ref.id;
}

export async function updateEvaluation(id: string, data: Partial<Evaluation>): Promise<void> {
  await updateDoc(doc(db, EVALUATIONS, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function getEvaluation(id: string): Promise<Evaluation | null> {
  const snap = await getDoc(doc(db, EVALUATIONS, id));
  return snap.exists() ? (snap.data() as Evaluation) : null;
}

export async function getEvaluationsByUser(uid: string): Promise<Evaluation[]> {
  const q = query(
    collection(db, EVALUATIONS),
    where("uid", "==", uid),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Evaluation);
}

export async function getEvaluationsByUniversity(name: string): Promise<Evaluation[]> {
  const q = query(
    collection(db, EVALUATIONS),
    where("meta.university", "==", name),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Evaluation);
}

// ─── Universities ─────────────────────────────────────────────────
export async function getUniversities(): Promise<University[]> {
  const snap = await getDocs(collection(db, UNIVERSITIES));
  return snap.docs.map((d) => d.data() as University);
}
