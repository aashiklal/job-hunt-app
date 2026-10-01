"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneratePanel } from "./generate-panel";
import { JDAnalysisPanel } from "./jd-analysis-panel";
import { OutreachPanel } from "./outreach-panel";
import { InterviewPrepPanel } from "./interview-prep-panel";
import { FitScorePanel } from "./fit-score-panel";
import type { JobStatus } from "@/lib/repositories/jobs";

type ResumeOption = { _id: string; title: string; isDefault: boolean };

type Analysis = {
  summary: string;
  seniorityLevel: "junior" | "mid" | "senior" | "staff" | "unclear";
  requiredSkills: string[];
  niceToHaves: string[];
  keywordsForResume: string[];
  interviewLikelyFocus?: string[];
  redFlags: string[];
};

type PrepData = {
  behavioral: Array<{ question: string; hint: string }>;
  technical: Array<{ question: string; hint: string }>;
  roleSpecific: Array<{ question: string; hint: string }>;
  cultureFit: Array<{ question: string; hint: string }>;
  questionsToAskThem: string[];
};

type Props = {
  jobId: string;
  job: {
    company: string;
    role: string;
    status: JobStatus;
    appliedAt: string | null;
    jobDescription: string | null;
    contactName: string | null;
    contactTitle: string | null;
  };
  resumes: ResumeOption[];
  defaultResumeContent: string;
  initialResumeContent: string | null;
  initialResumeId: string | null;
  initialResumeDocumentId: string | null;
  initialCoverLetterContent: string | null;
  initialCoverLetterId: string | null;
  initialCoverLetterDocumentId: string | null;
  initialAnalysis: Analysis | null;
  initialLinkedInNote: string | null;
  initialLinkedInDm: string | null;
  initialFollowUpEmail: string | null;
  initialThankYouEmail: string | null;
  initialInterviewPrep: PrepData | null;
  initialLinkedInFollowupDm: string | null;
  initialColdEmail: string | null;
  initialCheckinEmail: string | null;
  initialSalaryNegotiation: string | null;
};

export function JobDetailTabs({
  jobId,
  job,
  resumes,
  defaultResumeContent,
  initialResumeContent,
  initialResumeId,
  initialResumeDocumentId,
  initialCoverLetterContent,
  initialCoverLetterId,
  initialCoverLetterDocumentId,
  initialAnalysis,
  initialLinkedInNote,
  initialLinkedInDm,
  initialFollowUpEmail,
  initialThankYouEmail,
  initialInterviewPrep,
  initialLinkedInFollowupDm,
  initialColdEmail,
  initialCheckinEmail,
  initialSalaryNegotiation,
}: Props) {
  return (
    <Tabs defaultValue="documents">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="documents">Documents</TabsTrigger>
        <TabsTrigger value="outreach">Outreach</TabsTrigger>
        <TabsTrigger value="prep">Prep</TabsTrigger>
      </TabsList>

      <TabsContent value="documents" className="space-y-4 mt-4">
        <GeneratePanel
          type="resume"
          jobId={jobId}
          resumes={resumes}
          initialContent={initialResumeContent}
          initialResumeId={initialResumeId}
          initialDocumentId={initialResumeDocumentId}
        />
        <GeneratePanel
          type="cover_letter"
          jobId={jobId}
          resumes={resumes}
          initialContent={initialCoverLetterContent}
          initialResumeId={initialCoverLetterId}
          initialDocumentId={initialCoverLetterDocumentId}
        />
      </TabsContent>

      <TabsContent value="outreach" className="space-y-4 mt-4">
        <OutreachPanel
          type="linkedin_note"
          jobId={jobId}
          job={job}
          initialContent={initialLinkedInNote}
        />
        <OutreachPanel
          type="linkedin_dm"
          jobId={jobId}
          job={job}
          initialContent={initialLinkedInDm}
        />
        <OutreachPanel
          type="followup_email"
          jobId={jobId}
          job={job}
          initialContent={initialFollowUpEmail}
        />
        <OutreachPanel
          type="thankyou_email"
          jobId={jobId}
          job={job}
          initialContent={initialThankYouEmail}
        />
        <OutreachPanel
          type="linkedin_followup_dm"
          jobId={jobId}
          job={job}
          initialContent={initialLinkedInFollowupDm}
        />
        <OutreachPanel
          type="cold_email"
          jobId={jobId}
          job={job}
          initialContent={initialColdEmail}
        />
        <OutreachPanel
          type="checkin_email"
          jobId={jobId}
          job={job}
          initialContent={initialCheckinEmail}
        />
        <OutreachPanel
          type="salary_negotiation"
          jobId={jobId}
          job={job}
          initialContent={initialSalaryNegotiation}
        />
      </TabsContent>

      <TabsContent value="prep" className="space-y-4 mt-4">
        <JDAnalysisPanel
          jobId={jobId}
          hasJobDescription={!!job.jobDescription && job.jobDescription.trim().length >= 50}
          initialAnalysis={initialAnalysis}
        />
        <FitScorePanel
          analysis={initialAnalysis}
          defaultResumeContent={defaultResumeContent}
        />
        <InterviewPrepPanel
          jobId={jobId}
          initialPrep={initialInterviewPrep}
          initialSeniorityLevel={initialAnalysis?.seniorityLevel ?? "unclear"}
        />
      </TabsContent>
    </Tabs>
  );
}
