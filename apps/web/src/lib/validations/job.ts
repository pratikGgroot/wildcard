import { z } from "zod";

// Strip HTML tags to get plain text length for validation
function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

const descriptionSchema = z
  .string()
  .refine((v) => stripHtml(v).length >= 50, "Description must be at least 50 characters")
  .refine((v) => stripHtml(v).length <= 10000, "Description must be at most 10,000 characters");

export const jobCreateSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must be at most 200 characters"),
  description: descriptionSchema,
  department: z.string().max(100).optional().or(z.literal("")),
  location: z.string().max(100).optional().or(z.literal("")),
  type: z.enum(["full-time", "contract", "internship"], {
    required_error: "Job type is required",
  }),
  template_id: z.string().uuid().optional(),
});

export type JobCreateFormValues = z.infer<typeof jobCreateSchema>;

export const jobUpdateSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must be at most 200 characters"),
  description: descriptionSchema,
  department: z.string().max(100).optional().or(z.literal("")),
  location: z.string().max(100).optional().or(z.literal("")),
  type: z.enum(["full-time", "contract", "internship"]).optional(),
});

export type JobUpdateFormValues = z.infer<typeof jobUpdateSchema>;
