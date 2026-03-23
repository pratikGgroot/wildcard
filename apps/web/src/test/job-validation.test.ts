import { describe, it, expect } from "vitest";
import { jobCreateSchema } from "@/lib/validations/job";

describe("Job creation validation", () => {
  const validJob = {
    title: "Senior Backend Engineer",
    description:
      "We are looking for a senior backend engineer with 5+ years of Python experience and strong distributed systems knowledge.",
    department: "Engineering",
    location: "Remote",
    type: "full-time" as const,
  };

  it("accepts a valid job", () => {
    expect(jobCreateSchema.safeParse(validJob).success).toBe(true);
  });

  it("rejects title shorter than 5 chars", () => {
    const result = jobCreateSchema.safeParse({ ...validJob, title: "Dev" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/5/);
    }
  });

  it("rejects title longer than 200 chars", () => {
    const result = jobCreateSchema.safeParse({ ...validJob, title: "A".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects description shorter than 50 chars", () => {
    const result = jobCreateSchema.safeParse({ ...validJob, description: "Too short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/50/);
    }
  });

  it("rejects description longer than 10000 chars", () => {
    const result = jobCreateSchema.safeParse({ ...validJob, description: "A".repeat(10001) });
    expect(result.success).toBe(false);
  });

  it("rejects invalid job type", () => {
    const result = jobCreateSchema.safeParse({ ...validJob, type: "part-time" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid job types", () => {
    for (const type of ["full-time", "contract", "internship"] as const) {
      expect(jobCreateSchema.safeParse({ ...validJob, type }).success).toBe(true);
    }
  });

  it("allows optional department and location", () => {
    const { department, location, ...withoutOptional } = validJob;
    expect(jobCreateSchema.safeParse(withoutOptional).success).toBe(true);
  });
});
