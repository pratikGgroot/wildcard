"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload, FileText, CheckCircle2, XCircle, Loader2,
  Clock, Users, AlertTriangle, RefreshCw,
} from "lucide-react";
import { resumesApi, type ResumeUpload, type UploadStatus } from "@/lib/api";

interface Props {
  jobId: string;
}

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
};
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface FileEntry {
  file: File;
  uploadId?: string;
  status: UploadStatus | "validating" | "uploading_to_s3";
  error?: string;
  progress?: number;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  validating:      { icon: Loader2,      color: "#6b7280", label: "Validating..." },
  uploading_to_s3: { icon: Loader2,      color: "#4f46e5", label: "Uploading..." },
  queued:          { icon: Clock,        color: "#d97706", label: "Queued" },
  uploading:       { icon: Loader2,      color: "#4f46e5", label: "Uploading" },
  parsing:         { icon: Loader2,      color: "#7c3aed", label: "Parsing..." },
  completed:       { icon: CheckCircle2, color: "#16a34a", label: "Done" },
  failed:          { icon: XCircle,      color: "#dc2626", label: "Failed" },
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResumeUploadPanel({ jobId }: Props) {
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Poll bulk status every 3s when there are active uploads
  const hasActive = entries.some((e) =>
    ["uploading_to_s3", "queued", "uploading", "parsing"].includes(e.status)
  );

  const { data: bulkStatus } = useQuery({
    queryKey: ["resume-bulk-status", jobId],
    queryFn: () => resumesApi.getBulkStatus(jobId),
    refetchInterval: hasActive ? 3000 : false,
    staleTime: 2000,
  });

  const updateEntry = useCallback((file: File, patch: Partial<FileEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.file === file ? { ...e, ...patch } : e))
    );
  }, []);

  const processFile = useCallback(async (file: File) => {
    // Validate
    if (!ALLOWED_TYPES[file.type]) {
      setEntries((prev) => [
        ...prev,
        { file, status: "failed", error: `Unsupported format. Use PDF, DOCX, or ZIP.` },
      ]);
      return;
    }
    if (file.size > MAX_SIZE) {
      setEntries((prev) => [
        ...prev,
        { file, status: "failed", error: `File exceeds 10MB limit (${formatBytes(file.size)})` },
      ]);
      return;
    }

    setEntries((prev) => [...prev, { file, status: "validating" }]);

    try {
      // 1. Get presigned URL
      const { upload_id, presigned_url } = await resumesApi.getUploadUrl(jobId, {
        file_name: file.name,
        file_size_bytes: file.size,
        content_type: file.type,
      });

      updateEntry(file, { uploadId: upload_id, status: "uploading_to_s3" });

      // 2. PUT directly to MinIO
      const putRes = await fetch(presigned_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);

      updateEntry(file, { status: "queued" });

      // 3. Trigger parse
      await resumesApi.triggerParse(jobId, upload_id);
      updateEntry(file, { status: "parsing" });

      queryClient.invalidateQueries({ queryKey: ["resume-bulk-status", jobId] });
    } catch (err: any) {
      updateEntry(file, { status: "failed", error: err?.message ?? "Upload failed" });
      toast.error(`Failed: ${file.name}`);
    }
  }, [jobId, queryClient, updateEntry]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(processFile);
  }, [processFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const summary = entries.length > 0 ? {
    completed: entries.filter((e) => e.status === "completed").length,
    failed: entries.filter((e) => e.status === "failed").length,
    active: entries.filter((e) => ["uploading_to_s3", "queued", "uploading", "parsing"].includes(e.status)).length,
  } : null;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg, #eef2ff, #f5f3ff)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Users size={15} color="#4f46e5" />
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Resume Upload</span>
            {bulkStatus && bulkStatus.total > 0 && (
              <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>
                {bulkStatus.completed} processed · {bulkStatus.total} total
              </span>
            )}
          </div>
        </div>
        {entries.length > 0 && (
          <button
            onClick={() => setEntries([])}
            style={{
              fontSize: 12, color: "#6b7280", background: "transparent",
              border: "1px solid #e5e7eb", borderRadius: 7, padding: "4px 10px", cursor: "pointer",
            }}
          >
            Clear list
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#4f46e5" : "#d1d5db"}`,
          borderRadius: 14,
          padding: "36px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "#eef2ff" : "#fafafa",
          transition: "all 0.15s",
          marginBottom: 20,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.zip"
          style={{ display: "none" }}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: dragging ? "#e0e7ff" : "#f3f4f6",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 12px",
        }}>
          <Upload size={20} color={dragging ? "#4f46e5" : "#9ca3af"} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: dragging ? "#4f46e5" : "#374151", margin: "0 0 4px" }}>
          {dragging ? "Drop files here" : "Drag & drop resumes here"}
        </p>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
          PDF, DOCX, ZIP · Max 10MB per file · Click to browse
        </p>
      </div>

      {/* Summary bar */}
      {summary && (
        <div style={{
          display: "flex", gap: 12, padding: "10px 14px", borderRadius: 10,
          background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 16,
          fontSize: 12, flexWrap: "wrap",
        }}>
          <span style={{ color: "#6b7280" }}>{entries.length} file{entries.length !== 1 ? "s" : ""}</span>
          {summary.active > 0 && (
            <span style={{ color: "#7c3aed", display: "flex", alignItems: "center", gap: 4 }}>
              <Loader2 size={11} /> {summary.active} processing
            </span>
          )}
          {summary.completed > 0 && (
            <span style={{ color: "#16a34a", display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={11} /> {summary.completed} done
            </span>
          )}
          {summary.failed > 0 && (
            <span style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: 4 }}>
              <XCircle size={11} /> {summary.failed} failed
            </span>
          )}
        </div>
      )}

      {/* File list */}
      {entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {entries.map((entry, i) => {
            const cfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.queued;
            const Icon = cfg.icon;
            const spinning = ["validating", "uploading_to_s3", "uploading", "parsing"].includes(entry.status);
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 10,
                background: "#fff", border: "1px solid #f3f4f6",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "#f3f4f6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <FileText size={15} color="#6b7280" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.file.name}
                  </p>
                  <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>
                    {formatBytes(entry.file.size)}
                    {entry.error && <span style={{ color: "#dc2626", marginLeft: 6 }}>{entry.error}</span>}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <Icon
                    size={14}
                    color={cfg.color}
                    style={spinning ? { animation: "spin 1s linear infinite" } : undefined}
                  />
                  <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Historical uploads from DB */}
      {bulkStatus && bulkStatus.uploads.length > 0 && entries.length === 0 && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Previous Uploads
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {bulkStatus.uploads.map((u) => {
              const cfg = STATUS_CONFIG[u.status] ?? STATUS_CONFIG.queued;
              const Icon = cfg.icon;
              return (
                <div key={u.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 10,
                  background: "#fff", border: "1px solid #f3f4f6",
                }}>
                  <FileText size={15} color="#6b7280" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#111827", margin: 0 }}>
                      {u.file_name ?? "Resume"}
                    </p>
                    <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>
                      {u.file_size_bytes ? formatBytes(u.file_size_bytes) : ""}
                      {u.error_message && <span style={{ color: "#dc2626", marginLeft: 6 }}>{u.error_message}</span>}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Icon size={14} color={cfg.color} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && (!bulkStatus || bulkStatus.total === 0) && (
        <div style={{ textAlign: "center", padding: "24px 0", color: "#9ca3af", fontSize: 13 }}>
          No resumes uploaded yet for this job.
        </div>
      )}
    </div>
  );
}
