"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { JobStatus } from "@/lib/repositories/jobs";
import { GenerationProgressBar } from "@/components/GenerationProgressBar";

type OutreachType =
  | "linkedin_note"
  | "linkedin_dm"
  | "followup_email"
  | "thankyou_email"
  | "linkedin_followup_dm"
  | "cold_email"
  | "checkin_email"
  | "salary_negotiation";

type Props = {
  type: OutreachType;
  jobId: string;
  job: {
    company: string;
    role: string;
    status: JobStatus;
    appliedAt: string | null;
    contactName: string | null;
    contactTitle: string | null;
  };
  initialContent: string | null;
};

const TITLES: Record<OutreachType, string> = {
  linkedin_note: "LinkedIn connection note",
  linkedin_dm: "LinkedIn DM to recruiter",
  followup_email: "Follow-up email",
  thankyou_email: "Thank you email",
  linkedin_followup_dm: "LinkedIn follow-up DM",
  cold_email: "Cold email to hiring manager",
  checkin_email: "Check-in email",
  salary_negotiation: "Salary negotiation email",
};

const DESCRIPTIONS: Record<OutreachType, string> = {
  linkedin_note:
    "A short connection request note for LinkedIn (300-character limit).",
  linkedin_dm:
    "A cold DM to a recruiter or hiring manager. 60-100 words.",
  followup_email:
    "A polite follow-up after applying with no response.",
  thankyou_email:
    "A post-interview thank you email personalised to what you discussed.",
  linkedin_followup_dm:
    "A short DM following up on your LinkedIn connection or application. 50-80 words.",
  cold_email:
    "A cold email to a hiring manager introducing yourself. Subject line + brief body.",
  checkin_email:
    "A check-in email after a period of silence. Subject line + brief body.",
  salary_negotiation:
    "A professional counter-offer email after receiving a job offer. Subject line + body.",
};

const STATUS_NOTE: Partial<Record<JobStatus, string>> = {
  saved: "Most useful after you apply or reach out to a recruiter.",
  screening: "Good time to send a thank you after your screening call.",
  interview: "Send a thank you within 24 hours of your interview.",
  assessment: "Check in after completing your assessment if you have not heard back.",
  offer: "A follow-up or thank you is less relevant at the offer stage.",
};

