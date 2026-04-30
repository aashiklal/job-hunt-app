"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ComparisonRow = {
  dimension: string;
  winner: string;
  notes: string;
};

type OfferProsAndCons = {
  pros: string[];
  cons: string[];
};

type ComparisonResult = {
  comparisonTable: ComparisonRow[];
  prosAndCons: Record<string, OfferProsAndCons>;
  recommendation: {
    pick: string;
    reasoning: string;
  };
  negotiationOpportunities: string[];
};

type Props = {
  offerCount: number;
};

export function ComparisonPanel({ offerCount }: Props) {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleCompare() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/offers/compare", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.error === "QUOTA_EXCEEDED") {
          const spent = typeof data.used === "number" ? `$${data.used.toFixed(2)}` : "your full";
          const limit = typeof data.limit === "number" ? `$${data.limit.toFixed(2)}` : "";
          toast.error(`Monthly AI budget reached (${spent} of ${limit} used).`);
        } else {
          toast.error(data.error ?? "Comparison failed.");
        }
        return;
      }
      setResult(data.comparison);
    } catch (err) {
      console.error(err);
      toast.error("Network error.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI offer comparison</CardTitle>
        <p className="text-sm text-muted-foreground">
          Compare your {offerCount} offers side by side and get a recommendation.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button onClick={handleCompare} disabled={isLoading}>
          {isLoading ? "Comparing..." : result ? "Re-compare" : "Compare offers"}
        </Button>

        {result && (
          <div className="space-y-8">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Comparison
              </h3>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-2 text-left font-medium text-foreground">
                        Dimension
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-foreground">
                        Winner
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-foreground">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.comparisonTable.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-2 font-medium text-foreground">
                          {row.dimension}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {row.winner}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {row.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {Object.keys(result.prosAndCons).length > 0 && (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Pros and cons
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {Object.entries(result.prosAndCons).map(([company, pc]) => (
                    <div
                      key={company}
                      className="rounded-md border border-border p-4 space-y-3"
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {company}
                      </p>
                      {pc.pros.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground">
                            Pros
                          </p>
                          <ul className="space-y-1">
                            {pc.pros.map((pro, i) => (
                              <li
                                key={i}
                                className="text-sm text-muted-foreground"
                              >
                                + {pro}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {pc.cons.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground">
                            Cons
                          </p>
                          <ul className="space-y-1">
                            {pc.cons.map((con, i) => (
                              <li
                                key={i}
                                className="text-sm text-muted-foreground"
                              >
                                - {con}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Recommendation
                </h3>
                <Badge variant="secondary">{result.recommendation.pick}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {result.recommendation.reasoning}
              </p>
            </section>

            {result.negotiationOpportunities.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Negotiation opportunities
                </h3>
                <ul className="space-y-1">
                  {result.negotiationOpportunities.map((opp, i) => (
                    <li
                      key={i}
                      className="text-sm text-muted-foreground"
                    >
                      {opp}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
