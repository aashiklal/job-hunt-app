import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import * as offers from "@/lib/repositories/offers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ComparisonPanel } from "./_components/comparison-panel";

export const metadata: Metadata = {
  title: "Offers: Job Hunt",
  description: "Track and compare your job offers.",
};

const REMOTE_LABELS: Record<string, string> = {
  fully_remote: "Fully remote",
  hybrid: "Hybrid",
  onsite: "Onsite",
};

export default async function OffersPage() {
  const { user } = await requireApprovedUserWithPlan();
  const userIdStr = user._id.toString();
  const offerList = await offers.list(userIdStr);

  return (
    <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10 md:space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Offers
        </h1>
        <Button asChild>
          <Link href="/offers/new">Add offer</Link>
        </Button>
      </div>

      {offerList.length === 0 ? (
        <Card className="border border-border/60 shadow-xs">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-base font-semibold text-foreground">
              No offers yet
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add your job offers here. Once you have two or more, the AI can
              compare them and give you a recommendation.
            </p>
            <Button asChild className="mt-1">
              <Link href="/offers/new">Add your first offer</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {offerList.map((offer) => (
              <Link
                key={offer._id}
                href={`/offers/${offer._id}`}
                className="block group"
              >
                <Card className="border border-border/60 shadow-xs transition-shadow duration-200 hover:shadow-sm">
                  <CardContent className="px-4 py-4 md:px-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium text-foreground group-hover:underline underline-offset-4">
                          {offer.company} &mdash; {offer.role}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {offer.currency}{" "}
                          {offer.baseSalary.toLocaleString()} &middot;{" "}
                          {REMOTE_LABELS[offer.remotePolicy] ?? offer.remotePolicy} &middot;{" "}
                          {offer.location}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {offer.roleLevel}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(offer.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {offerList.length >= 2 && (
            <ComparisonPanel offerCount={offerList.length} />
          )}
        </>
      )}
    </div>
  );
}
