/**
 * Per-account margin: what an account pays against what it costs to serve.
 *
 * The admin dashboard exists to answer one question every morning, which is
 * whether anyone is costing more than they pay. Cost alone cannot answer it,
 * so price, billing state and spend are combined here rather than in the page,
 * so that any later billing code reaches the same numbers.
 */

export type BillingStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "comped";

/** Only an active subscription is money actually collected. */
export function isPaying(status: BillingStatus): boolean {
  return status === "active";
}

/**
 * Whether an account should appear in the margin view at all.
 *
 * Cancelled accounts are gone and comped ones were never going to pay, so
 * neither says anything about whether the pricing works.
 */
export function countsTowardMargin(status: BillingStatus): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

export type AccountMargin = {
  /** What the plan charges. Zero for a comped account. */
  priceUSD: number;
  /** What serving them actually cost over the period. */
  costUSD: number;
  /** priceUSD - costUSD. Negative means the account loses money. */
  marginUSD: number;
  /** Margin as a share of price, 0 to 1. Null when the price is zero. */
  marginRatio: number | null;
  /** How much of the price the cost consumes, 0 to 1+, for the bar fill. */
  costRatio: number | null;
  /** True when this account costs more than it charges. */
  isLoss: boolean;
  /** True when margin has thinned enough to be worth watching. */
  isAtRisk: boolean;
  /** Whether this is money collected or money the pricing model predicts. */
  isEarned: boolean;
};

/**
 * Margin thins before it inverts, so an account crossing this share of its
 * price is worth seeing before it becomes a loss.
 */
const AT_RISK_COST_RATIO = 0.6;

export function accountMargin(args: {
  priceUSD: number;
  costUSD: number;
  status: BillingStatus;
}): AccountMargin {
  // A comped account charges nothing by definition, whatever its plan says.
  const priceUSD = args.status === "comped" ? 0 : args.priceUSD;
  const costUSD = args.costUSD;
  const marginUSD = priceUSD - costUSD;

  // Guard the division: an unpriced plan is the default state until someone
  // sets a price, and Infinity would render as a nonsense percentage.
  const hasPrice = priceUSD > 0;
  const marginRatio = hasPrice ? marginUSD / priceUSD : null;
  const costRatio = hasPrice ? costUSD / priceUSD : null;

  return {
    priceUSD,
    costUSD,
    marginUSD,
    marginRatio,
    costRatio,
    isLoss: hasPrice && costUSD > priceUSD,
    isAtRisk:
      hasPrice && costRatio !== null && costRatio >= AT_RISK_COST_RATIO && costUSD <= priceUSD,
    isEarned: isPaying(args.status),
  };
}

export type MarginTotals = {
  /** Revenue actually collected, from active subscriptions only. */
  earnedRevenueUSD: number;
  /** Revenue if every trialing account converted at its plan price. */
  modelledRevenueUSD: number;
  costUSD: number;
  /** Modelled revenue less cost. What the pricing would yield today. */
  modelledMarginUSD: number;
  accountsAtRisk: number;
  accountsLosing: number;
  accountsCounted: number;
  payingCount: number;
};

export function summarise(margins: AccountMargin[]): MarginTotals {
  const totals: MarginTotals = {
    earnedRevenueUSD: 0,
    modelledRevenueUSD: 0,
    costUSD: 0,
    modelledMarginUSD: 0,
    accountsAtRisk: 0,
    accountsLosing: 0,
    accountsCounted: margins.length,
    payingCount: 0,
  };

  for (const m of margins) {
    totals.modelledRevenueUSD += m.priceUSD;
    totals.costUSD += m.costUSD;
    if (m.isEarned) {
      totals.earnedRevenueUSD += m.priceUSD;
      totals.payingCount += 1;
    }
    if (m.isLoss) totals.accountsLosing += 1;
    else if (m.isAtRisk) totals.accountsAtRisk += 1;
  }

  totals.modelledMarginUSD = totals.modelledRevenueUSD - totals.costUSD;
  return totals;
}

/**
 * The one-line verdict at the top of the dashboard.
 *
 * Written as a plain sentence rather than a status code, because the page is
 * read in a few seconds and a sentence is faster to parse than a badge.
 */
export function marginHeadline(totals: MarginTotals): string {
  if (totals.accountsCounted === 0) return "No accounts to measure yet";

  const noun = totals.accountsCounted === 1 ? "account" : "accounts";

  if (totals.accountsLosing > 0) {
    return totals.accountsLosing === 1
      ? "1 account costs more than it pays"
      : `${totals.accountsLosing} accounts cost more than they pay`;
  }
  if (totals.accountsAtRisk > 0) {
    return totals.accountsAtRisk === 1
      ? "1 account is approaching its price"
      : `${totals.accountsAtRisk} accounts are approaching their price`;
  }
  return `All ${totals.accountsCounted} ${noun} profitable`;
}
