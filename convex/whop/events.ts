"use node";

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { whopConfig } from "./client";
import { InvalidPayment, validatePayment } from "./validation";

export const handle = internalAction({
  args: { paymentId: v.string(), checkoutId: v.string(), eventId: v.string() },
  returns: v.object({ status: v.number() }),
  handler: async (ctx, notice) => {
    try {
      const { client, accountId } = whopConfig();
      const terms = await ctx.runQuery(internal.payments.getPaymentTerms, { providerCheckoutId: notice.checkoutId });
      if (!terms || !terms.providerCheckoutId || !terms.providerVariantId) return { status: 503 };
      const payment = await client.payments.retrieve({ id: notice.paymentId }, { timeoutInSeconds: 3, maxRetries: 0 });
      const amountUsdCents = validatePayment(payment, {
        ...terms,
        providerCheckoutId: terms.providerCheckoutId,
        providerVariantId: terms.providerVariantId,
      }, notice.paymentId, accountId);
      await ctx.runMutation(internal.payments.activateCampaign, {
        campaignId: terms.campaignId,
        providerCheckoutId: notice.checkoutId,
        providerPaymentId: notice.paymentId,
        providerEventId: notice.eventId,
        amountUsdCents,
        currency: "USD",
        sandbox: true,
      });
      return { status: 200 };
    } catch (error) {
      return { status: error instanceof InvalidPayment ? 400 : 503 };
    }
  },
});
