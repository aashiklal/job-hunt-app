"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Analysis = {
  summary: string;
  seniorityLevel: "junior" | "mid" | "senior" | "staff" | "unclear";
  requiredSkills: string[];
  niceToHaves: string[];
  keywordsForResume: string[];
  redFlags: string[];
};

type Props = {
  jobId: string;
  hasJobDescription: boolean;
  initialAnalysis: Analysis | null;
};

export function JDAnalysisPanel({
  jobId,
  hasJobDescription,
  initialAnalysis,
}: Props) {
  const [analysis, setAnalysis] = useState<Analysis | null>(initialAnalysis);
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerate() {
    if (!hasJobDescription) {
      toast.error("Save a job description on this job first.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, type: "jd_analysis" }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.error === "QUOTA_EXCEEDED") {
          toast.error(
            `You have used ${data.used} of ${data.limit} AI generations this month.`
          );
        } else if (
          res.status === 400 &&
          data.error === "NO_JOB_DESCRIPTION"
        ) {
          toast.error(data.message ?? "No job description on this job.");
        } else {
          toast.error(data.error ?? data.message ?? "Analysis failed");
        }
        return;
      }
      setAnalysis(data.analysis);
      toast.success("Analysis complete");
    } catch (err) {
      console.error(err);
      toast.error("Network error during analysis");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>JD Analysis</CardTitle>
        <p className="text-sm text-muted-foreground">
          Get a structured breakdown of what this role wants: required skills,
          nice-to-haves, keywords to mirror in your resume, and red flags.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !hasJobDescription}
          >
            {isLoading ? "Analyzing..." : analysis ? "Re-analyze" : "Analyze"}
          </Button>
          {!hasJobDescription && (
            <p className="text-xs text-muted-foreground mt-2">
              Save a job description on this job to enable analysis.
            </p>
          )}
        </div>

        {analysis && (
          <div className="space-y-4 pt-2 border-t">
            {/* Summary */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Summary
              </div>
              <p className="text-sm">{analysis.summary}</p>
            </div>

            {/* Seniority */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Seniority
              </div>
              <Badge variant="secondary" className="capitalize">
                {analysis.seniorityLevel}
              </Badge>
            </div>

            {/* Required skills */}
            {analysis.requiredSkills.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Required skills
                </div>
                <div className="flex flex-wrap gap-1">
                  {analysis.requiredSkills.map((s) => (
                    <Badge key={s} variant="default">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Nice to haves */}
            {analysis.niceToHaves.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Nice to have
                </div>
                <div className="flex flex-wrap gap-1">
                  {analysis.niceToHaves.map((s) => (
                    <Badge key={s} variant="outline">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {analysis.keywordsForResume.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Keywords to mirror in your resume
                </div>
                <div className="flex flex-wrap gap-1">
                  {analysis.keywordsForResume.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Red flags */}
            {analysis.redFlags.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1 text-destructive">
                  Red flags
                </div>
                <ul className="text-sm list-disc list-inside space-y-1">
                  {analysis.redFlags.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
