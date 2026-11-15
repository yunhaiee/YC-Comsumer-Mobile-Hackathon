import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { campaign, fail, integer, reviewer } from "./model";
import { checkoutTerms } from "./validators";

function terms(c: Doc<"campaigns">) {
  return {
    predictionClosesAt: c.predictionClosesAt,
    campaignId: c._id,
    sponsorId: c.sponsorId,
    amountUsdCents: c.amountUsdCents,
    currency: "USD" as const,
    sandbox: true as const,
    state: c.state,
    providerCheckoutId: c.providerCheckoutId ?? null,
    providerVariantId: c.providerVariantId ?? null,
    checkoutUrl: c.checkoutUrl ?? null,
  };
}
export const getCheckoutTerms = internalQuery({
  args: { campaignId: v.id("campaigns") },
  returns: checkoutTerms,
  handler: async (ctx, args) => {
    const c = await campaign(ctx, args.campaignId);
    await reviewer(ctx, c);
    return terms(c);
  },
});
export const recordCheckout = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    providerCheckoutId: v.string(),
    providerVariantId: v.string(),
    checkoutUrl: v.string(),
  },
  returns: checkoutTerms,
  handler: async (ctx, args) => {
    const c = await campaign(ctx, args.campaignId);
    await reviewer(ctx, c);
    if (c.providerCheckoutId) {
      if (
        c.providerCheckoutId !== args.providerCheckoutId ||
        c.providerVariantId !== args.providerVariantId ||
        c.checkoutUrl !== args.checkoutUrl
      )
        fail("Checkout binding is immutable");
      return terms(c);
    }
    if (c.state !== "draft" || Date.now() >= c.predictionClosesAt)
      fail("Campaign cannot accept checkout");
    if (
      !/^ch_[A-Za-z0-9]+$/.test(args.providerCheckoutId) ||
      !/^plan_[A-Za-z0-9]+$/.test(args.providerVariantId)
    )
      fail("Invalid provider binding");
    const url = new URL(args.checkoutUrl);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "sandbox.whop.com" ||
      url.username ||
      url.password ||
      url.port ||
      !url.pathname.startsWith("/checkout/")
    )
      fail("Invalid checkout URL");
    const other = await ctx.db
      .query("campaigns")
      .withIndex("by_providerCheckoutId", (q) =>
        q.eq("providerCheckoutId", args.providerCheckoutId),
      )
      .unique();
    if (other) fail("Checkout already bound");
    const patch = {
      providerCheckoutId: args.providerCheckoutId,
      providerVariantId: args.providerVariantId,
      checkoutUrl: args.checkoutUrl,
      state: "awaiting_payment" as const,
    };
    await ctx.db.patch("campaigns", c._id, patch);
    return terms({ ...c, ...patch });
  },
});
export const getPaymentTerms = internalQuery({
  args: { providerCheckoutId: v.string() },
  returns: v.union(checkoutTerms, v.null()),
  handler: async (ctx, args) => {
    const c = await ctx.db
      .query("campaigns")
      .withIndex("by_providerCheckoutId", (q) =>
        q.eq("providerCheckoutId", args.providerCheckoutId),
      )
      .unique();
    return c ? terms(c) : null;
  },
});
export const activateCampaign = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    providerCheckoutId: v.string(),
    providerPaymentId: v.string(),
    providerEventId: v.string(),
    amountUsdCents: v.number(),
    currency: v.literal("USD"),
    sandbox: v.literal(true),
  },
  returns: v.union(
    v.object({
      campaignId: v.id("campaigns"),
      paymentId: v.id("payments"),
      state: v.literal("prediction_open"),
    }),
    v.object({
      campaignId: v.id("campaigns"),
      paymentId: v.id("payments"),
      state: v.literal("void"),
      disposition: v.literal("refund_required"),
    }),
  ),
  handler: async (ctx, args) => {
    integer(args.amountUsdCents, 1, 2_000_000, "payment amount");
    if (
      !args.providerPaymentId ||
      args.providerPaymentId.length > 200 ||
      !args.providerEventId ||
      args.providerEventId.length > 200
    )
      fail("Invalid payment identity");
    const c = await campaign(ctx, args.campaignId);
    if (
      c.providerCheckoutId !== args.providerCheckoutId ||
      c.amountUsdCents !== args.amountUsdCents
    )
      fail("Payment terms mismatch");
    const prior = await ctx.db
      .query("payments")
      .withIndex("by_providerPaymentId", (q) =>
        q.eq("providerPaymentId", args.providerPaymentId),
      )
      .unique();
    const event = await ctx.db
      .query("paymentEvents")
      .withIndex("by_providerEventId", (q) =>
        q.eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (prior) {
      if (
        prior.campaignId !== c._id ||
        prior.providerCheckoutId !== args.providerCheckoutId ||
        prior.amountUsdCents !== args.amountUsdCents ||
        (event && event.paymentId !== prior._id)
      )
        fail("Payment identity conflict");
      if (!event)
        await ctx.db.insert("paymentEvents", {
          providerEventId: args.providerEventId,
          paymentId: prior._id,
        });
      if (prior.disposition === "refund_required") {
        return {
          campaignId: c._id,
          paymentId: prior._id,
          state: "void" as const,
          disposition: "refund_required" as const,
        };
      }
      return {
        campaignId: c._id,
        paymentId: prior._id,
        state: "prediction_open" as const,
      };
    }
    if (
      event ||
      c.state !== "awaiting_payment" ||
      c.published ||
      c.outcome !== null
    )
      fail("Campaign cannot activate");
    if (
      await ctx.db
        .query("payments")
        .withIndex("by_campaignId", (q) => q.eq("campaignId", c._id))
        .unique()
    )
      fail("Campaign already paid");
    const late = Date.now() >= c.predictionClosesAt;
    if (late) {
      const participant = await ctx.db
        .query("participations")
        .withIndex("by_campaignId_and_userId", (q) => q.eq("campaignId", c._id))
        .take(1);
      const position = await ctx.db
        .query("positions")
        .withIndex("by_campaignId_and_userId", (q) => q.eq("campaignId", c._id))
        .take(1);
      const submission = await ctx.db
        .query("submissions")
        .withIndex("by_campaignId_and_userId", (q) => q.eq("campaignId", c._id))
        .take(1);
      if (
        c.participantCount !== 0 ||
        c.positionCount !== 0 ||
        c.submissionCount !== 0 ||
        c.pendingCount !== 0 ||
        c.yesStakeUnits !== 0 ||
        c.noStakeUnits !== 0 ||
        participant.length ||
        position.length ||
        submission.length
      )
        fail("Unpublished campaign activity invariant failed");
    }
    const { providerEventId, ...payment } = args;
    const paymentId = await ctx.db.insert("payments", {
      ...payment,
      receivedAt: Date.now(),
      disposition: late ? "refund_required" : "activated",
    });
    await ctx.db.insert("paymentEvents", { providerEventId, paymentId });
    if (late) {
      await ctx.db.patch("campaigns", c._id, {
        state: "void",
        outcome: "VOID",
        published: false,
        predictionClosed: true,
        joinsClosed: true,
        paymentIssue: "late_payment_refund_required",
      });
      return {
        campaignId: c._id,
        paymentId,
        state: "void" as const,
        disposition: "refund_required" as const,
      };
    }
    await ctx.db.patch("campaigns", c._id, {
      state: "prediction_open",
      published: true,
    });
    for (const when of new Set([
      c.predictionClosesAt,
      c.attemptStartsAt,
      c.deadlineAt,
      c.reviewDeadlineAt,
    ]))
      await ctx.scheduler.runAt(when, internal.settlement.transition, {
        campaignId: c._id,
      });
    return { campaignId: c._id, paymentId, state: "prediction_open" as const };
  },
});
