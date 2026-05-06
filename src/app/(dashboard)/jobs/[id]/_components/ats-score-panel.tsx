"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeFitScore, fitScoreBand } from "@/lib/fit-score";

type Analysis = {
  requiredSkills: string[];
  niceToHaves: string[];
  keywordsForResume: string[];
};

type Props = {
  analysis: Analysis | null;
  defaultResumeContent: string;
};

export function ATSScorePanel({ analysis, defaultResumeContent }: Props) {
  const result = useMemo(() => {
    if (!analysis || !defaultResumeContent.trim()) return null;
    return computeFitScore({
      resumeText: defaultResumeContent,
      requiredSkills: analysis.requiredSkills,
      niceToHaves: analysis.niceToHaves,
      keywordsForResume: analysis.keywordsForResume,
    });
  }, [analysis, defaultResumeContent]);

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fit Score</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Run JD Analysis above to see how well your default resume matches this job.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fit Score</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add a default resume to see how well it matches this job.
          </p>
        </CardContent>
      </Card>
    );
  }

  const band = fitScoreBand(result.overallScore);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fit Score</CardTitle>
        <p className="text-sm text-muted-foreground">
          Resume-to-JD keyword coverage, not your chance of getting hired.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold tabular-nums ${band.colour}`}>
            {result.overallScore}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
          <span className={`text-sm font-medium ${band.colour}`}>
            {band.label}: {band.guidance}
          </span>
        </div>

        <SkillBucket
          title="Required skills"
          matched={result.requiredCoverage.matched}
          missing={result.requiredCoverage.missing}
          matchedVariant="default"
          missingVariant="destructive"
        />
        <SkillBucket
          title="Nice to have"
          matched={result.niceToHaveCoverage.matched}
          missing={result.niceToHaveCoverage.missing}
          matchedVariant="default"
          missingVariant="outline"
        />
        <SkillBucket
          title="Keywords"
          matched={result.keywordCoverage.matched}
          missing={result.keywordCoverage.missing}
          matchedVariant="secondary"
          missingVariant="outline"
        />
      </CardContent>
    </Card>
  );
}

function SkillBucket({
  title,
  matched,
  missing,
  matchedVariant,
  missingVariant,
}: {
  title: string;
  matched: string[];
  missing: string[];
  matchedVariant: "default" | "secondary";
  missingVariant: "destructive" | "outline";
}) {
  if (matched.length === 0 && missing.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1">
        {matched.map((s) => (
          <Badge key={s} variant={matchedVariant}>
            {s}
          </Badge>
        ))}
        {missing.map((s) => (
          <Badge key={s} variant={missingVariant}>
            {s}
          </Badge>
        ))}
      </div>
    </div>
  );
}
