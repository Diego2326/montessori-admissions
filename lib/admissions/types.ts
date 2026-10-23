export type CandidateStatus = "PROMOTION" | "GRADUATED" | "REVIEW";

export interface AdmissionCandidate {
  id: number;
  uuid?: string | null;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
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
