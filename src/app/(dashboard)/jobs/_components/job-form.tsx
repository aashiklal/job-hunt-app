"use client";

import { useTransition, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { createJob, updateJob } from "../_actions";
import { fitScoreBand, type FitScoreResult } from "@/lib/fit-score";
import type { JDAnalysis } from "@/lib/job-analysis";

const jobStatusOptions = [
  "saved",
  "applied",
  "screening",
  "interview",
  "assessment",
  "offer",
  "rejected",
  "withdrawn",
] as const;

const jobFormSchema = z.object({
  company: z.string().min(1, "Company is required").max(200),
  role: z.string().min(1, "Role is required").max(200),
  location: z.string().max(200).optional(),
  jobDescription: z.string().max(50000).optional(),
  url: z.string().max(2000).optional(),
  salary: z.string().max(200).optional(),
  status: z.enum(jobStatusOptions).optional(),
  notes: z.string().max(10000).optional(),
  appliedAt: z.string().optional(),
  contactName: z.string().max(200).optional(),
  contactTitle: z.string().max(300).optional(),
});

export type JobFormValues = z.infer<typeof jobFormSchema>;

type FitPreview = {
  analysis: JDAnalysis;
  fitScore: FitScoreResult | null;
  hasDefaultResume: boolean;
};

type Props = {
  mode: "create" | "edit";
  initialValues?: Partial<JobFormValues>;
  jobId?: string;
};

export function JobForm({ mode, initialValues, jobId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [fitPreview, setFitPreview] = useState<FitPreview | null>(null);
  const fitPreviewRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      company: "",
      role: "",
      location: "",
      jobDescription: "",
      url: "",
      salary: "",
      status: "saved",
      notes: "",
      appliedAt: "",
      contactName: "",
      contactTitle: "",
      ...initialValues,
    },
  });

  async function handleExtract() {
    if (!importText.trim()) return;
    setIsExtracting(true);
    try {
      const res = await fetch("/api/jobs/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: importText }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to extract job details.");
        return;
      }
      const { fields } = data as {
        fields: {
          company: string | null;
          role: string | null;
          location: string | null;
          salary: string | null;
          description: string | null;
        };
        analysis: JDAnalysis;
        fitScore: FitScoreResult | null;
        hasDefaultResume: boolean;
      };
      if (fields.company) form.setValue("company", fields.company, { shouldDirty: true });
      if (fields.role) form.setValue("role", fields.role, { shouldDirty: true });
      if (fields.location) form.setValue("location", fields.location, { shouldDirty: true });
      if (fields.salary) form.setValue("salary", fields.salary, { shouldDirty: true });
      if (fields.description) form.setValue("jobDescription", fields.description, { shouldDirty: true });
      setFitPreview({
        analysis: data.analysis,
        fitScore: data.fitScore,
        hasDefaultResume: data.hasDefaultResume,
      });
      toast.success("Fields filled. Review and edit before saving.");
      setImportOpen(false);
      setImportText("");
      window.requestAnimationFrame(() => {
        fitPreviewRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  }

  function onSubmit(values: JobFormValues) {
    startTransition(async () => {
      const payload = {
        ...values,
        appliedAt: values.appliedAt ? new Date(values.appliedAt) : null,
      };
      const editPayload = {
        company: payload.company,
        role: payload.role,
        location: payload.location,
        jobDescription: payload.jobDescription,
        url: payload.url,
        salary: payload.salary,
        notes: payload.notes,
        appliedAt: payload.appliedAt,
        contactName: payload.contactName,
        contactTitle: payload.contactTitle,
      };
      const result =
        mode === "create"
          ? await createJob({
              ...payload,
              initialAnalysis: fitPreview?.analysis,
            })
          : await updateJob({ ...editPayload, jobId: jobId! });

      if (result.ok) {
        toast.success(mode === "create" ? "Job created." : "Changes saved.");
        router.push(mode === "create" ? `/jobs/${result.data.jobId}` : `/jobs/${jobId}`);
      } else {
        toast.error(result.error.message);
        if (
          result.error.code === "VALIDATION" &&
          result.error.fieldErrors
        ) {
          for (const [field, message] of Object.entries(result.error.fieldErrors)) {
            form.setError(field as keyof JobFormValues, { message });
          }
        }
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Quick import */}
        <div className="rounded-lg border border-dashed">
          <button
            type="button"
            onClick={() => setImportOpen((o) => !o)}
            data-tour="quick-import"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Quick import from job posting
            </span>
            {importOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {importOpen && (
            <div className="border-t px-4 pb-4 pt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Paste the full job description and we&apos;ll fill in the fields and estimate Fit Score.
              </p>
              <Textarea
                placeholder="Paste the job posting here…"
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                disabled={isExtracting}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleExtract}
                disabled={isExtracting || !importText.trim()}
                data-tour="extract-details"
              >
                {isExtracting ? "Extracting…" : "Extract details"}
              </Button>
            </div>
          )}
        </div>

        {fitPreview && (
          <FitScorePreview
            ref={fitPreviewRef}
            preview={fitPreview}
            onEditDetails={() =>
              detailsRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          />
        )}

        <div ref={detailsRef} className="grid scroll-mt-24 grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company *</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Corp" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role *</FormLabel>
                <FormControl>
                  <Input placeholder="Software Engineer" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="Remote, New York…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {mode === "create" && (
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {jobStatusOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job URL</FormLabel>
                <FormControl>
                  <Input type="url" placeholder="https://…" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="salary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Salary</FormLabel>
                <FormControl>
                  <Input placeholder="$100k-$130k" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="appliedAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Applied on</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="jobDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Paste the job posting here…"
                  rows={10}
                  {...field}
                  onChange={(event) => {
                    field.onChange(event);
                    setFitPreview(null);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === "edit" && (
          <>
            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Jane Smith"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Senior Recruiter at Acme"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Your private notes…" rows={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending} data-tour="submit-job">
            {isPending
              ? "Saving…"
              : mode === "create"
              ? "Create job"
              : "Save changes"}
          </Button>
          {mode === "edit" && (
            <Button variant="outline" asChild>
              <Link href="/jobs">Cancel</Link>
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

function FitScorePreview({
  preview,
  onEditDetails,
  ref,
}: {
  preview: FitPreview;
  onEditDetails: () => void;
  ref: React.Ref<HTMLDivElement>;
}) {
  const redFlags = preview.analysis.redFlags;

  if (!preview.hasDefaultResume || !preview.fitScore) {
    return (
      <div ref={ref} className="scroll-mt-24 rounded-lg border bg-muted/30 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium">Fit Score unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a default resume to see how well it matches this job.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm">
              Create job
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onEditDetails}>
              Edit details
            </Button>
            <Button asChild type="button" variant="outline" size="sm">
              <Link href="/resume/new">Add resume</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const band = fitScoreBand(preview.fitScore.overallScore);

  return (
    <div ref={ref} className="scroll-mt-24 rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium">Fit Score</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Estimates resume-to-JD keyword coverage, not your chance of getting hired.
          </p>
        </div>
        <div className="sm:text-right">
          <div className="flex items-baseline gap-2 sm:justify-end">
            <span className={`text-3xl font-bold tabular-nums ${band.colour}`}>
              {preview.fitScore.overallScore}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <p className={`text-sm font-medium ${band.colour}`}>
            {band.label}: {band.guidance}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
            <Button type="submit" size="sm">
              Create job
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onEditDetails}>
              Edit details
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <PreviewBucket
          title="Matched requirements"
          items={preview.fitScore.requiredCoverage.matched}
          variant="default"
          empty="No required skills matched yet."
        />
        <PreviewBucket
          title="Missing requirements"
          items={preview.fitScore.requiredCoverage.missing}
          variant="destructive"
          empty="No required skills missing."
        />
        <PreviewBucket
          title="Resume keywords to add"
          items={preview.fitScore.keywordCoverage.missing}
          variant="secondary"
          empty="No keyword gaps found."
        />
        <PreviewBucket
          title="Red flags"
          items={redFlags}
          variant="outline"
          empty="No obvious red flags found."
          display="list"
        />
      </div>
    </div>
  );
}

function PreviewBucket({
  title,
  items,
  variant,
  empty,
  display = "chips",
}: {
  title: string;
  items: string[];
  variant: "default" | "secondary" | "destructive" | "outline";
  empty: string;
  display?: "chips" | "list";
}) {
  if (display === "list") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {items.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {items.map((item) => (
              <li key={item} className="rounded-md border px-2 py-1 text-foreground">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {items.slice(0, 10).map((item) => (
            <Badge key={item} variant={variant} className="max-w-full whitespace-normal break-words text-left">
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
