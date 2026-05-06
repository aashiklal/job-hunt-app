import type { Metadata } from "next";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import { OfferForm } from "../_components/offer-form";

export const metadata: Metadata = {
  title: "Add offer: Job Hunt",
  description: "Add a new job offer to track and compare.",
};

export default async function NewOfferPage() {
  await requireApprovedUserWithPlan();
  return (
    <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Add offer
      </h1>
      <OfferForm mode="create" />
    </div>
  );
}
