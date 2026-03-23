"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, LayoutTemplate } from "lucide-react";

import { jobCreateSchema, JobCreateFormValues } from "@/lib/validations/job";
import { jobsApi, type TemplateData } from "@/lib/api";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { TemplateBrowser } from "@/components/jobs/template-browser";

const JOB_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

const AUTO_SAVE_MS = 30_000;

const inputStyle = {
  width: "100%", padding: "9px 12px", fontSize: 13,
  border: "1px solid #d1d5db", borderRadius: 8, outline: "none",
  background: "#fff", color: "#111827", boxSizing: "border-box" as const,
  transition: "border-color 0.15s",
};

const labelStyle = {
  display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6,
};

const errorStyle = { fontSize: 11, color: "#dc2626", marginTop: 4 };

export function CreateJobForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  // Store pending template data in a ref so we can apply it after the browser unmounts
  const pendingTemplate = useRef<{ data: TemplateData; id: string } | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<JobCreateFormValues>({
    resolver: zodResolver(jobCreateSchema),
    defaultValues: { title: "", description: "", department: "", location: "", type: "full-time" },
  });

  // Called by TemplateBrowser — just stores data, doesn't touch form yet
  const onTemplateApply = (data: TemplateData, templateId: string) => {
    pendingTemplate.current = { data, id: templateId };
  };

  // Called when TemplateBrowser closes — now safe to update form
  const onTemplateBrowserClose = () => {
    setShowTemplateBrowser(false);
    const pending = pendingTemplate.current;
    if (!pending) return;
    pendingTemplate.current = null;

    const { data, id } = pending;
    setAppliedTemplateId(id);

    // Use setValue per-field (more reliable than reset() with Tiptap)
    setValue("title", data.title, { shouldDirty: true, shouldValidate: false });
    setValue("department", data.department ?? "", { shouldDirty: true });
    setValue("location", data.location ?? "", { shouldDirty: true });
    setValue("type", (data.type as JobCreateFormValues["type"]) ?? "full-time", { shouldDirty: true });
    setValue("description", data.description, { shouldDirty: true, shouldValidate: false });

    // Bump key to remount RichTextEditor with the new description value
    setEditorKey((k) => k + 1);
    toast.success(`Template applied — ${data.criteria.length} criteria ready`);
  };

  const saveDraftMutation = useMutation({
    mutationFn: (data: JobCreateFormValues) =>
      jobsApi.create({ ...data, ...(appliedTemplateId ? { template_id: appliedTemplateId } : {}) }),
    onSuccess: (job) => {
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      return job;
    },
    onError: () => toast.error("Failed to save draft"),
  });

  const formValues = watch();
  useEffect(() => {
    if (!isDirty) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      const result = jobCreateSchema.safeParse(formValues);
      if (result.success) {
        await saveDraftMutation.mutateAsync(result.data);
        toast.info("Draft auto-saved", { duration: 2000 });
      }
    }, AUTO_SAVE_MS);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [formValues, isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSaveDraft = handleSubmit(async (data) => {
    const job = await saveDraftMutation.mutateAsync(data);
    toast.success(appliedTemplateId ? "Job created with template criteria" : "Job draft saved");
    router.push(`/jobs/${job.id}`);
  });

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Template shortcut */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => setShowTemplateBrowser(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 600, padding: "7px 14px",
            background: "#eef2ff", color: "#4f46e5",
            border: "1px solid #c7d2fe", borderRadius: 8, cursor: "pointer",
          }}
        >
          <LayoutTemplate size={13} /> Use Template
        </button>
      </div>

      {showTemplateBrowser && (
        <TemplateBrowser
          onApply={onTemplateApply}
          onClose={onTemplateBrowserClose}
        />
      )}

      {/* Title */}
      <div>
        <label style={labelStyle}>
          Job Title <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <input
          {...register("title")}
          placeholder="e.g. Senior Backend Engineer"
          style={{ ...inputStyle, borderColor: errors.title ? "#ef4444" : "#d1d5db" }}
        />
        {errors.title && <p style={errorStyle}>{errors.title.message}</p>}
      </div>

      {/* Type / Dept / Location */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>
            Job Type <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                style={{ ...inputStyle, borderColor: errors.type ? "#ef4444" : "#d1d5db" }}
              >
                {JOB_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
          />
          {errors.type && <p style={errorStyle}>{errors.type.message}</p>}
        </div>
        <div>
          <label style={labelStyle}>Department</label>
          <input
            {...register("department")}
            placeholder="e.g. Engineering"
            style={{ ...inputStyle, borderColor: errors.department ? "#ef4444" : "#d1d5db" }}
          />
        </div>
        <div>
          <label style={labelStyle}>Location</label>
          <input
            {...register("location")}
            placeholder="e.g. Remote, New York"
            style={{ ...inputStyle, borderColor: errors.location ? "#ef4444" : "#d1d5db" }}
          />
        </div>
      </div>

      {/* Description */}
      <Controller
        name="description"
        control={control}
        render={({ field }) => (
          <RichTextEditor
            key={editorKey}
            label="Job Description"
            required
            value={field.value}
            onChange={field.onChange}
            error={errors.description?.message}
            placeholder="Describe the role, responsibilities, and requirements..."
          />
        )}
      />

      {/* Auto-save indicator */}
      {lastSaved && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#059669" }}>
          <CheckCircle2 size={13} />
          Saved at {lastSaved.toLocaleTimeString()}
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 20, borderTop: "1px solid #f3f4f6",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af" }}>
          <Clock size={12} />
          Auto-saves every 30s
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => router.push("/jobs")}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 500,
              background: "#fff", color: "#374151", border: "1px solid #d1d5db",
              borderRadius: 8, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saveDraftMutation.isPending}
            style={{
              padding: "8px 20px", fontSize: 13, fontWeight: 600,
              background: saveDraftMutation.isPending ? "#818cf8" : "#4f46e5",
              color: "#fff", border: "none", borderRadius: 8, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              boxShadow: "0 1px 3px rgba(79,70,229,0.3)",
            }}
          >
            {saveDraftMutation.isPending && (
              <svg style={{ animation: "spin 1s linear infinite", width: 14, height: 14 }} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Save as Draft
          </button>
        </div>
      </div>
    </form>
  );
}
