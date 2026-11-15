import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { credit, fail, integer, requestKey, user } from "./model";
import { sandboxCheckoutUrl } from "./whop/validation";

const depositTerms = v.object({
  depositId: v.id("deposits"),
  userId: v.id("users"),
  amountUsdCents: v.number(),
  currency: v.literal("USD"),
  sandbox: v.literal(true),
  status: v.union(v.literal("pending"), v.literal("completed")),
  providerCheckoutId: v.union(v.string(), v.null()),
  providerVariantId: v.union(v.string(), v.null()),
  checkoutUrl: v.union(v.string(), v.null()),
});
function terms(d: Doc<"deposits">) {
  return {
    depositId: d._id,
    userId: d.userId,
    amountUsdCents: d.amountUsdCents,
    currency: "USD" as const,
    sandbox: true as const,
    status: d.status,
    providerCheckoutId: d.providerCheckoutId ?? null,
    providerVariantId: d.providerVariantId ?? null,
    checkoutUrl: d.checkoutUrl ?? null,
  };
}
export const prepare = internalMutation({
  args: { amountUsdCents: v.number(), requestId: v.string() },
  returns: depositTerms,
  handler: async (ctx, args) => {
    const u = await user(ctx);
    integer(args.amountUsdCents, 500, 50_000, "deposit amountUsdCents");
    requestKey(args.requestId);
    const prior = await ctx.db
      .query("deposits")
      .withIndex("by_userId_and_requestId", (q) =>
        q.eq("userId", u._id).eq("requestId", args.requestId),
      )
      .unique();
    if (prior) {
      if (prior.amountUsdCents !== args.amountUsdCents)
        fail("requestId payload conflict");
      return terms(prior);
    }
    const depositId = await ctx.db.insert("deposits", {
      ...args,
      userId: u._id,
      createdAt: Date.now(),
      status: "pending",
    });
    const d = await ctx.db.get("deposits", depositId);
    if (!d) fail("Deposit unavailable");
    return terms(d);
  },
});
export const recordCheckout = internalMutation({
  args: {
    depositId: v.id("deposits"),
    providerCheckoutId: v.string(),
    providerVariantId: v.string(),
    checkoutUrl: v.string(),
  },
  returns: depositTerms,
  handler: async (ctx, args) => {
    const u = await user(ctx),
      d = await ctx.db.get("deposits", args.depositId);
    if (!d || d.userId !== u._id) fail("Deposit owner required");
    const checkoutUrl = sandboxCheckoutUrl(args.checkoutUrl);
    if (
      !/^ch_[A-Za-z0-9]+$/.test(args.providerCheckoutId) ||
      !/^plan_[A-Za-z0-9]+$/.test(args.providerVariantId)
    )
      fail("Invalid provider binding");
    if (d.providerCheckoutId) {
      if (
        d.providerCheckoutId !== args.providerCheckoutId ||
        d.providerVariantId !== args.providerVariantId ||
        d.checkoutUrl !== checkoutUrl
      )
        fail("Checkout binding is immutable");
      return terms(d);
    }
    if (d.status !== "pending") fail("Deposit already completed");
    const campaign = await ctx.db
      .query("campaigns")
      .withIndex("by_providerCheckoutId", (q) =>
        q.eq("providerCheckoutId", args.providerCheckoutId),
      )
      .unique();
    const other = await ctx.db
      .query("deposits")
      .withIndex("by_providerCheckoutId", (q) =>
        q.eq("providerCheckoutId", args.providerCheckoutId),
      )
      .unique();
    if (campaign || other) fail("Checkout already bound");
    const patch = {
      providerCheckoutId: args.providerCheckoutId,
      providerVariantId: args.providerVariantId,
      checkoutUrl,
    };
    await ctx.db.patch("deposits", d._id, patch);
    return terms({ ...d, ...patch });
  },
});
export const getPaymentTerms = internalQuery({
  args: { providerCheckoutId: v.string() },
  returns: v.union(depositTerms, v.null()),
  handler: async (ctx, args) => {
    const d = await ctx.db
      .query("deposits")
      .withIndex("by_providerCheckoutId", (q) =>
        q.eq("providerCheckoutId", args.providerCheckoutId),
      )
      .unique();
    return d ? terms(d) : null;
  },
});
export const complete = internalMutation({
  args: {
    depositId: v.id("deposits"),
    providerCheckoutId: v.string(),
    providerPaymentId: v.string(),
    providerEventId: v.string(),
    amountUsdCents: v.number(),
    currency: v.literal("USD"),
    sandbox: v.literal(true),
  },
  returns: v.object({
    depositId: v.id("deposits"),
    paymentId: v.id("depositPayments"),
    status: v.literal("completed"),
    balanceUnits: v.number(),
  }),
  handler: async (ctx, args) => {
    integer(args.amountUsdCents, 500, 50_000, "deposit amountUsdCents");
    if (
      !args.providerPaymentId ||
      args.providerPaymentId.length > 200 ||
      !args.providerEventId ||
      args.providerEventId.length > 200
    )
      fail("Invalid payment identity");
    const d = await ctx.db.get("deposits", args.depositId);
    if (
      !d ||
      d.providerCheckoutId !== args.providerCheckoutId ||
      d.amountUsdCents !== args.amountUsdCents
    )
      fail("Deposit payment terms mismatch");
    const campaignPayment = await ctx.db
      .query("payments")
      .withIndex("by_providerPaymentId", (q) =>
        q.eq("providerPaymentId", args.providerPaymentId),
      )
      .unique();
    const campaignEvent = await ctx.db
      .query("paymentEvents")
      .withIndex("by_providerEventId", (q) =>
        q.eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (campaignPayment || campaignEvent) fail("Payment identity conflict");
    const prior = await ctx.db
      .query("depositPayments")
      .withIndex("by_providerPaymentId", (q) =>
        q.eq("providerPaymentId", args.providerPaymentId),
      )
      .unique();
    const event = await ctx.db
      .query("depositEvents")
      .withIndex("by_providerEventId", (q) =>
        q.eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (prior) {
      if (
        prior.depositId !== d._id ||
        prior.userId !== d.userId ||
        prior.providerCheckoutId !== args.providerCheckoutId ||
        prior.amountUsdCents !== args.amountUsdCents ||
        (event && event.paymentId !== prior._id)
      )
        fail("Payment identity conflict");
      if (!event)
        await ctx.db.insert("depositEvents", {
          providerEventId: args.providerEventId,
          paymentId: prior._id,
        });
      return {
        depositId: d._id,
        paymentId: prior._id,
        status: "completed" as const,
        balanceUnits: prior.balanceUnits,
      };
    }
    if (
      event ||
      d.status !== "pending" ||
      (await ctx.db
        .query("depositPayments")
        .withIndex("by_depositId", (q) => q.eq("depositId", d._id))
        .unique())
    )
      fail("Deposit already completed or event reused");
    const balanceUnits = await credit(
      ctx,
      d.userId,
      args.amountUsdCents,
      "deposit",
      `deposit:${args.providerPaymentId}`,
    );
    const { providerEventId, ...receipt } = args;
    const paymentId = await ctx.db.insert("depositPayments", {
      ...receipt,
      userId: d.userId,
      receivedAt: Date.now(),
      balanceUnits,
    });
    await ctx.db.insert("depositEvents", { providerEventId, paymentId });
    await ctx.db.patch("deposits", d._id, { status: "completed" });
    return {
      depositId: d._id,
      paymentId,
      status: "completed" as const,
      balanceUnits,
    };
  },
});
