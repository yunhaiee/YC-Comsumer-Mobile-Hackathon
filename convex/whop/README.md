# DARE sandbox sponsorship

This module uses `@whop/sdk` 2.8.1's current checkout configurations and variants API. It never selects production, invokes payouts, or activates a campaign from a redirect.

## Configure the shared development deployment

1. Create a sandbox account at <https://sandbox.whop.com>. Its account, keys and webhooks are separate from production. Do not use the Whop CLI or MCP server to provision sandbox resources; those operate on production.
2. At <https://sandbox.whop.com/dashboard/developer>, create a sandbox **Account API Key**. Whop's sandbox quickstart uses the Admin role. Store the key as `WHOP_API_KEY` in the Convex development deployment's environment, never in an `EXPO_PUBLIC_` variable or source file.
3. Read the account ID with `client.accounts.me()` on a `WhopClient` configured with `WhopEnvironment.Sandbox`. Store its `biz_` ID as `WHOP_ACCOUNT_ID`.
4. Set `WHOP_CHECKOUT_RETURN_URL` to `https://fastidious-gnat-814.convex.site/whop/return`. Whop requires HTTPS; a `dare:` URL is not a supported provider redirect. The static landing page offers an `Open DARE` link to `dare://sponsor`. It never reads payment state or activates a campaign. Redirects are navigation only.
5. Register an enabled sandbox webhook for `payment.succeeded`, pointing to `https://<development-deployment>.convex.site/whop/webhook` (the HTTP site URL, not `.convex.cloud`). Use the sandbox account as `resource_id`, set `child_resource_events: false`, and pin `api_version_date: "2026-11-14-1"`. Store its one-time `ws_` signing secret verbatim as `WHOP_WEBHOOK_SECRET` in the same Convex deployment.

No product ID is required. Each authenticated campaign checkout creates a one-time inline variant at the backend-frozen USD amount, with one unit of stock. Before returning the URL, the action disables adaptive currency pricing and multiple quantities through the current variants API, validates the response, and saves the checkout and variant IDs through TK's sponsor-authorized mutation. Retries reuse the stored URL; provider creation requests also carry a stable idempotency key.

All four variables are server-only. The account ID and return URL are configuration, while the API key and webhook secret are credentials. SDK logging is disabled; provider responses and credentials are not returned in errors.

If Whop returns `400` with `idempotency_key_mismatch`, the first checkout attempt used different configuration (for example, a return URL that has since changed). The app instructs the sponsor to create a new campaign. Do not retry with an alternate idempotency key or replace the old campaign's binding: that could create a second payable checkout. Existing paid campaigns are unchanged. Other provider failures retain the generic retry message; diagnostics log only the HTTP status and an allowlisted category, never raw provider content.

## Contract

- `api.whop.checkout.create({ campaignId })` returns `{ checkoutUrl, sandbox: true }` only after the sponsor-owned frozen terms are bound to that checkout. It returns no payment success claim.
- `whopWebhook` is exported from `convex/whop/webhook.ts`. TK registers `POST /whop/webhook` in `convex/http.ts`.
- The HTTP action verifies the exact raw body with `unwrapWebhook` before accepting an event. Failed, pending and cancelled events do not activate campaigns.
- A signed success notice contains only references. The Node action retrieves the payment again from the sandbox API and checks its account, checkout, variant, campaign/sponsor metadata, paid status, USD currency, exact decimal amount, and refund/discount state.
- `internal.payments.activateCampaign` receives `campaignId`, `providerCheckoutId`, `providerPaymentId`, `providerEventId`, `amountUsdCents`, `currency: "USD"`, and `sandbox: true`. TK validates the stored binding and deduplicates payment/event IDs atomically. Unknown bindings and transient failures return 503 for provider retry; invalid signatures or mismatches return 400.
- UI success comes only from reactive campaign state. Closing checkout or following a return link leaves an unconfirmed campaign inactive.

## Sandbox USD deposits

