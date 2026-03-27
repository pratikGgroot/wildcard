import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

// ── Auth token injection ──────────────────────────────────────────────────────

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) throw new Error("no refresh token");
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/auth/refresh`,
          { refresh_token: refreshToken }
        );
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Types matching the backend schemas
export type JobType = "full-time" | "contract" | "internship";
export type JobStatus = "draft" | "active" | "paused" | "closed";
export type AssignmentRole = "recruiter" | "hiring_manager";

export interface JobCreate {
  title: string;
  description: string;
  department?: string;
  location?: string;
  type: JobType;
  template_id?: string;
}

export interface JobUpdate {
  title?: string;
  description?: string;
  department?: string;
  location?: string;
  type?: JobType;
}

export interface Assignment {
  id: string;
  job_id: string;
  user_id: string;
  role: AssignmentRole;
  assigned_at: string;
}

export interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  type: JobType;
  description: string;
  status: JobStatus;
  close_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignments: Assignment[];
}

export interface PaginatedJobs {
  items: Job[];
  total: number;
  page: number;
  page_size: number;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

// API functions
export const jobsApi = {
  create: (data: JobCreate) =>
    api
      .post<Job>("/jobs", {
        ...data,
        department: data.department || null,
        location: data.location || null,
      })
      .then((r) => r.data),

  list: (params?: { status?: string; department?: string; page?: number }) =>
    api.get<PaginatedJobs>("/jobs", { params }).then((r) => r.data),

  get: (id: string) => api.get<Job>(`/jobs/${id}`).then((r) => r.data),

  update: (id: string, data: JobUpdate) =>
    api.put<Job>(`/jobs/${id}`, data).then((r) => r.data),

  changeStatus: (id: string, status: JobStatus, reason?: string) =>
    api.patch<Job>(`/jobs/${id}/status`, { status, reason }).then((r) => r.data),

  addAssignment: (id: string, user_id: string, role: AssignmentRole) =>
    api.post<Assignment>(`/jobs/${id}/assignments`, { user_id, role }).then((r) => r.data),

  removeAssignment: (id: string, userId: string) =>
    api.delete(`/jobs/${id}/assignments/${userId}`),
};

export const usersApi = {
  list: (role?: string) =>
    api.get<User[]>("/users", { params: role ? { role } : {} }).then((r) => r.data),
};

// Criteria types
export type CriterionType = "skill" | "experience" | "education" | "certification";
export type CriterionWeight = "high" | "medium" | "low";

export interface Criterion {
  id: string;
  job_id: string;
  criterion_name: string;
  criterion_type: CriterionType;
  weight: CriterionWeight;
  required: boolean;
  confidence_score: number | null;
  ai_extracted: boolean;
  extra_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ExtractionResponse {
  job_id: string;
  criteria: Criterion[];
  extracted_at: string;
  from_cache: boolean;
  embedding_stored: boolean;
}

export interface CriteriaSuggestion {
  criterion_name: string;
  criterion_type: CriterionType;
  weight: CriterionWeight;
  required: boolean;
  extra_data: Record<string, unknown> | null;
  similarity_score: number;
  source_job_id: string;
  source_job_title: string;
  usage_count: number;
}

export interface SuggestionsResponse {
  job_id: string;
  suggestions: CriteriaSuggestion[];
  similar_jobs_found: number;
  has_enough_history: boolean;
}

export interface CriterionCreate {
  criterion_name: string;
  criterion_type: CriterionType;
  weight: CriterionWeight;
  required: boolean;
  extra_data?: Record<string, unknown> | null;
}

export interface CriterionUpdate {
  criterion_name?: string;
  criterion_type?: CriterionType;
  weight?: CriterionWeight;
  required?: boolean;
  extra_data?: Record<string, unknown> | null;
}

export const criteriaApi = {
  extract: (jobId: string) =>
    api.post<ExtractionResponse>(`/jobs/${jobId}/extract-criteria`).then((r) => r.data),

  list: (jobId: string) =>
    api.get<Criterion[]>(`/jobs/${jobId}/criteria`).then((r) => r.data),

  needsReextraction: (jobId: string) =>
    api
      .get<{ needs_reextraction: boolean }>(`/jobs/${jobId}/criteria/needs-reextraction`)
      .then((r) => r.data.needs_reextraction),

  add: (jobId: string, data: CriterionCreate) =>
    api.post<Criterion>(`/jobs/${jobId}/criteria`, data).then((r) => r.data),

  update: (jobId: string, criterionId: string, data: CriterionUpdate) =>
    api.put<Criterion>(`/jobs/${jobId}/criteria/${criterionId}`, data).then((r) => r.data),

  remove: (jobId: string, criterionId: string) =>
    api.delete(`/jobs/${jobId}/criteria/${criterionId}`),

  suggestions: (jobId: string) =>
    api.get<SuggestionsResponse>(`/jobs/${jobId}/criteria-suggestions`).then((r) => r.data),
};

// ── Template types ────────────────────────────────────────────────────────────
export type TemplateScope = "personal" | "organization";

export interface TemplateCriterion {
  criterion_name: string;
  criterion_type: CriterionType;
  weight: CriterionWeight;
  required: boolean;
  extra_data?: Record<string, unknown> | null;
}

export interface TemplateData {
  title: string;
  description: string;
  department?: string | null;
  location?: string | null;
  type: JobType;
  criteria: TemplateCriterion[];
}

export interface JobTemplate {
  id: string;
  name: string;
  department: string | null;
  role_type: string | null;
  scope: TemplateScope;
  template_data: TemplateData;
  created_by: string | null;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export const templatesApi = {  list: (params?: { search?: string; department?: string }) =>
    api.get<JobTemplate[]>("/templates", { params }).then((r) => r.data),

  get: (id: string) => api.get<JobTemplate>(`/templates/${id}`).then((r) => r.data),

  apply: (id: string) => api.get<TemplateData>(`/templates/${id}/apply`).then((r) => r.data),

  delete: (id: string) => api.delete(`/templates/${id}`),

  saveFromJob: (jobId: string, name: string, scope: TemplateScope, role_type?: string) =>
    api.post<JobTemplate>(`/jobs/${jobId}/save-as-template`, { name, scope, role_type }).then((r) => r.data),
};

// ── Resume upload types ───────────────────────────────────────────────────────
export type UploadStatus = "queued" | "uploading" | "parsing" | "completed" | "failed";

export interface UploadUrlRequest {
  file_name: string;
  file_size_bytes: number;
  content_type: string;
  applicant_name?: string;
  applicant_email?: string;
}

export interface UploadUrlResponse {
  upload_id: string;
  presigned_url: string;
  file_key: string;
  expires_in: number;
}

export interface ResumeUpload {
  id: string;
  job_id: string;
  file_name: string | null;
  file_size_bytes: number | null;
  status: UploadStatus;
  error_message: string | null;
  candidate_id: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  uploaded_at: string;
  completed_at: string | null;
}

export interface BulkStatusResponse {
  job_id: string;
  total: number;
  queued: number;
  uploading: number;
  parsing: number;
  completed: number;
  failed: number;
  uploads: ResumeUpload[];
}

export interface CandidateDetail {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  raw_resume_text: string | null;
  parsing_confidence: number | null;
  parsing_errors: string[] | null;
  parsed_data: Record<string, unknown> | null;
  created_at: string;
}

export const resumesApi = {
  getUploadUrl: (jobId: string, req: UploadUrlRequest) =>
    api.post<UploadUrlResponse>(`/jobs/${jobId}/resumes/upload-url`, req).then((r) => r.data),

  triggerParse: (jobId: string, uploadId: string) =>
    api.post<ResumeUpload>(`/jobs/${jobId}/resumes/${uploadId}/parse`).then((r) => r.data),

  getBulkStatus: (jobId: string) =>
    api.get<BulkStatusResponse>(`/jobs/${jobId}/resumes/status`).then((r) => r.data),

  getUpload: (jobId: string, uploadId: string) =>
    api.get<ResumeUpload>(`/jobs/${jobId}/resumes/${uploadId}`).then((r) => r.data),

  getCandidate: (jobId: string, uploadId: string) =>
    api.get<CandidateDetail>(`/jobs/${jobId}/resumes/${uploadId}/candidate`).then((r) => r.data),

  reParse: (jobId: string, uploadId: string) =>
    api.post<ResumeUpload>(`/jobs/${jobId}/resumes/${uploadId}/reparse`).then((r) => r.data),
};

// ── Parsing error types (Story 02.7) ─────────────────────────────────────────

export interface ParsingError {
  id: string;
  upload_id: string;
  job_id: string | null;
  error_type: string;
  error_message: string | null;
  stage: string | null;
  status: string;
  resolved_at: string | null;
  resolution_method: string | null;
  discard_reason: string | null;
  created_at: string;
  file_name: string | null;
  applicant_name: string | null;
}

export interface ParsingErrorDetail extends ParsingError {
  raw_resume_text: string | null;
  candidate: CandidateDetail | null;
}

export interface ParsingErrorStats {
  job_id: string | null;
  total_uploads: number;
  failed: number;
  error_rate: number;
  high_error_rate: boolean;
  by_type: Record<string, number>;
}

export const parsingErrorsApi = {
  list: (params?: { job_id?: string; status?: string }) =>
    api.get<ParsingError[]>("/parsing-errors", { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<ParsingErrorDetail>(`/parsing-errors/${id}`).then((r) => r.data),

  stats: (job_id?: string) =>
    api.get<ParsingErrorStats>("/parsing-errors/stats", { params: job_id ? { job_id } : {} }).then((r) => r.data),

  retry: (id: string) =>
    api.post<ParsingError>(`/parsing-errors/${id}/retry`).then((r) => r.data),

  resolve: (id: string, data: { full_name?: string; email?: string; phone?: string; location?: string; skills?: string[]; notes?: string }) =>
    api.post<ParsingError>(`/parsing-errors/${id}/resolve`, data).then((r) => r.data),

  discard: (id: string, reason: string) =>
    api.post<ParsingError>(`/parsing-errors/${id}/discard`, { reason }).then((r) => r.data),
};

// ── Duplicate detection types (Story 02.6) ───────────────────────────────────

export interface CandidateSummary {
  id: string;
  full_name: string | null;
  email: string | null;
  location: string | null;
}

export interface DuplicateFlag {
  id: string;
  candidate_id_a: string;
  candidate_id_b: string;
  job_id: string | null;
  similarity_score: number | null;
  detection_method: string;
  status: string;
  reviewed_at: string | null;
  created_at: string;
  candidate_a: CandidateSummary | null;
  candidate_b: CandidateSummary | null;
}

export const duplicatesApi = {
  listPending: (jobId?: string) =>
    api.get<DuplicateFlag[]>("/duplicates/pending", { params: jobId ? { job_id: jobId } : {} }).then((r) => r.data),

  listForJob: (jobId: string) =>
    api.get<DuplicateFlag[]>(`/jobs/${jobId}/duplicates`).then((r) => r.data),

  confirm: (flagId: string) =>
    api.post<DuplicateFlag>(`/duplicates/${flagId}/confirm`).then((r) => r.data),

  dismiss: (flagId: string) =>
    api.post<DuplicateFlag>(`/duplicates/${flagId}/dismiss`).then((r) => r.data),
};

// ── Candidates API (Story 03.1) ───────────────────────────────────────────────

export const candidatesApi = {
  get: (candidateId: string) =>
    api.get<CandidateDetail>(`/candidates/${candidateId}`).then((r) => r.data),

  getResumeUrl: (candidateId: string) =>
    api.get<{ url: string; expires_in: number }>(`/candidates/${candidateId}/resume-url`).then((r) => r.data),

  getApplications: (candidateId: string) =>
    api.get<ApplicationHistory[]>(`/candidates/${candidateId}/applications`).then((r) => r.data),
};

// ── Candidate notes & tags (Story 03.2) ───────────────────────────────────────

export interface CandidateNote {
  id: string;
  candidate_id: string;
  job_id: string | null;
  author_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateTag {
  id: string;
  tag: string;
  added_at: string;
}

export interface ApplicationHistory {
  upload_id: string;
  job_id: string;
  job_title: string;
  job_status: string;
  status: string;
  uploaded_at: string;
  completed_at: string | null;
}

export const candidateNotesApi = {
  list: (candidateId: string) =>
    api.get<CandidateNote[]>(`/candidates/${candidateId}/notes`).then((r) => r.data),

  add: (candidateId: string, content: string, jobId?: string) =>
    api.post<CandidateNote>(`/candidates/${candidateId}/notes`, { content, job_id: jobId ?? null }).then((r) => r.data),

  update: (candidateId: string, noteId: string, content: string) =>
    api.put<CandidateNote>(`/candidates/${candidateId}/notes/${noteId}`, { content }).then((r) => r.data),

  remove: (candidateId: string, noteId: string) =>
    api.delete(`/candidates/${candidateId}/notes/${noteId}`),
};

export const candidateTagsApi = {
  list: (candidateId: string) =>
    api.get<CandidateTag[]>(`/candidates/${candidateId}/tags`).then((r) => r.data),

  add: (candidateId: string, tag: string) =>
    api.post<CandidateTag>(`/candidates/${candidateId}/tags`, { tag }).then((r) => r.data),

  remove: (candidateId: string, tagId: string) =>
    api.delete(`/candidates/${candidateId}/tags/${tagId}`),
};

// ── Candidate documents (Story 03.6) ──────────────────────────────────────────

export type DocType = "cover_letter" | "portfolio" | "certificate" | "other";

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  file_name: string;
  doc_type: DocType;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploaded_at: string;
}

export interface DocumentUploadUrlResponse {
  document_id: string;
  presigned_url: string;
  expires_in: number;
}

export const candidateDocumentsApi = {
  list: (candidateId: string) =>
    api.get<CandidateDocument[]>(`/candidates/${candidateId}/documents`).then((r) => r.data),

  getUploadUrl: (candidateId: string, payload: {
    file_name: string; file_size_bytes: number; mime_type: string; doc_type: DocType;
  }) =>
    api.post<DocumentUploadUrlResponse>(`/candidates/${candidateId}/documents/upload-url`, payload).then((r) => r.data),

  getDownloadUrl: (candidateId: string, documentId: string) =>
    api.get<{ url: string; expires_in: number; mime_type: string; file_name: string }>(
      `/candidates/${candidateId}/documents/${documentId}/url`
    ).then((r) => r.data),

  remove: (candidateId: string, documentId: string) =>
    api.delete(`/candidates/${candidateId}/documents/${documentId}`),
};

// ── Fit score types (Story 04.2) ──────────────────────────────────────────────

export interface FitScore {
  candidate_id: string;
  job_id: string;
  fit_score: number;
  score_breakdown: Record<string, unknown> | null;
  computed_at: string | null;
}

export interface CandidateRanking {
  candidate_id: string;
  fit_score: number;
  score_breakdown: Record<string, unknown> | null;
  computed_at: string | null;
  full_name: string | null;
  email: string | null;
  location: string | null;
  embedding_status: string | null;
  upload_id: string | null;
  is_overridden: boolean;
  override_score: number | null;
  override_justification: string | null;
  original_ai_score: number | null;
  technical_score: number | null;
  culture_score: number | null;
  growth_score: number | null;
}

export interface CandidateJobScore {
  job_id: string;
  fit_score: number;
  score_breakdown: Record<string, unknown> | null;
  computed_at: string | null;
  job_title: string;
  job_status: string;
  is_overridden: boolean;
  override_score: number | null;
  override_justification: string | null;
  original_ai_score: number | null;
  technical_score: number | null;
  culture_score: number | null;
  growth_score: number | null;
}

export interface FitCriterion {
  criterion: string;
  type: string;
  weight: string;
  required: boolean;
  match?: "exact" | "semantic" | "partial" | "met" | "keyword" | "degree_met" | "found";
  candidate_years?: number;
  required_years?: number;
  candidate_degree?: string | null;
}

export interface FitExplanation {
  candidate_id: string;
  job_id: string;
  job_title: string;
  candidate_name: string | null;
  fit_score: number | null;
  summary: {
    total_criteria: number;
    matched: number;
    partial: number;
    missing: number;
    match_rate: number | null;
  };
  candidate_profile: {
    total_years_experience: number | null;
    highest_degree: string | null;
    skill_count: number;
    top_skills: string[];
  };
  matched_criteria: FitCriterion[];
  partial_criteria: FitCriterion[];
  missing_criteria: FitCriterion[];
  required_skills_missing: string[];
  optional_skills_missing: string[];
}

export const fitScoreApi = {
  scoreOne: (candidateId: string, jobId: string) =>
    api.post<FitScore>(`/candidates/${candidateId}/score/${jobId}`).then((r) => r.data),

  scoreAll: (jobId: string) =>
    api.post<{ status: string; scored: number; skipped: number; errors: number }>(`/jobs/${jobId}/score-all`).then((r) => r.data),

  getRankings: (jobId: string, sortBy?: string) =>
    api.get<CandidateRanking[]>(`/jobs/${jobId}/rankings`, { params: sortBy ? { sort_by: sortBy } : {} }).then((r) => r.data),

  getCandidateScores: (candidateId: string) =>
    api.get<CandidateJobScore[]>(`/candidates/${candidateId}/scores`).then((r) => r.data),

  explain: (candidateId: string, jobId: string) =>
    api.get<FitExplanation>(`/candidates/${candidateId}/score/${jobId}/explain`).then((r) => r.data),

  override: (candidateId: string, jobId: string, override_score: number, justification: string) =>
    api.post(`/candidates/${candidateId}/score/${jobId}/override`, { override_score, justification }).then((r) => r.data),

  resetOverride: (candidateId: string, jobId: string) =>
    api.delete(`/candidates/${candidateId}/score/${jobId}/override`).then((r) => r.data),

  triggerRecalculation: (jobId: string) =>
    api.post<{ status: string; job_id: string }>(`/jobs/${jobId}/recalculate-scores`).then((r) => r.data),

  getRecalculationStatus: (jobId: string) =>
    api.get<RecalculationStatus>(`/jobs/${jobId}/recalculation-status`).then((r) => r.data),
};

export interface RecalculationStatus {
  job_id: string;
  status: "idle" | "pending" | "running" | "completed" | "failed";
  total: number;
  scored: number;
  errors: number;
  started_at: string | null;
  completed_at: string | null;
  triggered_by: string | null;
  progress_pct: number;
}

// ── Shortlist types (Epic 05) ─────────────────────────────────────────────────

export interface ShortlistCandidate {
  id: string;
  candidate_id: string;
  rank: number;
  fit_score: number;
  confidence_level: "High" | "Medium" | "Low";
  reasoning: string | null;
  action: "accepted" | "rejected" | "deferred" | null;
  action_taken_at: string | null;
  rejection_reason: string | null;
  full_name: string | null;
  email: string | null;
  technical_score: number | null;
  culture_score: number | null;
  growth_score: number | null;
  total_years_experience: number | null;
  top_skills: string[];
}

export interface NearMissCandidate {
  candidate_id: string;
  fit_score: number;
  gap_to_threshold: number;
  explanation: string;
  full_name: string | null;
  email: string | null;
  technical_score: number | null;
  culture_score: number | null;
  growth_score: number | null;
  total_years_experience: number | null;
  top_skills: string[];
}

export interface NearMissResponse {
  threshold_score: number;
  threshold_n: number;
  window: number;
  near_misses: NearMissCandidate[];
}

export interface FeedbackStats {
  job_id: string;
  accepted_count: number;
  rejected_count: number;
  total_signals: number;
  min_signals_required: number;
  learned_weights: Record<string, number> | null;
  signal_count_used: number;
  computed_at: string | null;
  is_personalized: boolean;
}

export interface Shortlist {
  shortlist_id: string;
  job_id: string;
  status: "active" | "outdated" | "complete" | "not_generated";
  threshold_n: number | null;
  threshold_score: number | null;
  total_candidates_scored: number;
  shortlisted_count: number;
  generated_at: string | null;
  notice: string | null;
  candidates: ShortlistCandidate[];
}

// ── Shortlist API ─────────────────────────────────────────────────────────────

export const shortlistApi = {
  generate: (jobId: string, n?: number) =>
    api.post<Shortlist>(`/jobs/${jobId}/shortlist/generate`, null, { params: n ? { n } : {} }).then((r) => r.data),

  get: (jobId: string) =>
    api.get<Shortlist>(`/jobs/${jobId}/shortlist`).then((r) => r.data),

  updateConfig: (jobId: string, n: number) =>
    api.patch<Shortlist>(`/jobs/${jobId}/shortlist/config`, { n }).then((r) => r.data),

  generateAllReasoning: (jobId: string) =>
    api.post(`/jobs/${jobId}/shortlist/generate-all-reasoning`).then((r) => r.data),

  generateReasoning: (jobId: string, scId: string) =>
    api.post(`/jobs/${jobId}/shortlist/candidates/${scId}/reasoning`).then((r) => r.data),

  takeAction: (jobId: string, scId: string, action: "accepted" | "rejected" | "deferred", reason?: string) =>
    api.post(`/jobs/${jobId}/shortlist/candidates/${scId}/action`, { action, reason }).then((r) => r.data),

  bulkAction: (jobId: string, shortlist_candidate_ids: string[], action: string, reason?: string) =>
    api.post(`/jobs/${jobId}/shortlist/bulk-action`, { shortlist_candidate_ids, action, reason }).then((r) => r.data),

  // 05.5 — Near-miss
  getNearMisses: (jobId: string, window?: number) =>
    api.get<NearMissResponse>(`/jobs/${jobId}/shortlist/near-misses`, { params: window ? { window } : {} }).then((r) => r.data),

  promoteNearMiss: (jobId: string, candidateId: string) =>
    api.post(`/jobs/${jobId}/shortlist/near-misses/promote`, { candidate_id: candidateId }).then((r) => r.data),

  // 05.4 — Feedback loop
  getFeedbackStats: (jobId: string) =>
    api.get<FeedbackStats>(`/jobs/${jobId}/shortlist/feedback/stats`).then((r) => r.data),

  optimizeWeights: (jobId: string) =>
    api.post(`/jobs/${jobId}/shortlist/feedback/optimize`).then((r) => r.data),

  resetWeights: (jobId: string) =>
    api.post(`/jobs/${jobId}/shortlist/feedback/reset`).then((r) => r.data),
};

// ── Auth types & API (Epic 12) ────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  mfa_enabled: boolean;
  last_login: string | null;
  created_at: string;
}

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<TokenResponse>("/auth/login", data).then((r) => r.data),

  refresh: (refresh_token: string) =>
    api.post<TokenResponse>("/auth/refresh", { refresh_token }).then((r) => r.data),

  logout: () => api.post("/auth/logout"),

  me: () => api.get<CurrentUser>("/auth/me").then((r) => r.data),

  changePassword: (current_password: string, new_password: string) =>
    api.put("/auth/me/password", { current_password, new_password }),

  requestPasswordReset: (email: string) =>
    api.post("/auth/password-reset/request", { email }),

  confirmPasswordReset: (token: string, new_password: string) =>
    api.post("/auth/password-reset/confirm", { token, new_password }),
};

// ── Pipeline types & API (Epic 09) ────────────────────────────────────────────

export interface PipelineStage {
  id: string;
  job_id: string;
  name: string;
  order: number;
  color: string | null;
  is_terminal: boolean;
  created_at: string;
}

export interface PipelineCandidate {
  placement_id: string;
  candidate_id: string;
  full_name: string | null;
  email: string | null;
  moved_at: string | null;
  moved_by: string | null;
}

export interface PipelineColumn {
  id: string;
  name: string;
  order: number;
  color: string | null;
  is_terminal: boolean;
  candidates: PipelineCandidate[];
}

export interface PipelineAuditEntry {
  id: string;
  candidate_id: string;
  job_id: string;
  from_stage_id: string | null;
  to_stage_id: string | null;
  moved_by: string | null;
  note: string | null;
  moved_at: string;
}

export const pipelineApi = {
  getBoard: (jobId: string) =>
    api.get<PipelineColumn[]>(`/jobs/${jobId}/pipeline`).then((r) => r.data),

  getStages: (jobId: string) =>
    api.get<PipelineStage[]>(`/jobs/${jobId}/pipeline/stages`).then((r) => r.data),

  moveCandidate: (jobId: string, candidate_id: string, stage_id: string, note?: string) =>
    api.post(`/jobs/${jobId}/pipeline/move`, { candidate_id, stage_id, note }).then((r) => r.data),

  bulkMove: (jobId: string, candidate_ids: string[], stage_id: string, note?: string) =>
    api.post(`/jobs/${jobId}/pipeline/bulk-move`, { candidate_ids, stage_id, note }).then((r) => r.data),

  getAudit: (jobId: string, candidate_id?: string) =>
    api.get<PipelineAuditEntry[]>(`/jobs/${jobId}/pipeline/audit`, {
      params: candidate_id ? { candidate_id } : {},
    }).then((r) => r.data),
};
