"use node";

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { whopConfig } from "./client";
import {
  InvalidPayment,
  validateDepositPayment,
  validatePayment,
} from "./validation";

export const handle = internalAction({
  args: { paymentId: v.string(), checkoutId: v.string(), eventId: v.string() },
  returns: v.object({ status: v.number() }),
  handler: async (ctx, notice) => {
    try {
      const { client, accountId } = whopConfig();
      const terms = await ctx.runQuery(internal.payments.getPaymentTerms, {
        providerCheckoutId: notice.checkoutId,
      });
      const deposit = await ctx.runQuery(internal.deposits.getPaymentTerms, {
        providerCheckoutId: notice.checkoutId,
      });
      if (terms && deposit) return { status: 503 };
      if (deposit) {
        if (!deposit.providerCheckoutId || !deposit.providerVariantId)
          return { status: 503 };
        const payment = await client.payments.retrieve(
          { id: notice.paymentId },
          { timeoutInSeconds: 3, maxRetries: 0 },
        );
        const amountUsdCents = validateDepositPayment(
          payment,
          {
            ...deposit,
            providerCheckoutId: deposit.providerCheckoutId,
            providerVariantId: deposit.providerVariantId,
          },
          notice.paymentId,
          accountId,
        );
        await ctx.runMutation(internal.deposits.complete, {
          depositId: deposit.depositId,
          providerCheckoutId: notice.checkoutId,
          providerPaymentId: notice.paymentId,
          providerEventId: notice.eventId,
          amountUsdCents,
          currency: "USD",
          sandbox: true,
        });
        return { status: 200 };
      }
      if (!terms || !terms.providerCheckoutId || !terms.providerVariantId)
        return { status: 503 };
      const payment = await client.payments.retrieve(
        { id: notice.paymentId },
        { timeoutInSeconds: 3, maxRetries: 0 },
      );
      const amountUsdCents = validatePayment(
        payment,
        {
          ...terms,
          providerCheckoutId: terms.providerCheckoutId,
          providerVariantId: terms.providerVariantId,
        },
        notice.paymentId,
        accountId,
      );
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