function computeDaysSinceApplied(appliedAt: string | null): number | null {
  if (!appliedAt) return null;
  const diff = Date.now() - new Date(appliedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function OutreachPanel({ type, jobId, job, initialContent }: Props) {
  const [recipientName, setRecipientName] = useState(job.contactName ?? "");
  const [recipientTitle, setRecipientTitle] = useState(job.contactTitle ?? "");
  const [tone, setTone] = useState<"direct" | "warm">("direct");
  const [hasApplied, setHasApplied] = useState(
    job.status !== "saved" && job.status !== "rejected" && job.status !== "withdrawn"
  );
  const [interviewerName, setInterviewerName] = useState(job.contactName ?? "");
  const [interviewerTitle, setInterviewerTitle] = useState(job.contactTitle ?? "");
  const [interviewTopics, setInterviewTopics] = useState("");
  const [interviewType, setInterviewType] = useState<
    "phone_screen" | "technical" | "onsite" | "panel"
  >("phone_screen");
  const [previousMessageSent, setPreviousMessageSent] = useState(false);
  const [companyContext, setCompanyContext] = useState("");
  const [lastInteractionDescription, setLastInteractionDescription] = useState("");
  const [daysSinceLastContact, setDaysSinceLastContact] = useState(0);
  const [offeredSalary, setOfferedSalary] = useState("");
  const [targetSalary, setTargetSalary] = useState("");
  const [negotiationReason, setNegotiationReason] = useState("");
  const [otherComponents, setOtherComponents] = useState("");
  const [content, setContent] = useState(initialContent ?? "");
  const [isLoading, setIsLoading] = useState(false);

  const daysSinceApplied = computeDaysSinceApplied(job.appliedAt);
  const followupBlocked = type === "followup_email" && job.appliedAt === null;
  const statusNote = STATUS_NOTE[job.status];

  async function handleGenerate() {
    if (followupBlocked) return;

    const body: Record<string, unknown> = { jobId, type };

    if (type === "linkedin_note" || type === "linkedin_dm") {
      if (!recipientName.trim() || !recipientTitle.trim()) {
        toast.error("Enter recipient name and title first.");
        return;
      }
      body.recipientName = recipientName.trim();
      body.recipientTitle = recipientTitle.trim();
      if (type === "linkedin_dm") {
        body.tone = tone;
        body.hasApplied = hasApplied;
      }
    } else if (type === "followup_email") {
      body.daysSinceApplied = daysSinceApplied ?? 0;
      if (recipientName.trim()) body.recipientName = recipientName.trim();
    } else if (type === "thankyou_email") {
      if (!interviewerName.trim() || !interviewTopics.trim()) {
        toast.error("Enter interviewer name and interview topics first.");
        return;
      }
      body.interviewerName = interviewerName.trim();
      if (interviewerTitle.trim()) body.interviewerTitle = interviewerTitle.trim();
      body.interviewTopics = interviewTopics.trim();
      body.interviewType = interviewType;
    } else if (type === "linkedin_followup_dm") {
      if (!recipientName.trim()) {
        toast.error("Enter recipient name first.");
        return;
      }
      body.recipientName = recipientName.trim();
      body.daysSinceApplied = daysSinceApplied ?? 0;
      body.previousMessageSent = previousMessageSent;
    } else if (type === "cold_email") {
      if (recipientName.trim()) body.recipientName = recipientName.trim();
      if (recipientTitle.trim()) body.recipientTitle = recipientTitle.trim();
      if (companyContext.trim()) body.companyContext = companyContext.trim();
    } else if (type === "checkin_email") {
      if (!lastInteractionDescription.trim()) {
        toast.error("Describe your last interaction first.");
        return;
      }
      if (recipientName.trim()) body.recipientName = recipientName.trim();
      body.lastInteractionDescription = lastInteractionDescription.trim();
      body.daysSinceLastContact = daysSinceLastContact;
    } else if (type === "salary_negotiation") {
      if (!recipientName.trim() || !offeredSalary.trim() || !targetSalary.trim() || !negotiationReason.trim()) {
        toast.error("Fill in all required fields first.");
        return;
      }
      body.recipientName = recipientName.trim();
      body.offeredSalary = offeredSalary.trim();
      body.targetSalary = targetSalary.trim();
      body.negotiationReason = negotiationReason.trim();
      if (otherComponents.trim()) body.otherComponents = otherComponents.trim();
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.error === "QUOTA_EXCEEDED") {
          const spent = typeof data.used === "number" ? `$${data.used.toFixed(2)}` : "your full";
          const limit = typeof data.limit === "number" ? `$${data.limit.toFixed(2)}` : "";
          toast.error(`Monthly AI budget reached (${spent} of ${limit} used).`);
        } else {
          toast.error(data.error ?? data.message ?? "Generation failed");
        }
        return;
      }
      setContent(data.content ?? "");
      toast.success("Generated");
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }

  const charCount = content.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLES[type]}</CardTitle>
        <p className="text-sm text-muted-foreground">{DESCRIPTIONS[type]}</p>
        {statusNote && (
          <p className="text-xs text-muted-foreground italic">{statusNote}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {followupBlocked ? (
          <p className="text-sm text-muted-foreground">
            Set your applied date on this job to generate a follow-up email.{" "}
            <Link
              href={`/jobs/${jobId}/edit`}
              className="underline underline-offset-4 hover:opacity-70"
            >
              Edit job
            </Link>
          </p>
        ) : (
          <>
            {(type === "linkedin_note" || type === "linkedin_dm" || type === "followup_email") && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`${type}-name`}>
                    {type === "followup_email" ? "Recipient name (optional)" : "Recipient name"}
                  </Label>
                  <Input
                    id={`${type}-name`}
                    placeholder="e.g. Jane Smith"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>
                {type !== "followup_email" && (
                  <div className="space-y-1">
                    <Label htmlFor={`${type}-title`}>Recipient title</Label>
                    <Input
                      id={`${type}-title`}
                      placeholder="e.g. Senior Recruiter at Acme"
                      value={recipientTitle}
                      onChange={(e) => setRecipientTitle(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {type === "linkedin_dm" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Tone</Label>
                  <Select value={tone} onValueChange={(v) => setTone(v as "direct" | "warm")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="warm">Warm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Application status</Label>
                  <Select
                    value={hasApplied ? "yes" : "no"}
                    onValueChange={(v) => setHasApplied(v === "yes")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Already applied</SelectItem>
                      <SelectItem value="no">Not yet applied</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {type === "thankyou_email" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="interviewer-name">Interviewer name</Label>
                    <Input
                      id="interviewer-name"
                      placeholder="e.g. Alex Johnson"
                      value={interviewerName}
                      onChange={(e) => setInterviewerName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="interviewer-title">Interviewer title (optional)</Label>
                    <Input
                      id="interviewer-title"
                      placeholder="e.g. Engineering Manager"
                      value={interviewerTitle}
                      onChange={(e) => setInterviewerTitle(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Interview type</Label>
                  <Select
                    value={interviewType}
                    onValueChange={(v) =>
                      setInterviewType(v as "phone_screen" | "technical" | "onsite" | "panel")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone_screen">Phone screen</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="onsite">Onsite</SelectItem>
                      <SelectItem value="panel">Panel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="interview-topics">What did you discuss?</Label>
                  <Textarea
                    id="interview-topics"
                    placeholder="e.g. we talked about the migration to k8s and the team's on-call rotation"
                    value={interviewTopics}
                    onChange={(e) => setInterviewTopics(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}

            {type === "linkedin_followup_dm" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="followup-dm-name">Recipient name</Label>
                  <Input
                    id="followup-dm-name"
                    placeholder="e.g. Jane Smith"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Previous message sent?</Label>
                  <Select
                    value={previousMessageSent ? "yes" : "no"}
                    onValueChange={(v) => setPreviousMessageSent(v === "yes")}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {type === "cold_email" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="cold-name">Recipient name (optional)</Label>
                    <Input
                      id="cold-name"
                      placeholder="e.g. Jane Smith"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cold-title">Recipient title (optional)</Label>
                    <Input
                      id="cold-title"
                      placeholder="e.g. Engineering Manager"
                      value={recipientTitle}
                      onChange={(e) => setRecipientTitle(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="company-context">Company context (optional)</Label>
                  <Textarea
                    id="company-context"
                    placeholder="e.g. I noticed they recently launched a new product in the fintech space"
                    value={companyContext}
                    onChange={(e) => setCompanyContext(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            )}

            {type === "checkin_email" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="checkin-name">Recipient name (optional)</Label>
                    <Input
                      id="checkin-name"
                      placeholder="e.g. Jane Smith"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="days-since-contact">Days since last contact</Label>
                    <Input
                      id="days-since-contact"
                      type="number"
                      min={0}
                      value={daysSinceLastContact}
                      onChange={(e) => setDaysSinceLastContact(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="last-interaction">Last interaction</Label>
                  <Textarea
                    id="last-interaction"
                    placeholder="e.g. We had a screening call 3 weeks ago and they said they would follow up"
                    value={lastInteractionDescription}
                    onChange={(e) => setLastInteractionDescription(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            )}

            {type === "salary_negotiation" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="neg-name">Recipient name</Label>
                  <Input
                    id="neg-name"
                    placeholder="e.g. Jane Smith (recruiter or HR contact)"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="offered-salary">Offer received</Label>
                    <Input
                      id="offered-salary"
                      placeholder="e.g. $90,000"
                      value={offeredSalary}
                      onChange={(e) => setOfferedSalary(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="target-salary">Your target</Label>
                    <Input
                      id="target-salary"
                      placeholder="e.g. $105,000"
                      value={targetSalary}
                      onChange={(e) => setTargetSalary(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="neg-reason">Reason for counter</Label>
                  <Textarea
                    id="neg-reason"
                    placeholder="e.g. Market rate for this level in NYC is $100-110k based on my research and a competing offer"
                    value={negotiationReason}
                    onChange={(e) => setNegotiationReason(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="other-components">Other components to negotiate (optional)</Label>
                  <Input
                    id="other-components"
                    placeholder="e.g. extra week of PTO, signing bonus"
                    value={otherComponents}
                    onChange={(e) => setOtherComponents(e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button onClick={handleGenerate} disabled={isLoading}>
              {isLoading ? "Generating..." : content ? "Regenerate" : "Generate"}
            </Button>

            <GenerationProgressBar isLoading={isLoading} durationMs={3000} />

            {content && (
              <div className="space-y-2">
                <div className="rounded-md border border-border bg-muted/30 p-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
                    {content}
                  </pre>
                </div>
                <div className="flex items-center justify-between">
                  <Button onClick={handleCopy} variant="outline" size="sm">
                    Copy
                  </Button>
                  {type === "linkedin_note" && (
                    <span
                      className={`text-xs tabular-nums ${
                        charCount > 300 ? "text-destructive font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {charCount} / 300 characters
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
