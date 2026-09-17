"use client";

import { describeQuotaError } from "@/lib/quota-copy";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GenerationProgressBar } from "@/components/GenerationProgressBar";

type SeniorityLevel = "junior" | "mid" | "senior" | "staff" | "unclear";

type PrepQuestion = { question: string; hint: string };

type PrepData = {
  behavioral: PrepQuestion[];
  technical: PrepQuestion[];
  roleSpecific: PrepQuestion[];
  cultureFit: PrepQuestion[];
  questionsToAskThem: string[];
};

type Props = {
  jobId: string;
  initialPrep: PrepData | null;
  initialSeniorityLevel: SeniorityLevel;
};

const SECTION_LABELS: Record<keyof Omit<PrepData, "questionsToAskThem">, string> = {
  behavioral: "Behavioral",
  technical: "Technical",
  roleSpecific: "Role-specific",
  cultureFit: "Culture fit",
};

function QuestionAccordion({ items }: { items: PrepQuestion[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="border border-border rounded-md overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-expanded={openIndex === i}
          >
            <span>{item.question}</span>
            {openIndex === i ? (
              <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            )}
          </button>
          {openIndex === i && (
            <div className="border-t border-border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">{item.hint}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function InterviewPrepPanel({
  jobId,
  initialPrep,
  initialSeniorityLevel,
}: Props) {
  const router = useRouter();
  const [prep, setPrep] = useState<PrepData | null>(initialPrep);
  const [seniorityLevel, setSeniorityLevel] = useState<SeniorityLevel>(initialSeniorityLevel);
  const [focusAreas, setFocusAreas] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerate() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          type: "interview_prep",
          seniorityLevel,
          focusAreas: focusAreas.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.error === "QUOTA_EXCEEDED") {
          toast.error(describeQuotaError(data));
        } else {
          toast.error(data.error ?? data.message ?? "Generation failed");
        }
        return;
      }
      setPrep(data.prep);
      toast.success("Interview prep ready");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interview prep</CardTitle>
        <p className="text-sm text-muted-foreground">
          Likely questions for this role, categorised by type. Click a question to see what the interviewer is assessing.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Seniority level</Label>
            <Select
              value={seniorityLevel}
              onValueChange={(v) => setSeniorityLevel(v as SeniorityLevel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="mid">Mid</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="unclear">Unclear</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="focus-areas">Focus areas (optional)</Label>
            <Input
              id="focus-areas"
              placeholder="e.g. system design, Python"
              value={focusAreas}
              onChange={(e) => setFocusAreas(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={isLoading} data-tour="generate-prep">
          {isLoading ? "Generating..." : prep ? "Regenerate" : "Generate questions"}
        </Button>

        <GenerationProgressBar isLoading={isLoading} durationMs={7000} />

        {prep && (
          <div className="space-y-6 pt-2 border-t border-border">
            {(Object.keys(SECTION_LABELS) as Array<keyof typeof SECTION_LABELS>).map((section) => (
              <div key={section}>
                <h3 className="text-sm font-medium mb-2">{SECTION_LABELS[section]}</h3>
                <QuestionAccordion items={prep[section]} />
              </div>
            ))}

            {prep.questionsToAskThem.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Questions to ask them</h3>
                <ul className="space-y-1">
                  {prep.questionsToAskThem.map((q, i) => (
                    <li key={i} className="text-sm text-foreground rounded-md border border-border px-3 py-2">
                      {q}
                    </li>
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
