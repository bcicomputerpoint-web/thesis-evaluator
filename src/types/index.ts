export type UserRole = "scholar" | "supervisor" | "rac_member" | "drc_admin";
export type AIEngine = "claude" | "gemini" | "hybrid";
export type EvalStatus = "draft" | "in_progress" | "completed" | "reviewed";
export type EvalCategory = "A" | "B" | "C" | "F";
export type UniversityType = "central" | "state" | "deemed" | "iit_nit" | "private" | "autonomous";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  universityId?: string;
  department?: string;
  createdAt: string;
}

export interface University {
  id: string;
  name: string;
  type: UniversityType;
  naacGrade?: string;
  inflibnetMou: boolean;
  state: string;
}

export interface ThesisMeta {
  title: string;
  scholar: string;
  scholarUid?: string;
  supervisor: string;
  supervisorUid?: string;
  university: string;
  universityType: UniversityType;
  department: string;
  subject: string;
  year: number;
  degreeType: "PhD" | "MPhil";
  registrationDate?: string;
}

export interface ComplianceAnswers {
  [fieldId: string]: string | number | undefined;
}

export interface ComplianceDetails {
  [fieldId: string]: boolean;
}

export interface AIGap {
  issue: string;
  authority: string;
  action: string;
  priority: "High" | "Medium" | "Low";
  timeline: string;
}

export interface AIChapterRec {
  chapter: string;
  status: "Strong" | "Adequate" | "Needs Work";
  comment: string;
}

export interface AIAnalysisResult {
  executive_summary: string;
  engine_note: string;
  strengths: string[];
  critical_gaps: AIGap[];
  chapter_recommendations: AIChapterRec[];
  examiner_readiness: {
    category: EvalCategory;
    rationale: string;
    viva_risk_areas: string[];
    viva_tips: string[];
  };
  supervisor_note: string;
  ethics_assessment: {
    status: "Compliant" | "Needs Attention" | "Critical Issue";
    notes: string;
  };
  shodhganga_readiness: {
    status: "Ready" | "Needs Attention" | "Not Ready";
    metadata_notes: string;
    file_checklist: string[];
  };
  plagiarism_assessment: {
    level: string;
    risk: "Low" | "Medium" | "High";
    notes: string;
  };
  publication_strategy: string;
  rac_drc_feedback: string;
  inclusivity_notes: string;
  overall_recommendation: string;
}

export interface Evaluation {
  id: string;
  uid: string;
  status: EvalStatus;
  engine: AIEngine;
  meta: ThesisMeta;
  answers: ComplianceAnswers;
  score: number;
  details: ComplianceDetails;
  category: EvalCategory;
  aiResult?: AIAnalysisResult;
  pdfStoragePath?: string;
  reportStoragePath?: string;
  supervisorNotes?: string;
  racReview?: {
    reviewedBy: string;
    reviewedAt: string;
    verdict: string;
    comments: string;
  };
  createdAt: string;
  updatedAt: string;
}
