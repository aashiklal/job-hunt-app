"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import type { IPlanListItem } from "@/lib/repositories/plans";
import { updatePlan } from "../_actions";

function formatLimit(value: number): string {
  return value === -1 ? "Unlimited" : String(value);
}

function formatSpend(value: number): string {
  return value === -1 ? "Unlimited" : `$${value.toFixed(2)}`;
}

type PlanRowProps = {
  plan: IPlanListItem;
};

function PlanRow({ plan }: PlanRowProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSpendValue(String(plan.aiSpendLimitUSD));
      setResumesValue(String(plan.maxResumes));
      setJobsValue(String(plan.maxJobs));
    }
    setOpen(next);
  }

  const [spendValue, setSpendValue] = useState(String(plan.aiSpendLimitUSD));
  const [resumesValue, setResumesValue] = useState(String(plan.maxResumes));
  const [jobsValue, setJobsValue] = useState(String(plan.maxJobs));

  function handleSubmit() {
    const aiSpendLimitUSD = parseFloat(spendValue);
    const maxResumes = parseInt(resumesValue, 10);
    const maxJobs = parseInt(jobsValue, 10);

    if (Number.isNaN(aiSpendLimitUSD) || (aiSpendLimitUSD !== -1 && aiSpendLimitUSD < 0)) {
      toast.error("Spend limit must be -1 (unlimited) or a non-negative number");
      return;
    }
    if (Number.isNaN(maxResumes) || maxResumes < -1) {
      toast.error("Max resumes must be -1 (unlimited) or a non-negative integer");
      return;
    }
    if (Number.isNaN(maxJobs) || maxJobs < -1) {
      toast.error("Max jobs must be -1 (unlimited) or a non-negative integer");
      return;
    }

    startTransition(async () => {
      const result = await updatePlan({
        planId: plan._id,
        aiSpendLimitUSD,
        maxResumes,
        maxJobs,
      });
      if (result.ok) {
        toast.success("Plan updated");
        setOpen(false);
      } else {
        toast.error(result.error.message ?? "Failed to update plan");
      }
    });
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pr-4">
        <span className="font-medium text-foreground">{plan.name}</span>
        <span className="ml-2 text-xs text-muted-foreground">({plan.key})</span>
      </td>
      <td className="py-3 pr-4 text-foreground">
        {formatSpend(plan.aiSpendLimitUSD)}
        {plan.budgetScope === "lifetime" && plan.aiSpendLimitUSD !== -1 && (
          <span className="ml-1 text-xs text-muted-foreground">(one-time)</span>
        )}
      </td>
      <td className="py-3 pr-4 text-foreground hidden md:table-cell">{formatLimit(plan.maxResumes)}</td>
      <td className="py-3 pr-4 text-foreground hidden md:table-cell">{formatLimit(plan.maxJobs)}</td>
      <td className="py-3 text-right">
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" aria-label={`Edit ${plan.name} plan`}>
              Edit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {plan.name} plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`spend-${plan._id}`}>
                  {plan.budgetScope === "lifetime"
                    ? "Lifetime spend limit (USD, -1 for unlimited)"
                    : "Monthly spend limit (USD, -1 for unlimited)"}
                </Label>
                <Input
                  id={`spend-${plan._id}`}
                  type="number"
                  step="0.01"
                  min="-1"
                  value={spendValue}
                  onChange={(e) => setSpendValue(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`resumes-${plan._id}`}>
                  Max resumes (-1 for unlimited)
                </Label>
                <Input
                  id={`resumes-${plan._id}`}
                  type="number"
                  step="1"
                  min="-1"
                  value={resumesValue}
                  onChange={(e) => setResumesValue(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`jobs-${plan._id}`}>
                  Max jobs (-1 for unlimited)
                </Label>
                <Input
                  id={`jobs-${plan._id}`}
                  type="number"
                  step="1"
                  min="-1"
                  value={jobsValue}
                  onChange={(e) => setJobsValue(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button onClick={handleSubmit} disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  );
}

export function PlanEditor({ plans }: { plans: IPlanListItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Plan limits</caption>
        <thead>
          <tr className="border-b border-border">
            <th className="py-3 text-left font-medium text-muted-foreground">Plan</th>
            <th className="py-3 text-left font-medium text-muted-foreground">Spend limit</th>
            <th className="py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
              Max resumes
            </th>
            <th className="py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
              Max jobs
            </th>
            <th className="py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <PlanRow key={plan._id} plan={plan} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
