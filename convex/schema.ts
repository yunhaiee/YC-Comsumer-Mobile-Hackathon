import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  decision,
  outcome,
  side,
  state,
  submissionStatus,
  templateId,
} from "./validators";

export default defineSchema({
  users: defineTable({ balanceUnits: v.number(), createdAt: v.number() }),
  sponsors: defineTable({
    name: v.string(),
    isDemo: v.boolean(),
    campaignCount: v.number(),
  }),
  memberships: defineTable({
    userId: v.id("users"),
    sponsorId: v.id("sponsors"),
  })
    .index("by_userId", ["userId"])
    .index("by_sponsorId_and_userId", ["sponsorId", "userId"]),
  campaigns: defineTable({
    sponsorId: v.id("sponsors"),
    sponsorName: v.string(),
    templateId,
    title: v.string(),
    description: v.string(),
    criteria: v.string(),
    winnerCount: v.number(),
    rewardUsdCents: v.number(),
    amountUsdCents: v.number(),
    predictionClosesAt: v.number(),
    attemptStartsAt: v.number(),
    deadlineAt: v.number(),
    reviewDeadlineAt: v.number(),
    state,
    predictionClosed: v.boolean(),
    joinsClosed: v.boolean(),
    participantCount: v.number(),
    positionCount: v.number(),
    submissionCount: v.number(),
    pendingCount: v.number(),
    yesStakeUnits: v.number(),
    noStakeUnits: v.number(),
    outcome: v.union(outcome, v.null()),
    isDemo: v.boolean(),
    published: v.boolean(),
    providerCheckoutId: v.optional(v.string()),
    providerVariantId: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),
    paymentIssue: v.optional(v.literal("late_payment_refund_required")),
  })
    .index("by_published", ["published"])
    .index("by_sponsorId", ["sponsorId"])
    .index("by_providerCheckoutId", ["providerCheckoutId"]),
  participations: defineTable({
    campaignId: v.id("campaigns"),
    userId: v.id("users"),
    joinedAt: v.number(),
    submissionCount: v.number(),
    ticketCount: v.number(),
  }).index("by_campaignId_and_userId", ["campaignId", "userId"]),
  positions: defineTable({
    campaignId: v.id("campaigns"),
    userId: v.id("users"),
    side,
    stakeUnits: v.number(),
    payoutUnits: v.union(v.number(), v.null()),
    outcome: v.union(outcome, v.null()),
  })
    .index("by_campaignId_and_userId", ["campaignId", "userId"])
    .index("by_userId", ["userId"]),
  ledger: defineTable({
    userId: v.id("users"),
    campaignId: v.optional(v.id("campaigns")),
    kind: v.union(
      v.literal("grant"),
      v.literal("stake"),
      v.literal("settlement"),
      v.literal("refund"),
    ),
    deltaUnits: v.number(),
    balanceUnits: v.number(),
    key: v.string(),
    createdAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_userId", ["userId"]),
  predictionRequests: defineTable({
    userId: v.id("users"),
    requestId: v.string(),
    campaignId: v.id("campaigns"),
    side,
    stakeUnits: v.number(),
    positionId: v.id("positions"),
    balanceUnits: v.number(),
  }).index("by_userId_and_requestId", ["userId", "requestId"]),
  uploadTickets: defineTable({
    campaignId: v.id("campaigns"),
    userId: v.id("users"),
    expiresAt: v.number(),
    state: v.union(
      v.literal("issued"),
      v.literal("uploading"),
      v.literal("uploaded"),
      v.literal("consumed"),
      v.literal("expired"),
    ),
    storageId: v.optional(v.id("_storage")),
  }).index("by_campaignId_and_userId", ["campaignId", "userId"]),
  submissions: defineTable({
    campaignId: v.id("campaigns"),
    userId: v.id("users"),
    uploadToken: v.string(),
    requestId: v.string(),
    storageId: v.id("_storage"),
    submittedAt: v.number(),
    status: submissionStatus,
    reason: v.union(v.string(), v.null()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_campaignId_and_userId", ["campaignId", "userId"])
    .index("by_userId_and_requestId", ["userId", "requestId"]),
  reviewRequests: defineTable({
    userId: v.id("users"),
    requestId: v.string(),
    submissionId: v.id("submissions"),
    decision,
    reason: v.string(),
  }).index("by_userId_and_requestId", ["userId", "requestId"]),
  payments: defineTable({
    campaignId: v.id("campaigns"),
    providerCheckoutId: v.string(),
    providerPaymentId: v.string(),
    amountUsdCents: v.number(),
    currency: v.literal("USD"),
    sandbox: v.literal(true),
    receivedAt: v.number(),
    disposition: v.optional(
      v.union(v.literal("activated"), v.literal("refund_required")),
    ),
  })
    .index("by_campaignId", ["campaignId"])
    .index("by_providerPaymentId", ["providerPaymentId"]),
  paymentEvents: defineTable({
    providerEventId: v.string(),
    paymentId: v.id("payments"),
  }).index("by_providerEventId", ["providerEventId"]),
  settlements: defineTable({
    campaignId: v.id("campaigns"),
    outcome,
    poolUnits: v.number(),
    distributedUnits: v.number(),
    refunded: v.boolean(),
    settledAt: v.number(),
  }).index("by_campaignId", ["campaignId"]),
  rewards: defineTable({
    campaignId: v.id("campaigns"),
    userId: v.id("users"),
    submissionId: v.id("submissions"),
    rewardUsdCents: v.number(),
    status: v.literal("represented_not_paid"),
  })
    .index("by_campaignId", ["campaignId"])
    .index("by_userId", ["userId"]),
});
