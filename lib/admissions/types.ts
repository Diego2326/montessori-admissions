export type CandidateStatus = "PROMOTION" | "GRADUATED" | "REVIEW";

export interface AdmissionCandidate {
  id: number;
  firstName: string;
  lastName: string;
  currentGrade: string | null;
  proposedGrade: string | null;
  familyId: number | null;
  familyName: string | null;
  familyReviewStatus: string | null;
  representativeName: string | null;
  historicalContracts: number;
  status: CandidateStatus;
}

export interface AdmissionsOverview {
  connection: "connected" | "not_configured" | "error" | "unauthorized" | "forbidden";
  candidates: AdmissionCandidate[];
  error?: string;
}
