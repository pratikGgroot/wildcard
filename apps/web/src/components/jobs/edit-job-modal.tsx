"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { jobsApi, type Job } from "@/lib/api";
import { jobUpdateSchema, JobUpdateFormValues } from "@/lib/validations/job";
import { Modal } from "@/components/ui/modal";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

const JOB_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

const inputStyle = {
  width: "100%", padding: "9px 12px", fontSize: 13,
  border: "1px solid #d1d5db", borderRadius: 8, outline: "none",
  background: "#fff", color: "#111827", boxSizing: "border-box" as const,
};

const labelStyle = {
  display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6,
};

interface Props {
  job: Job;
  onClose: () => void;
}

export function EditJobModal({ job, onClose }: Props) {
  const queryClient = useQueryClient();

  const { register, control, handleSubmit, reset, formState: { errors, isDirty } } =
    useForm<JobUpdateFormValues>({
      resolver: zodResolver(jobUpdateSchema),
      defaultValues: {
        title: job.title,
        description: job.description,
        department: job.department ?? "",
        location: job.location ?? "",
        type: job.type as JobUpdateFormValues["type"],
      },
    });

  // Reset form if job changes (e.g. navigating between jobs)
  useEffect(() => {
    reset({
      title: job.title,
      description: job.description,
      department: job.department ?? "",
      location: job.location ?? "",
      type: job.type as JobUpdateFormValues["type"],
    });
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMutation = useMutation({
    mutationFn: (data: JobUpdateFormValues) => jobsApi.update(job.id, data),
    onSuccess: () => {
      toast.success("Job updated — AI criteria refreshing in background");
      queryClient.invalidateQueries({ queryKey: ["job", job.id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["criteria", job.id] });
      queryClient.invalidateQueries({ queryKey: ["criteria-stale", job.id] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Update failed"),
  });

  const onSubmit = handleSubmit((data) => updateMutation.mutate(data));

  return (
    <Modal open title="Edit Job Posting" onClose={onClose} wide>
      <form noValidate onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Title */}
        <div>
          <label style={labelStyle}>
            Job Title <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            {...register("title")}
            style={{ ...inputStyle, borderColor: errors.title ? "#ef4444" : "#d1d5db" }}
          />
          {errors.title && <p style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{errors.title.message}</p>}
        </div>

        {/* Type / Dept / Location */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Job Type</label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <select {...field} style={inputStyle}>
                  {JOB_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            />
          </div>
          <div>
            <label style={labelStyle}>Department</label>
            <input {...register("department")} placeholder="e.g. Engineering" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input {...register("location")} placeholder="e.g. Remote" style={inputStyle} />
          </div>
        </div>

        {/* Description */}
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <RichTextEditor
              label="Job Description"
              required
              value={field.value ?? ""}
              onChange={field.onChange}
              error={errors.description?.message}
            />
          )}
        />

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8, borderTop: "1px solid #f3f4f6" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 500,
              background: "#fff", color: "#374151", border: "1px solid #d1d5db",
              borderRadius: 8, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending || !isDirty}
            style={{
              padding: "8px 20px", fontSize: 13, fontWeight: 600,
              background: updateMutation.isPending || !isDirty ? "#818cf8" : "#4f46e5",
              color: "#fff", border: "none", borderRadius: 8,
              cursor: updateMutation.isPending || !isDirty ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {updateMutation.isPending && (
              <div style={{
                width: 12, height: 12, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff",
                animation: "spin 0.8s linear infinite",
              }} />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
}
