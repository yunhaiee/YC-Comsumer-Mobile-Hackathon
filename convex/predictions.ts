import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  campaign,
  credit,
  eligibility,
  fail,
  integer,
  LIMITS,
  membership,
  participation,
  position,
  requestKey,
  user,
} from "./model";
import {
  positionView,
  SANDBOX_MONEY,
  sandboxMoney,
  side,
  viewer,
} from "./validators";

export const getMarket = query({
  args: { campaignId: v.id("campaigns") },
  returns: v.object({
    ...sandboxMoney.fields,
    yesStakeUnits: v.number(),
    noStakeUnits: v.number(),
    position: v.union(positionView, v.null()),
    viewer,
  }),
  handler: async (ctx, args) => {
    const c = await campaign(ctx, args.campaignId);
    const view = await eligibility(ctx, c);
    if (!c.published && view.role !== "reviewer") fail("Campaign not found");
    const u = view.role === "predictor" ? await user(ctx) : null;
    const p = u ? await position(ctx, c._id, u._id) : null;
    return {
      ...SANDBOX_MONEY,
      yesStakeUnits: c.yesStakeUnits,
      noStakeUnits: c.noStakeUnits,
      viewer: view,
      position: p
        ? {
            id: p._id,
            campaignId: p.campaignId,
            side: p.side,
            stakeUnits: p.stakeUnits,
            payoutUnits: p.payoutUnits,
            outcome: p.outcome,
          }
        : null,
    };
  },
});
export const quote = query({
  args: { campaignId: v.id("campaigns"), side, stakeUnits: v.number() },
  returns: v.object({
    ...sandboxMoney.fields,
    stakeUnits: v.number(),
    estimatedGrossPayoutUnits: v.number(),
    estimatedNetProfitUnits: v.number(),
    maximumLossUnits: v.number(),
    label: v.string(),
    eligible: v.boolean(),
  }),
  handler: async (ctx, args) => {
    integer(args.stakeUnits, 1, 1_000_000, "stakeUnits");
    const c = await campaign(ctx, args.campaignId);
    if (!c.published) fail("Campaign not found");
    const view = await eligibility(ctx, c);
    const same = args.side === "YES" ? c.yesStakeUnits : c.noStakeUnits;
    const gross = Number(
      (BigInt(args.stakeUnits) *
        BigInt(c.yesStakeUnits + c.noStakeUnits + args.stakeUnits)) /
        BigInt(same + args.stakeUnits),
    );
    let eligible = view.canPredict;
    if (eligible) {
      const u = await user(ctx),
        p = await position(ctx, c._id, u._id);
      eligible =
        u.balanceUnits >= args.stakeUnits && (!p || p.side === args.side);
    }
    return {
      ...SANDBOX_MONEY,
      stakeUnits: args.stakeUnits,
      estimatedGrossPayoutUnits: gross,
      estimatedNetProfitUnits: gross - args.stakeUnits,
      maximumLossUnits: args.stakeUnits,
      label:
        "Variable return if your side wins; pool changes until cutoff. Sandbox USD (demo dollars), not real money. 100 units = $1 demo; no deposits, withdrawals, or redemption.",
      eligible,
    };
  },
});
export const place = mutation({
  args: {
    campaignId: v.id("campaigns"),
    side,
    stakeUnits: v.number(),
    requestId: v.string(),
  },
  returns: v.object({
    ...sandboxMoney.fields,
    positionId: v.id("positions"),
    balanceUnits: v.number(),
  }),
  handler: async (ctx, args) => {
    requestKey(args.requestId);
    integer(args.stakeUnits, 1, 1_000_000, "stakeUnits");
    const u = await user(ctx);
    const prior = await ctx.db
      .query("predictionRequests")
      .withIndex("by_userId_and_requestId", (q) =>
        q.eq("userId", u._id).eq("requestId", args.requestId),
      )
      .unique();
    if (prior) {
      if (
        prior.campaignId !== args.campaignId ||
        prior.side !== args.side ||
        prior.stakeUnits !== args.stakeUnits
      )
        fail("requestId payload conflict");
      return {
        ...SANDBOX_MONEY,
        positionId: prior.positionId,
        balanceUnits: prior.balanceUnits,
      };
    }
    const c = await campaign(ctx, args.campaignId);
    if (!c.published || c.outcome || Date.now() >= c.predictionClosesAt)
      fail("Predictions are closed");
    if (await membership(ctx, u._id)) fail("Sponsor reviewers cannot predict");
    if (await participation(ctx, c._id, u._id))
      fail("Participants cannot predict");
    const p = await position(ctx, c._id, u._id);
    if (p && p.side !== args.side) fail("Prediction side is locked");
    if (!p && c.positionCount >= LIMITS.positions)
      fail("Prediction position limit reached");
    integer(
      c.yesStakeUnits + c.noStakeUnits + args.stakeUnits,
      1,
      1_000_000_000,
      "pool units",
    );
    if (u.balanceUnits < args.stakeUnits)
      fail("Insufficient sandbox USD (demo dollars)");
    const balanceUnits = await credit(
      ctx,
      u._id,
      -args.stakeUnits,
      "stake",
      `stake:${u._id}:${args.requestId}`,
      c._id,
    );
    const positionId =
      p?._id ??
      (await ctx.db.insert("positions", {
        campaignId: c._id,
        userId: u._id,
        side: args.side,
        stakeUnits: 0,
        payoutUnits: null,
        outcome: null,
      }));
    await ctx.db.patch("positions", positionId, {
      stakeUnits: (p?.stakeUnits ?? 0) + args.stakeUnits,
    });
    await ctx.db.patch("campaigns", c._id, {
      positionCount: c.positionCount + (p ? 0 : 1),
      yesStakeUnits:
        c.yesStakeUnits + (args.side === "YES" ? args.stakeUnits : 0),
      noStakeUnits: c.noStakeUnits + (args.side === "NO" ? args.stakeUnits : 0),
    });
    await ctx.db.insert("predictionRequests", {
      ...args,
      userId: u._id,
      positionId,
      balanceUnits,
    });
    return { ...SANDBOX_MONEY, positionId, balanceUnits };
  },
});
