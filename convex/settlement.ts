import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { campaign, credit, fail, LIMITS } from "./model";
import { outcome as outcomeValidator } from "./validators";

export function allocatePool(
  positions: { id: string; stakeUnits: number }[],
  poolUnits: number,
) {
  const total = positions.reduce((sum, p) => sum + BigInt(p.stakeUnits), 0n);
  if (total === 0n) return [];
  const rows = positions.map((p) => ({
    ...p,
    units: Number((BigInt(p.stakeUnits) * BigInt(poolUnits)) / total),
    remainder: (BigInt(p.stakeUnits) * BigInt(poolUnits)) % total,
  }));
  rows.sort((a, b) =>
    a.remainder === b.remainder
      ? a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  const left = poolUnits - rows.reduce((sum, p) => sum + p.units, 0);
  return rows.map((p, i) => ({
    id: p.id,
    units: p.units + (i < left ? 1 : 0),
  }));
}
export async function resolveCampaign(
  ctx: MutationCtx,
  campaignId: Id<"campaigns">,
) {
  const prior = await ctx.db
    .query("settlements")
    .withIndex("by_campaignId", (q) => q.eq("campaignId", campaignId))
    .unique();
  if (prior) return { outcome: prior.outcome, settlementId: prior._id };
  const c = await campaign(ctx, campaignId),
    now = Date.now();
  if (!c.published) return null;
  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_campaignId_and_userId", (q) => q.eq("campaignId", c._id))
    .take(LIMITS.participants * LIMITS.submissions + 1);
  if (
    submissions.length > LIMITS.participants * LIMITS.submissions ||
    submissions.length !== c.submissionCount
  )
    fail("Submission count invariant failed");
  const pending = submissions.some((s) => s.status === "pending");
  const approved = submissions
    .filter((s) => s.status === "approved")
    .sort(
      (a, b) =>
        a.submittedAt - b.submittedAt ||
        (a._id < b._id ? -1 : a._id > b._id ? 1 : 0),
    );
  const filled = new Set(approved.map((s) => s.userId)).size >= c.winnerCount;
  if (now < c.deadlineAt && (pending || !filled)) return null;
  if (pending && now < c.reviewDeadlineAt) return null;
  const outcome = pending
    ? ("VOID" as const)
    : approved.length > 0
      ? ("YES" as const)
      : ("NO" as const);
  const positions = await ctx.db
    .query("positions")
    .withIndex("by_campaignId_and_userId", (q) => q.eq("campaignId", c._id))
    .take(LIMITS.positions + 1);
  if (
    positions.length > LIMITS.positions ||
    positions.length !== c.positionCount
  )
    fail("Position count invariant failed");
  const poolUnits = positions.reduce((sum, p) => sum + p.stakeUnits, 0);
  if (poolUnits !== c.yesStakeUnits + c.noStakeUnits)
    fail("Pool conservation invariant failed");
  const winners = positions.filter((p) => p.side === outcome);
  const refunded = outcome === "VOID" || winners.length === 0;
  const payouts = new Map(
    refunded
      ? positions.map((p) => [p._id, p.stakeUnits] as const)
      : allocatePool(
          winners.map((p) => ({ id: p._id, stakeUnits: p.stakeUnits })),
          poolUnits,
        ).map((p) => [p.id, p.units] as const),
  );
  let distributedUnits = 0;
  for (const p of positions) {
    const units = payouts.get(p._id) ?? 0;
    await credit(
      ctx,
      p.userId,
      units,
      refunded ? "refund" : "settlement",
      `settle:${c._id}:${p._id}`,
      c._id,
    );
    await ctx.db.patch("positions", p._id, { payoutUnits: units, outcome });
    distributedUnits += units;
  }
  if (distributedUnits !== poolUnits)
    fail("Settlement conservation invariant failed");
  if (outcome === "YES") {
    const awarded = new Set<Id<"users">>();
    for (const s of approved) {
      if (awarded.has(s.userId)) continue;
      if (awarded.size >= c.winnerCount) break;
      await ctx.db.insert("rewards", {
        campaignId: c._id,
        userId: s.userId,
        submissionId: s._id,
        rewardUsdCents: c.rewardUsdCents,
        status: "represented_not_paid",
      });
      awarded.add(s.userId);
    }
  }
  const settlementId = await ctx.db.insert("settlements", {
    campaignId: c._id,
    outcome,
    poolUnits,
    distributedUnits,
    refunded,
    settledAt: now,
  });
  await ctx.db.patch("campaigns", c._id, {
    state: outcome === "VOID" ? "void" : "resolved",
    outcome,
    predictionClosed: true,
    joinsClosed: true,
  });
  return { outcome, settlementId };
}
export const resolve = internalMutation({
  args: { campaignId: v.id("campaigns") },
  returns: v.union(
    v.object({ outcome: outcomeValidator, settlementId: v.id("settlements") }),
    v.null(),
  ),
  handler: resolveCampaignArgs,
});
async function resolveCampaignArgs(
  ctx: MutationCtx,
  args: { campaignId: Id<"campaigns"> },
) {
  return await resolveCampaign(ctx, args.campaignId);
}
export const transition = internalMutation({
  args: { campaignId: v.id("campaigns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const c = await campaign(ctx, args.campaignId),
      now = Date.now();
    if (!c.published || c.outcome) return null;
    await ctx.db.patch("campaigns", c._id, {
      predictionClosed: now >= c.predictionClosesAt,
      joinsClosed: now >= c.deadlineAt,
      state:
        now >= c.deadlineAt
          ? "review_pending"
          : now >= c.attemptStartsAt
            ? "attempts_open"
            : "prediction_open",
    });
    await resolveCampaign(ctx, c._id);
    return null;
  },
});
