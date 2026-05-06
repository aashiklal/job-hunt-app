import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as offers from "@/lib/repositories/offers";
import { OfferForm } from "../_components/offer-form";
import { DeleteOfferButton } from "../_components/delete-offer-button";

export const metadata: Metadata = {
  title: "Offer: Job Hunt",
  description: "View and edit a job offer.",
};

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireApprovedUserWithPlan();
  const userIdStr = user._id.toString();

  const offer = await offers.getById(userIdStr, id);
  if (!offer) notFound();

  const offerLabel = `${offer.company} - ${offer.role}`;

  return (
    <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10 md:space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href="/offers"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground mb-2"
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} />
            Back to offers
          </Link>
          <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
            {offerLabel}
          </h1>
        </div>
        <DeleteOfferButton offerId={id} offerLabel={offerLabel} />
      </div>

      <OfferForm
        mode="edit"
        offerId={id}
        initialValues={{
          company: offer.company,
          role: offer.role,
          baseSalary: offer.baseSalary,
          currency: offer.currency,
          equity: offer.equity ?? undefined,
          bonus: offer.bonus ?? undefined,
          leaveDays: offer.leaveDays ?? undefined,
          location: offer.location,
          remotePolicy: offer.remotePolicy,
          roleLevel: offer.roleLevel,
          notes: offer.notes ?? undefined,
        }}
      />
    </div>
  );
}
