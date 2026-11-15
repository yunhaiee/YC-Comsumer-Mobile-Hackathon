# DARE: four-hour implementation contract

## Status

Foundation only. Proposed APIs below are not implemented or agreed with TK yet. At foundation creation, no TK or SF thread was visible in this project. YL must share this PR/thread reference with them, collect API confirmation, and merge the foundation before parallel implementation. Do not mistake documentation for working integration.

## Confirmed product decisions

- Companies sponsor short-term challenges with a fixed performer prize. Company sponsorship is the central experience, not a friends-only game.
- Users participate or predict YES/NO. YES means at least one eligible participant completes the campaign's exact criteria by the deadline; NO means nobody does.
- Prediction activity changes prediction economics, never the fixed performer prize.
- Predictions use free simulated credits only. No credit purchases, cash conversion, wagering deposits, withdrawals, or real-money betting.
- Evidence is uploaded video; the company reviews it. No livestreaming or AI verification.
- Evidence is due by the dare deadline. Whether company review must also finish by this same deadline needs explicit confirmation.
- Once a user predicts on a campaign, they cannot switch into participating in that campaign.
- Expo Router + TypeScript live at the repository root. Convex is the persistent, reactive backend. Whop and Revyl must be meaningfully used.
- No maps, chat, social graph, video editing, real payouts, or unrelated premium paywall in this MVP.
- YL approves merges. No automatic merges.

## Recommended, not yet confirmed

1. Pooled YES/NO predictions, no early exits: the winning side divides the total pool proportionally to stake. The displayed split is sentiment, not a calibrated probability. Seed both sides with disclosed, separately accounted system credits. This is NOT a tradable cent-priced contract market. Confirm pooled versus automated-market-maker contracts before implementing financial logic.
2. A single fixed prize goes to the earliest qualifying evidence submission, not the fastest company reviewer. Confirm tie-break and multi-winner behavior.
3. A fixed prediction cutoff precedes the eligible attempt window. Sponsor reviewers and participants cannot predict on their own campaign. Confirm timings and participant-to-predictor restrictions.
4. Sponsor review may happen after evidence closes. Do not settle NO while timely evidence is unreviewed. Confirm whether review shares the dare deadline and, if so, how pending submissions are treated. Recommended fallback: void and refund on review timeout, never silently count unreviewed evidence as failure.
5. Three authenticated demo accounts with real server-side participant/sponsor permissions. TK proposes the smallest Expo-compatible auth approach and YL integrates its provider. No client-side role selector or caller-supplied user ID as authorization.
6. Whop sandbox hosted checkout activates a sponsored campaign only after a verified webhook. Prize allocations are represented rewards, not escrow or completed payouts. Whop sandbox payouts are unavailable.

## File ownership

| Owner | Owns | Requests from others |
| --- | --- | --- |
| YL (integration) | `package.json`, lockfile, root configs, `app/_layout.tsx`, consumer `app/` routes, `providers/`, `lib/theme.ts`, shared `components/`, docs and CI | Backend/auth API changes from TK; sponsor/payment behavior from SF |
| TK (backend) | `convex/` except `convex/whop/`, generated Convex types, backend tests | Dependencies and client providers from YL; payment handler from SF |
| SF (sponsorship/QA) | `app/sponsor/`, `components/sponsor/`, `convex/whop/`, `.revyl/`, `tests/revyl/` | Schema and HTTP route registration from TK; dependency/config/navigation edits from YL |

The foundation creates the initial empty schema before TK takes ownership. Nobody edits another owner's files without coordination. Only TK runs the shared Convex deployment watcher; SF hands over its module via PR. Do not deploy an older schema from a parallel branch. Share schema/API changes before implementing their consumers. Small module PRs integrate through YL, not simultaneous pushes to a shared branch.

## Routes

Only `/` and the root Stack exist in the foundation. Planned routes:

| Route | Owner | Purpose |
| --- | --- | --- |
| `/` | YL | Discover sponsored challenges |
| `/dare/[id]` | YL | Criteria, countdown, fixed reward, participation, prediction form |
| `/dare/[id]/submit` | YL | Pick/capture evidence, upload, see submission status |
| `/profile` | YL | Play-credit wallet, positions, resolved results |
| `/sign-in` | YL with TK auth | Authenticated demo access |
| `/sponsor` | SF | Campaign status, actual participation counts |
| `/sponsor/create` | SF | Approved-template campaign draft and checkout |
| `/sponsor/[id]` | SF | Review submitted videos and record decisions |

YL registers shared navigation; SF adds only sponsor routes. Root `app/` is deliberate; do not create a competing `src/app/` tree.

## Shared types and conventions (proposal for TK)

Use generated Convex `Id<"campaigns">`, `Id<"submissions">`, and `Id<"_storage">`; do not hand-write generated code. Prices/reward allocations use integer USD cents. Play credits use integer minor units (100 units = 1 displayed credit), independently named and stored. Timestamps are UTC epoch milliseconds and enforced by server time. Derive actor identity from authenticated context, not arguments. Validate every input.

Campaign queries should return: `id`, `title`, `description`, `sponsorName`, `mediaUrl` (nullable), `criteria`, `rewardUsdCents`, `predictionClosesAt`, `attemptStartsAt`, `deadlineAt`, `state`, `participantCount`, and `outcome` (null/YES/NO/VOID). Viewer-specific eligibility is separate from public campaign fields. Public queries must not expose raw payment payloads or private evidence.

