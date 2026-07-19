import type { EditorialSourceReference, Question } from "@/types/content";

export const REVIEW_ATTESTATION_STATEMENT =
  "I independently reviewed this exact revision for doctrinal fidelity, source support, explanatory accuracy, and charitable language.";

export interface WorkflowReviewerAttestation {
  doctrinalFidelityConfirmed: true;
  sourcesChecked: true;
  explanationSupported: true;
  charitableLanguageConfirmed: true;
  independentReviewConfirmed: true;
  statement: string;
}

export interface WorkflowRevisionSnapshot {
  id: string;
  revisionNumber: number;
  contentHash: string;
  createdAt: string;
  createdBy: string;
  question: Question;
  sourceReferences: EditorialSourceReference[];
}
