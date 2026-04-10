"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
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
});

export type JobFormValues = z.infer<typeof jobFormSchema>;

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
      };
      if (fields.company) form.setValue("company", fields.company, { shouldDirty: true });
      if (fields.role) form.setValue("role", fields.role, { shouldDirty: true });
      if (fields.location) form.setValue("location", fields.location, { shouldDirty: true });
      if (fields.salary) form.setValue("salary", fields.salary, { shouldDirty: true });
      if (fields.description) form.setValue("jobDescription", fields.description, { shouldDirty: true });
      toast.success("Fields filled — review and edit before saving.");
      setImportOpen(false);
      setImportText("");
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
      const result =
        mode === "create"
          ? await createJob(payload)
          : await updateJob({ ...payload, jobId: jobId! });

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
                Paste the full job description and we&apos;ll fill in the fields for you.
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
              >
                {isExtracting ? "Extracting…" : "Extract details"}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
                  <Input placeholder="$100k–$130k" {...field} />
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
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
          <Button type="submit" disabled={isPending}>
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
