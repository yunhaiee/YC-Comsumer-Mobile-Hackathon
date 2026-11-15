export class InvalidPayment extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidPayment("Invalid provider object");
  }
  return value as Record<string, unknown>;
}

export function usdCents(value: unknown): number {
  const money = record(value);
  if (
    money.currency !== "usd" ||
    money.decimals !== 2 ||
    typeof money.amount !== "string" ||
    !/^\d+(?:\.\d{1,2})?$/.test(money.amount)
  ) {
    throw new InvalidPayment("Invalid USD amount");
  }
  const [whole, fraction = ""] = money.amount.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents))
    throw new InvalidPayment("Invalid USD amount");
  return cents;
}

export function paymentNotice(
  value: unknown,
  webhookId: string,
  accountId: string,
) {
  const event = record(value);
  if (event.id !== webhookId || typeof event.type !== "string") {
    throw new InvalidPayment("Invalid webhook event");
  }
  if (event.type !== "payment.succeeded") return null;
  const payment = record(event.data);
  if (
    event.account_id !== accountId ||
    typeof payment.id !== "string" ||
    !payment.id.startsWith("pay_") ||
    typeof payment.checkout_configuration_id !== "string" ||
    !payment.checkout_configuration_id.startsWith("ch_")
  ) {
    throw new InvalidPayment("Invalid payment reference");
  }
  return {
    paymentId: payment.id,
    checkoutId: payment.checkout_configuration_id,
    eventId: webhookId,
  };
}

export type PaymentBinding = {
  campaignId: string;
  sponsorId: string;
  providerCheckoutId: string;
  providerVariantId: string;
  amountUsdCents: number;
  currency: "USD";
  sandbox: true;
};

type CommonBinding = Pick<
  PaymentBinding,
  | "providerCheckoutId"
  | "providerVariantId"
  | "amountUsdCents"
  | "currency"
  | "sandbox"
>;
export type DepositBinding = CommonBinding & {
  depositId: string;
  userId: string;
};

function validatePaidBinding(
  value: unknown,
  binding: CommonBinding,
  paymentId: string,
  accountId: string,
): number {
  const payment = record(value);
  if (
    binding.sandbox !== true ||
    binding.currency !== "USD" ||
    !Number.isSafeInteger(binding.amountUsdCents) ||
    binding.amountUsdCents < 100 ||
    payment.id !== paymentId ||
    payment.account_id !== accountId ||
    payment.checkout_configuration_id !== binding.providerCheckoutId ||
    payment.variant_id !== binding.providerVariantId ||
    payment.status !== "paid" ||
    payment.substatus !== "succeeded" ||
    payment.currency !== "usd" ||
    typeof payment.paid_at !== "string" ||
    !Number.isFinite(Date.parse(payment.paid_at)) ||
    payment.refunded_at != null ||
    payment.auto_refunded !== false ||
    payment.promo_code_id != null
  ) {
    throw new InvalidPayment("Payment does not match frozen campaign terms");
  }
  const amount = usdCents(payment.total);
  if (
    amount !== binding.amountUsdCents ||
    (payment.refunded_amount != null && usdCents(payment.refunded_amount) !== 0)
  ) {
    throw new InvalidPayment(
      "Payment amount does not match frozen campaign terms",
    );
  }
  return amount;
}

export function validatePayment(
  value: unknown,
  binding: PaymentBinding,
  paymentId: string,
  accountId: string,
): number {
  const amount = validatePaidBinding(value, binding, paymentId, accountId);
  const metadata = record(record(value).metadata);
  if (
    metadata.dare_campaign_id !== binding.campaignId ||
    metadata.dare_sponsor_id !== binding.sponsorId ||
    metadata.dare_environment !== "sandbox" ||
    metadata.kind === "deposit"
  )
    throw new InvalidPayment("Payment does not match frozen campaign terms");
  return amount;
}

export function validateDepositPayment(
  value: unknown,
  binding: DepositBinding,
  paymentId: string,
  accountId: string,
): number {
  const amount = validatePaidBinding(value, binding, paymentId, accountId);
  const metadata = record(record(value).metadata);
  if (
    amount < 500 ||
    amount > 50_000 ||
    metadata.kind !== "deposit" ||
    metadata.depositId !== binding.depositId ||
    metadata.userId !== binding.userId ||
    metadata.currency !== "USD" ||
    metadata.sandbox !== "true"
  )
    throw new InvalidPayment("Payment does not match frozen deposit terms");
  return amount;
}

export function sandboxCheckoutUrl(value: unknown): string {
  if (typeof value !== "string")
    throw new InvalidPayment("Checkout URL is missing");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "sandbox.whop.com" ||
    url.username ||
    url.password ||
    url.port ||
    !url.pathname.startsWith("/checkout/")
  ) {
    throw new InvalidPayment("Provider returned a non-sandbox checkout");
  }
  return url.toString();
}
