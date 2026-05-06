import { z } from "zod";

export const jdAnalysisSchema = z.object({
  summary: z.string().min(1),
  seniorityLevel: z.enum(["junior", "mid", "senior", "staff", "unclear"]),
  requiredSkills: z.array(z.string().min(1)),
  niceToHaves: z.array(z.string().min(1)),
  keywordsForResume: z.array(z.string().min(1)),
  interviewLikelyFocus: z.array(z.string().min(1)),
  redFlags: z.array(z.string().min(1)),
});

export type JDAnalysis = z.infer<typeof jdAnalysisSchema>;