Market state should expose `yesStakeUnits`, `noStakeUnits`, the disclosed seed contribution, viewer stake, and server-computed eligibility. A quote returns `stakeUnits`, estimated gross payout, estimated net profit, maximum loss, and a clear variable-return label. Exact return shape follows the confirmed payout model.

### Proposed consumer API

| Convex function | Kind | Arguments | Result |
| --- | --- | --- | --- |
| `campaigns.list` | query | paginated feed options | paginated campaign summaries |
| `campaigns.get` | query | `{ campaignId }` | campaign plus viewer eligibility, or null |
| `campaigns.join` | mutation | `{ campaignId }` | participation ID; idempotent per user/campaign |
| `predictions.getMarket` | query | `{ campaignId }` | pool/market state plus viewer position |
| `predictions.quote` | query | `{ campaignId, side, stakeUnits }` | live estimate, no balance mutation |
| `predictions.place` | mutation | `{ campaignId, side, stakeUnits, requestId }` | recorded prediction and resulting balance |
| `submissions.generateUploadUrl` | mutation | `{ campaignId }` | short-lived authorized upload URL |
| `submissions.submit` | mutation | `{ campaignId, storageId, requestId }` | submission ID/status |
| `submissions.mine` | query | `{ campaignId }` | viewer's evidence and review status |
| `profiles.me` | query | `{}` | identity, credit balance, positions/results |

The upload is complete only when `submissions.submit` validates and records it before deadline; obtaining a URL before deadline does not bypass the cutoff. Enforce storage ownership, allowed video types/size, role, and campaign eligibility. Reserve a storage ownership mechanism before shipping uploads. Client success must wait for server confirmation.

### Proposed sponsor and payment boundary

| Function | Owner/kind | Arguments/result |
| --- | --- | --- |
| `campaigns.createDraft` | TK mutation | Validated template, fixed reward/fee amounts and timestamps; returns campaign ID |
| `campaigns.listOwned` | TK query | Authenticated sponsor's campaigns and actual metrics |
| `submissions.listForReview` | TK query | Sponsor-authorized campaign evidence with playable URLs |
| `submissions.review` | TK mutation | `{ submissionId, decision, reason, requestId }`; records authorized approval/rejection |
| `whop/checkout.create` | SF action | `{ campaignId }`; returns sandbox checkout URL for server-authoritative price |
| `payments.activateCampaign` | TK internal mutation | Verified provider payment ID, campaign ID, amount/currency; validates and activates once |
| `/whop/webhook` | TK route, SF handler | Raw-body signature verification, event deduplication, then internal activation |
| `settlement.resolve` | TK internal mutation | Validated outcome, audited settlement/refund once; never exposed directly to clients |

SF implements the webhook handler in `convex/whop/`; TK registers it in `convex/http.ts`. Cross-owner imports/paths are confirmed together. Client redirects and checkout creation do not mark a campaign paid. Failed, cancelled, mismatched, duplicate, or forged payments must not activate it. Do not store or log secret credentials.

## Lifecycle (proposed pending timing decisions)

`draft -> awaiting_payment -> prediction_open -> attempts_open -> review_pending -> resolved`

`void` is an explicit terminal state with credit refunds. Transitions are server-side and deadline-checked on every write, not dependent solely on a scheduler firing on time. Price, criteria, and deadlines freeze before predictions open. Both late uploads and late predictions are rejected even if the UI countdown is stale. Review can record per-submission decisions; final campaign resolution waits until the confirmed winner/outcome policy is satisfied. Resolve NO only when no eligible completion exists under the agreed review policy.

## Ledger boundaries

- Sponsor sandbox payment: provider ID, amount/currency, platform-fee allocation, represented fixed reward allocation.
- Performer reward: separate award record tied to the qualifying submission; no actual transfer claim.
- System market seed: virtual credit source/account, disclosed independently of money.
- User credit accounts: grants, stakes, settlements and refunds, all recorded once with idempotency keys.
- No field doubles as dollars and credits. Never finance real awards from user stakes. For a pooled model, never distribute more units than the funded pool; define and test rounding/remainder rules before settlement.

## Foundation and integration sequence

1. YL publishes this scaffold, lockfile, checks, and draft contract in a foundation PR.
2. TK confirms or revises API signatures in coordination with YL; YL approves the foundation merge. SF confirms checkout/HTTP boundaries with TK.
3. TK and SF start separate worktrees/branches from the merged baseline. YL owns dependency additions so lockfiles do not conflict.
4. TK deploys shared dev backend/auth. SF proves a Whop sandbox payment reaches it. YL wires consumer screens using generated APIs. SF starts a Revyl cloud build early and reports device/build blockers.
5. Integrate small PRs; rehearse two independent authenticated sessions and the physical phone. Freeze features for the last hour.

## Acceptance checks

- `npm ci`, typecheck, lint, and web export work on the foundation without service credentials.
- Feature readiness requires actual authenticated Convex persistence and reactive updates across two clients.
- Confirmed Whop sandbox payment activates exactly once. Cancelled checkout does not activate. Webhook signature and amount/currency/ownership are validated.
- Predictor cannot join; unauthorized user cannot review; no overdraft, duplicate stake, deadline bypass, duplicate settlement, or negative balance.
- Uploaded video persists and plays for its authorized reviewer. Acceptance/rejection and the final outcome are visible to the appropriate users.
- Fixed represented reward and prediction returns remain separate. Refresh/restart preserves balances.
- Revyl exercises the integrated flow and records evidence. Physical demo phone also works. A web screenshot or simulator build alone does not meet the phone-demo requirement.
- No fake success paths, undisclosed mock campaigns, or claims of real payouts.
