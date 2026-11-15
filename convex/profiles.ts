import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { membership } from "./model";
import { positionView, SANDBOX_MONEY, sandboxMoney } from "./validators";

export const me = query({
  args: {},
  returns: v.union(
    v.object({
      ...sandboxMoney.fields,
      id: v.id("users"),
      balanceUnits: v.number(),
      isSponsor: v.boolean(),
      sponsorId: v.union(v.id("sponsors"), v.null()),
      positions: v.array(positionView),
      deposits: v.array(
        v.object({
          amountUsdCents: v.number(),
          status: v.union(v.literal("pending"), v.literal("completed")),
          createdAt: v.number(),
        }),
      ),
      rewards: v.array(
        v.object({
          campaignId: v.id("campaigns"),
          rewardUsdCents: v.number(),
          status: v.literal("represented_not_paid"),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const id = await getAuthUserId(ctx),
      u = id ? await ctx.db.get("users", id) : null;
    if (!u) return null;
    const m = await membership(ctx, u._id);
    const positions = await ctx.db
      .query("positions")
      .withIndex("by_userId", (q) => q.eq("userId", u._id))
      .order("desc")
      .take(100);
    const rewards = await ctx.db
      .query("rewards")
      .withIndex("by_userId", (q) => q.eq("userId", u._id))
      .order("desc")
      .take(100);
    const deposits = await ctx.db
      .query("deposits")
      .withIndex("by_userId", (q) => q.eq("userId", u._id))
      .order("desc")
      .take(50);
    return {
      ...SANDBOX_MONEY,
      id: u._id,
      balanceUnits: u.balanceUnits,
      isSponsor: !!m,
      sponsorId: m?.sponsorId ?? null,
      deposits: deposits.map((d) => ({
        amountUsdCents: d.amountUsdCents,
        status: d.status,
        createdAt: d.createdAt,
      })),
      positions: positions.map((p) => ({
        id: p._id,
        campaignId: p.campaignId,
        side: p.side,
        stakeUnits: p.stakeUnits,
        payoutUnits: p.payoutUnits,
        outcome: p.outcome,
      })),
      rewards: rewards.map((r) => ({
        campaignId: r.campaignId,
        rewardUsdCents: r.rewardUsdCents,
        status: r.status,
      })),
    };
  },
});
