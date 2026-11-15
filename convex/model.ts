import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export const LIMITS = {
  participants: 50,
  positions: 100,
  submissions: 3,
  tickets: 10,
  uploadBytes: 25 * 1024 * 1024,
  grantUnits: 100_000,
};
export function fail(message: string): never {
  throw new ConvexError(message);
}
export function integer(value: number, min: number, max: number, name: string) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    fail(`Invalid ${name}`);
}
export function requestKey(value: string) {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(value)) fail("Invalid requestId");
}
export async function user(ctx: QueryCtx) {
  const id = await getAuthUserId(ctx);
  const record = id ? await ctx.db.get("users", id) : null;
  if (!record) fail("Sign in required");
  return record;
}
export async function campaign(ctx: QueryCtx, id: Id<"campaigns">) {
  const record = await ctx.db.get("campaigns", id);
  if (!record) fail("Campaign not found");
  return record;
}
export async function membership(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("memberships")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}
export async function reviewer(ctx: QueryCtx, c: Doc<"campaigns">) {
  const u = await user(ctx);
  const m = await membership(ctx, u._id);
  if (m?.sponsorId !== c.sponsorId) fail("Sponsor review permission required");
  return u;
}
export async function participation(
  ctx: QueryCtx,
  campaignId: Id<"campaigns">,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("participations")
    .withIndex("by_campaignId_and_userId", (q) =>
      q.eq("campaignId", campaignId).eq("userId", userId),
    )
    .unique();
}
export async function position(
  ctx: QueryCtx,
  campaignId: Id<"campaigns">,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("positions")
    .withIndex("by_campaignId_and_userId", (q) =>
      q.eq("campaignId", campaignId).eq("userId", userId),
    )
    .unique();
}
export function summary(c: Doc<"campaigns">) {
  const counts = {
    submissionCount: c.submissionCount,
    pendingCount: c.pendingCount,
  };
  return {
    paymentIssue: c.paymentIssue ?? null,
    ...counts,
    id: c._id,
    title: c.title,
    description: c.description,
    sponsorName: c.sponsorName,
    mediaUrl: null,
    criteria: c.criteria,
    winnerCount: c.winnerCount,
    rewardUsdCents: c.rewardUsdCents,
    predictionClosesAt: c.predictionClosesAt,
    attemptStartsAt: c.attemptStartsAt,
    deadlineAt: c.deadlineAt,
    reviewDeadlineAt: c.reviewDeadlineAt,
    state: c.state,
    participantCount: c.participantCount,
    outcome: c.outcome,
    isDemo: c.isDemo,
  };
}
export async function eligibility(ctx: QueryCtx, c: Doc<"campaigns">) {
  const id = await getAuthUserId(ctx);
  if (!id)
    return {
      role: null,
      canJoin: false,
      canPredict: false,
      canSubmit: false,
      canReview: false,
    };
  const [m, p, stake] = await Promise.all([
    membership(ctx, id),
    participation(ctx, c._id, id),
    position(ctx, c._id, id),
  ]);
  const isReviewer = m?.sponsorId === c.sponsorId;
  const role = isReviewer
    ? ("reviewer" as const)
    : p
      ? ("participant" as const)
      : stake
        ? ("predictor" as const)
        : null;
  const live = c.state === "prediction_open" || c.state === "attempts_open";
  return {
    role,
    canJoin:
      live &&
      !c.joinsClosed &&
      !role &&
      !m &&
      c.participantCount < LIMITS.participants,
    canPredict:
      live &&
      !c.predictionClosed &&
      !m &&
      !p &&
      (!!stake || c.positionCount < LIMITS.positions),
    canSubmit:
      c.state === "attempts_open" &&
      !!p &&
      p.submissionCount < LIMITS.submissions,
    canReview: isReviewer && (live || c.state === "review_pending"),
  };
}
export async function credit(
  ctx: MutationCtx,
  userId: Id<"users">,
  deltaUnits: number,
  kind: Doc<"ledger">["kind"],
  key: string,
  campaignId?: Id<"campaigns">,
) {
  const prior = await ctx.db
    .query("ledger")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (prior) fail("Duplicate ledger entry");
  const u = await ctx.db.get("users", userId);
  if (!u) fail("Account not found");
  const balanceUnits = u.balanceUnits + deltaUnits;
  integer(balanceUnits, 0, Number.MAX_SAFE_INTEGER, "balance");
  await ctx.db.patch("users", userId, { balanceUnits });
  await ctx.db.insert("ledger", {
    userId,
    campaignId,
    deltaUnits,
    balanceUnits,
    kind,
    key,
    createdAt: Date.now(),
  });
  return balanceUnits;
}
