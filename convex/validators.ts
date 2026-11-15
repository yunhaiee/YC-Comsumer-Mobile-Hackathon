import { v } from "convex/values";

export const side = v.union(v.literal("YES"), v.literal("NO"));
export const outcome = v.union(side, v.literal("VOID"));
export const state = v.union(
  v.literal("draft"),
  v.literal("awaiting_payment"),
  v.literal("prediction_open"),
  v.literal("attempts_open"),
  v.literal("review_pending"),
  v.literal("resolved"),
  v.literal("void"),
);
export const decision = v.union(v.literal("approved"), v.literal("rejected"));
export const submissionStatus = v.union(v.literal("pending"), decision);
export const templateId = v.union(
  v.literal("balance-object"),
  v.literal("paper-plane"),
);
export const campaignSummary = v.object({
  submissionCount: v.number(),
  pendingCount: v.number(),
  id: v.id("campaigns"),
  title: v.string(),
  description: v.string(),
  sponsorName: v.string(),
  mediaUrl: v.union(v.string(), v.null()),
  criteria: v.string(),
  winnerCount: v.number(),
  rewardUsdCents: v.number(),
  predictionClosesAt: v.number(),
  attemptStartsAt: v.number(),
  deadlineAt: v.number(),
  reviewDeadlineAt: v.number(),
  state,
  participantCount: v.number(),
  outcome: v.union(outcome, v.null()),
  isDemo: v.boolean(),
});
export const viewer = v.object({
  role: v.union(
    v.literal("participant"),
    v.literal("predictor"),
    v.literal("reviewer"),
    v.null(),
  ),
  canJoin: v.boolean(),
  canPredict: v.boolean(),
  canSubmit: v.boolean(),
  canReview: v.boolean(),
});
export const positionView = v.object({
  id: v.id("positions"),
  campaignId: v.id("campaigns"),
  side,
  stakeUnits: v.number(),
  payoutUnits: v.union(v.number(), v.null()),
  outcome: v.union(outcome, v.null()),
});
export const evidenceView = v.object({
  id: v.id("submissions"),
  submittedAt: v.number(),
  status: submissionStatus,
  reason: v.union(v.string(), v.null()),
});
export const checkoutTerms = v.object({
  campaignId: v.id("campaigns"),
  sponsorId: v.id("sponsors"),
  amountUsdCents: v.number(),
  currency: v.literal("USD"),
  sandbox: v.literal(true),
  state,
  providerCheckoutId: v.union(v.string(), v.null()),
  providerVariantId: v.union(v.string(), v.null()),
  checkoutUrl: v.union(v.string(), v.null()),
});
