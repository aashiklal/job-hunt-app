import { describe, expect, it } from "vitest";
import { computeFitScore, fitScoreBand } from "@/lib/fit-score";

const resume = `
Senior engineer with 6 years of experience building React and Node.js services.
Designed PostgreSQL schemas, deployed to AWS with Terraform, and mentored juniors.
`;

describe("computeFitScore", () => {
  it("scores 100 across the board when every skill appears in the resume", () => {
    const result = computeFitScore({
      resumeText: resume,
      requiredSkills: ["React", "Node.js"],
      niceToHaves: ["Terraform"],
      keywordsForResume: ["PostgreSQL"],
    });
    expect(result.overallScore).toBe(100);
    expect(result.requiredCoverage.missing).toEqual([]);
  });

  it("weights required skills at 60 percent of the overall score", () => {
    const result = computeFitScore({
      resumeText: resume,
      requiredSkills: ["React", "Kubernetes"],
      niceToHaves: [],
      keywordsForResume: [],
    });
    // required: 50, empty buckets count as 100 -> 50*0.6 + 100*0.15 + 100*0.25 = 70
    expect(result.requiredCoverage.score).toBe(50);
    expect(result.requiredCoverage.missing).toEqual(["Kubernetes"]);
    expect(result.overallScore).toBe(70);
  });

  it("matches case-insensitively and through simple stemming", () => {
    const result = computeFitScore({
      resumeText: "Mentoring engineers and deploying services",
      requiredSkills: ["mentor", "Deploy"],
      niceToHaves: [],
      keywordsForResume: [],
    });
    expect(result.requiredCoverage.matched).toEqual(["mentor", "Deploy"]);
  });

  it("treats empty buckets as full coverage rather than zero", () => {
    const result = computeFitScore({
      resumeText: "",
      requiredSkills: [],
      niceToHaves: [],
      keywordsForResume: [],
    });
    expect(result.overallScore).toBe(100);
  });
});

describe("fitScoreBand", () => {
  it.each([
    [100, "Strong fit"],
    [85, "Strong fit"],
    [84, "Good fit"],
    [65, "Good fit"],
    [64, "Weak fit"],
    [40, "Weak fit"],
    [39, "Poor fit"],
    [0, "Poor fit"],
  ])("maps %i to %s", (score, label) => {
    expect(fitScoreBand(score).label).toBe(label);
  });
});
