"use client";

import { useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Building2, Briefcase, ArrowLeft, Upload, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { jobsApi, resumesApi, type UploadStatus } from "@/lib/api";

const ALLOWED_TYPES: Record<string, boolean> = {
  "application/pdf": true,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
  "application/msword": true,
  "application/zip": true,
  "application/x-zip-compressed": true,
};
const MAX_SIZE = 10 * 1024 * 1024;

type ApplyStep = "form" | "uploading" | "success" | "error";

interface FormState {
  name: string;
  email: string;
  file: File | null;
  fileError: string;
}

function formatBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PublicJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();

  const { data: job, isLoading } = useQuery({
    queryKey: ["public-job", jobId],
    queryFn: () => jobsApi.get(jobId),
  });

  const [step, setStep] = useState<ApplyStep>("form");
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    file: null,
    fileError: "",
  });

  const handleFile = useCallback((file: File) => {
    if (!ALLOWED_TYPES[file.type]) {
      setForm((f) => ({ ...f, file: null, fileError: "Unsupported format. Use PDF, DOCX, or ZIP." }));
      return;
    }
    if (file.size > MAX_SIZE) {
      setForm((f) => ({ ...f, file: null, fileError: `File exceeds 10MB (${formatBytes(file.size)})` }));
      return;
    }
    setForm((f) => ({ ...f, file, fileError: "" }));
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.file) return;

    setStep("uploading");
    setUploadProgress("Requesting upload URL...");

    try {
      // 1. Get presigned URL
      const { upload_id, presigned_url } = await resumesApi.getUploadUrl(jobId, {
        file_name: form.file.name,
        file_size_bytes: form.file.size,
        content_type: form.file.type,
        applicant_name: form.name.trim(),
        applicant_email: form.email.trim(),
      });

      setUploadProgress("Uploading resume...");

      // 2. PUT to MinIO
      const putRes = await fetch(presigned_url, {
        method: "PUT",
        body: form.file,
        headers: { "Content-Type": form.file.type },
      });

      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      setUploadProgress("Processing your application...");

      // 3. Trigger parse
      await resumesApi.triggerParse(jobId, upload_id);

      setStep("success");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Something went wrong. Please try again.");
      setStep("error");
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f9fafb" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #e0e7ff", borderTopColor: "#4f46e5", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!job || job.status !== "active") {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Briefcase size={28} color="#9ca3af" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Position Not Available</h2>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px" }}>This job posting is no longer accepting applications.</p>
          <Link href="/careers" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "#4f46e5", textDecoration: "none" }}>
            <ArrowLeft size={14} /> View all openings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", padding: "40px 24px 60px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Link href="/careers" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#c7d2fe", textDecoration: "none", marginBottom: 24 }}>
            <ArrowLeft size={13} /> All openings
          </Link>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>{job.title}</h1>
          <div style={{ display: "flex", gap: 16, fontSize: 14, color: "#c7d2fe", flexWrap: "wrap" }}>
            {job.department && (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Building2 size={14} /> {job.department}
              </span>
            )}
            {job.location && (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={14} /> {job.location}
              </span>
            )}
            <span style={{ background: "rgba(255,255,255,0.15)", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const }}>
              {job.type}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: "-24px auto 0", padding: "0 24px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

          {/* Job description */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>About this role</h2>
            <div
              style={{ fontSize: 14, lineHeight: 1.75, color: "#374151" }}
              dangerouslySetInnerHTML={{ __html: job.description }}
            />
          </div>

          {/* Apply form */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", position: "sticky", top: 24 }}>
            {step === "form" && (
              <ApplyForm
                form={form}
                setForm={setForm}
                dragging={dragging}
                setDragging={setDragging}
                inputRef={inputRef}
                handleFile={handleFile}
                onDrop={onDrop}
                onSubmit={handleSubmit}
              />
            )}
            {step === "uploading" && <UploadingState progress={uploadProgress} />}
            {step === "success" && <SuccessState jobTitle={job.title} />}
            {step === "error" && (
              <ErrorState
                message={errorMsg}
                onRetry={() => { setStep("form"); setErrorMsg(""); }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ApplyFormProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  handleFile: (f: File) => void;
  onDrop: (e: React.DragEvent) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function ApplyForm({ form, setForm, dragging, setDragging, inputRef, handleFile, onDrop, onSubmit }: ApplyFormProps) {
  const valid = form.name.trim() && form.email.trim() && form.file && !form.fileError;

  return (
    <form onSubmit={onSubmit}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 20px" }}>Apply Now</h3>

      {/* Name */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
          Full Name <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Jane Smith"
          style={{
            width: "100%", padding: "9px 12px", fontSize: 13,
            border: "1px solid #d1d5db", borderRadius: 8, outline: "none",
            boxSizing: "border-box" as const, color: "#111827",
          }}
        />
      </div>

      {/* Email */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
          Email Address <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="jane@example.com"
          style={{
            width: "100%", padding: "9px 12px", fontSize: 13,
            border: "1px solid #d1d5db", borderRadius: 8, outline: "none",
            boxSizing: "border-box" as const, color: "#111827",
          }}
        />
      </div>

      {/* Resume upload */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
          Resume <span style={{ color: "#dc2626" }}>*</span>
        </label>

        {form.file ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px", borderRadius: 10,
            background: "#f0fdf4", border: "1px solid #bbf7d0",
          }}>
            <FileText size={16} color="#16a34a" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {form.file.name}
              </p>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>{formatBytes(form.file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, file: null, fileError: "" }))}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 2 }}
            >
              <XCircle size={16} />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "#4f46e5" : "#d1d5db"}`,
              borderRadius: 10, padding: "24px 16px", textAlign: "center",
              cursor: "pointer", background: dragging ? "#eef2ff" : "#fafafa",
              transition: "all 0.15s",
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.doc,.zip"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Upload size={20} color={dragging ? "#4f46e5" : "#9ca3af"} style={{ margin: "0 auto 8px", display: "block" }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: dragging ? "#4f46e5" : "#374151", margin: "0 0 3px" }}>
              {dragging ? "Drop here" : "Upload resume"}
            </p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>PDF, DOCX, ZIP · Max 10MB</p>
          </div>
        )}

        {form.fileError && (
          <p style={{ fontSize: 12, color: "#dc2626", margin: "6px 0 0" }}>{form.fileError}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={!valid}
        style={{
          width: "100%", padding: "11px 0", fontSize: 14, fontWeight: 700,
          background: valid ? "linear-gradient(135deg, #4f46e5, #7c3aed)" : "#e5e7eb",
          color: valid ? "#fff" : "#9ca3af",
          border: "none", borderRadius: 10, cursor: valid ? "pointer" : "not-allowed",
          transition: "all 0.15s",
        }}
      >
        Submit Application
      </button>

      <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", margin: "12px 0 0" }}>
        Your information is kept confidential.
      </p>
    </form>
  );
}

function UploadingState({ progress }: { progress: string }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 16px" }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        border: "3px solid #e0e7ff", borderTopColor: "#4f46e5",
        animation: "spin 0.8s linear infinite",
        margin: "0 auto 16px",
      }} />
      <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 6px" }}>Submitting application...</p>
      <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{progress}</p>
    </div>
  );
}

function SuccessState({ jobTitle }: { jobTitle: string }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 16px" }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: "#f0fdf4", border: "2px solid #bbf7d0",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 16px",
      }}>
        <CheckCircle2 size={28} color="#16a34a" />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Application Submitted</h3>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>
        Thanks for applying to <strong>{jobTitle}</strong>. We'll review your resume and be in touch soon.
      </p>
      <Link
        href="/careers"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 600, color: "#4f46e5",
          background: "#eef2ff", padding: "8px 16px", borderRadius: 8,
          textDecoration: "none",
        }}
      >
        <ArrowLeft size={13} /> View more openings
      </Link>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 16px" }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: "#fef2f2", border: "2px solid #fecaca",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 16px",
      }}>
        <XCircle size={28} color="#dc2626" />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Submission Failed</h3>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          padding: "9px 20px", fontSize: 13, fontWeight: 600,
          background: "#4f46e5", color: "#fff",
          border: "none", borderRadius: 8, cursor: "pointer",
        }}
      >
        Try Again
      </button>
    </div>
  );
}
