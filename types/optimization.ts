export interface CandidateScore {
  model: string;
  selfScore: number;
  crossScore: number;
  finalScore: number;
}

export interface CandidateResume {
  model: string;
  text: string;
  focus: string;
  selfScore: number;
  crossScore: number;
  finalScore: number;
  changes: SectionChange[];
}

export interface SectionChange {
  section: string;
  original: string;
  new: string;
  reason: string;
}

export interface OptimizationResult {
  bestResume: string;
  winningModel: string;
  finalScore: number;
  candidateResumes: CandidateResume[];
  missingKeywords: string[];
  addedKeywords: string[];
  improvementSummary: string[];
  changes: SectionChange[];
}

export interface AgentInput {
  originalResume: string;
  jobDescription: string;
}
