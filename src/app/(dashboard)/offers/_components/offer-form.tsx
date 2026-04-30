"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { Resolver } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createOffer, updateOffer } from "../_actions";

const schema = z.object({
  company: z.string().min(1, "Company is required").max(200),
  role: z.string().min(1, "Role is required").max(200),
  baseSalary: z.coerce.number().min(0).optional().or(z.literal("")),
  currency: z.string().min(1, "Currency is required").max(10),
  remotePolicy: z.enum(["fully_remote", "hybrid", "onsite"]),
  location: z.string().min(1, "Location is required").max(200),
  roleLevel: z.string().min(1, "Role level is required").max(100),
  equity: z.string().max(500).optional(),
  bonus: z.string().max(500).optional(),
  leaveDays: z.coerce.number().int().min(0).optional().or(z.literal("")),
  notes: z.string().max(5000).optional(),
});

type FormValues = {
  company: string;
  role: string;
  baseSalary: number | "";
  currency: string;
  remotePolicy: "fully_remote" | "hybrid" | "onsite";
  location: string;
  roleLevel: string;
  equity?: string;
  bonus?: string;
  leaveDays?: number | "";
  notes?: string;
};

type Props = {
  mode: "create" | "edit";
  offerId?: string;
  initialValues?: {
    company?: string;
    role?: string;
    baseSalary?: number;
    currency?: string;
    remotePolicy?: "fully_remote" | "hybrid" | "onsite";
    location?: string;
    roleLevel?: string;
    equity?: string;
    bonus?: string;
    leaveDays?: number;
    notes?: string;
  };
};

export function OfferForm({ mode, offerId, initialValues }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      company: initialValues?.company ?? "",
      role: initialValues?.role ?? "",
      baseSalary: initialValues?.baseSalary ?? "",
      currency: initialValues?.currency ?? "USD",
      remotePolicy: initialValues?.remotePolicy ?? "onsite",
      location: initialValues?.location ?? "",
      roleLevel: initialValues?.roleLevel ?? "",
      equity: initialValues?.equity ?? "",
      bonus: initialValues?.bonus ?? "",
      leaveDays: initialValues?.leaveDays ?? "",
      notes: initialValues?.notes ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    const baseSalary =
      values.baseSalary !== "" && values.baseSalary !== undefined
        ? Number(values.baseSalary)
        : 0;
    const leaveDays =
      values.leaveDays !== "" && values.leaveDays !== undefined
        ? Number(values.leaveDays)
        : undefined;

    startTransition(async () => {
      if (mode === "create") {
        const result = await createOffer({
          company: values.company,
          role: values.role,
          baseSalary,
          currency: values.currency,
          remotePolicy: values.remotePolicy,
          location: values.location,
          roleLevel: values.roleLevel,
          equity: values.equity || undefined,
          bonus: values.bonus || undefined,
          leaveDays,
          notes: values.notes || undefined,
        });
        if (result.ok) {
          router.push(`/offers/${result.data.offerId}`);
        } else {
          toast.error(result.error.message ?? "Failed to create offer.");
        }
      } else {
        if (!offerId) return;
        const result = await updateOffer({
          offerId,
          company: values.company,
          role: values.role,
          baseSalary,
          currency: values.currency,
          remotePolicy: values.remotePolicy,
          location: values.location,
          roleLevel: values.roleLevel,
          equity: values.equity || undefined,
          bonus: values.bonus || undefined,
          leaveDays,
          notes: values.notes || undefined,
        });
        if (result.ok) {
          toast.success("Saved");
          router.refresh();
        } else {
          toast.error(result.error.message ?? "Failed to save offer.");
        }
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Inc." {...field} />
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
                <FormLabel>Role</FormLabel>
                <FormControl>
                  <Input placeholder="Senior Software Engineer" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="baseSalary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base salary</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    placeholder="120000"
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
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <Input placeholder="USD" maxLength={10} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="San Francisco, CA" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="remotePolicy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Remote policy</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="fully_remote">Fully remote</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="onsite">Onsite</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="roleLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role level</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Senior, L5, Staff" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="leaveDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Leave days (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    placeholder="25"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="equity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Equity (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 0.05% over 4 years" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bonus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bonus (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 10% annual target" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Benefits, culture notes, interview impressions..."
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Saving..."
            : mode === "create"
            ? "Add offer"
            : "Save changes"}
        </Button>
      </form>
    </Form>
  );
}