`api.whop.deposits.create({ amountUsdCents, requestId })` requires a signed-in user and an integer amount from 500 to 50000 ($5–$500). It returns only `{ checkoutUrl }`. The server persists an owner-bound, immutable deposit intent before calling Whop, uses `dare:deposit:<depositId>:v1` as the provider idempotency key, and saves the checkout/variant binding once. Retry the same intent with the same request ID and amount; changing the amount under that request ID is rejected. Metadata is server-owned: `kind: "deposit"`, `depositId`, `userId`, `currency: "USD"`, and `sandbox: "true"`.

The signed webhook chooses campaign or deposit by the stored checkout binding, never by metadata alone. It retrieves the payment from the hardcoded sandbox API, verifies the frozen owner/amount/checkout/variant and exact metadata, then credits one `deposit` ledger row per provider payment. Both campaign and deposit handlers transactionally check both payment/event namespaces, preventing reuse across targets. Redirects, forged events, pending/failed payments, and unmatched provider values never credit balances.

New accounts begin at zero and receive no free grant. Existing balances, historical grant rows, and all `*Units` API/storage names and values remain unchanged: 100 units represent $1 sandbox USD. Profile responses expose `currency: "USD"`, `moneyMode: "sandbox"`, and at most 50 recent deposit summaries containing only `amountUsdCents`, `status: "pending" | "completed"`, and `createdAt`. Closing or failing a checkout leaves it pending; no cancellation is invented. These are demo dollars with no real money, withdrawals, redemption, or automatic provider refunds.

The sandbox charge represents `winnerCount * rewardUsdCents`, with zero DARE platform fee. Whop may separately display provider/buyer fees; the validated payment `total` excludes those buyer fees. Participant rewards are represented allocations, not transferred money. Sandbox payouts are unavailable.

New campaign prediction cutoffs require at least three minutes of lead time. Checkout creation and cached checkout retrieval are refused when two minutes or less remain before the cutoff. These guards do not change existing campaign deadlines and cannot prevent payment through a provider URL already opened elsewhere.

A verified payment first received at or after the prediction cutoff is recorded exactly once with `disposition: "refund_required"`. Its unpublished campaign becomes terminal `void`, with `outcome: "VOID"` and `paymentIssue: "late_payment_refund_required"`; it never opens participation or predictions. The webhook acknowledges the audit record with200 instead of repeatedly retrying. This is an operator refund requirement, not a completed or automatic refund; no provider refund request or play-credit refund ledger entry is created. Existing activated payment receipts continue to replay as activated after their deadlines. Older payment rows without a disposition are treated as activated.

## Verification

Run `npm test -- convex/whop`, `npm run typecheck`, and `npm run lint` after integrating TK's generated backend files. Unit tests exercise signed raw payloads, forged/stale signatures, cancelled/failed events, exact USD conversion, frozen binding mismatch and refund rejection. Integration tests exercise real Convex functions, Auth2 core-session fixtures and atomic payment writes, with only the external Whop HTTP responses mocked. They verify owner authorization, frozen checkout terms, duplicate delivery and failed-payment rejection. They do not test password hashing or claim a live Whop transaction.

For live verification, create a draft through an authenticated sponsor, open its returned `sandbox.whop.com/checkout/...` URL, and use test card `4242 4242 4242 4242` with a future expiry and any three-digit CVC. Confirm the signed webhook produces exactly one payment record and a reactive campaign activation. Replay the same event to verify no second activation. On a separate draft, close checkout without paying and verify it stays inactive. `4000 0000 0000 0002` is the sandbox declined-card test. Never use a production card or claim real payouts.

Source documentation: [sandbox](https://docs.whop.com/developer/guides/sandbox.md), [current quickstart](https://docs.whop.com/developer/quickstart.md), [webhooks](https://docs.whop.com/developer/guides/webhooks.md), [current API](https://docs.whop.com/api-reference/overview.md), [idempotency](https://docs.whop.com/developer/api/idempotency.md).
