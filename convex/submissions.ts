import { v } from "convex/values";
import {
  env,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  campaign,
  fail,
  LIMITS,
  participation,
  requestKey,
  reviewer,
  user,
} from "./model";
import { decision, evidenceView, submissionStatus } from "./validators";
import { resolveCampaign } from "./settlement";

export const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
async function uploadPermission(ctx: MutationCtx, campaignId: Id<"campaigns">) {
  const u = await user(ctx),
    c = await campaign(ctx, campaignId),
    now = Date.now();
  if (
    !c.published ||
    c.outcome ||
    now < c.attemptStartsAt ||
    now >= c.deadlineAt
  )
    fail("Evidence window is closed");
  const p = await participation(ctx, c._id, u._id);
  if (!p || p.joinedAt >= c.attemptStartsAt)
    fail("Participant permission required");
  if (p.submissionCount >= LIMITS.submissions)
    fail("Evidence submission limit reached");
  return { u, c, p };
}
export const generateUploadUrl = mutation({
  args: { campaignId: v.id("campaigns") },
  returns: v.object({ uploadUrl: v.string(), uploadToken: v.string() }),
  handler: async (ctx, args) => {
    const { u, c, p } = await uploadPermission(ctx, args.campaignId);
    if (p.ticketCount >= LIMITS.tickets) fail("Upload ticket limit reached");
    const expiresAt = Math.min(Date.now() + 600_000, c.deadlineAt);
    const id = await ctx.db.insert("uploadTickets", {
      campaignId: c._id,
      userId: u._id,
      expiresAt,
      state: "issued",
    });
    await ctx.db.patch("participations", p._id, {
      ticketCount: p.ticketCount + 1,
    });
    await ctx.scheduler.runAt(expiresAt, internal.submissions.expireUpload, {
      ticketId: id,
    });
    return {
      uploadUrl: `${env.CONVEX_SITE_URL}/evidence/upload?uploadToken=${encodeURIComponent(id)}`,
      uploadToken: id,
    };
  },
});
export const claimUpload = internalMutation({
  args: { uploadToken: v.string() },
  returns: v.id("uploadTickets"),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("uploadTickets", args.uploadToken);
    const ticket = id ? await ctx.db.get("uploadTickets", id) : null;
    if (!ticket) fail("Invalid upload ticket");
    const { u } = await uploadPermission(ctx, ticket.campaignId);
    if (
      ticket.userId !== u._id ||
      ticket.state !== "issued" ||
      Date.now() >= ticket.expiresAt
    )
      fail("Upload ticket unavailable");
    await ctx.db.patch("uploadTickets", ticket._id, { state: "uploading" });
    return ticket._id;
  },
});
export const finishUpload = internalMutation({
  args: { ticketId: v.id("uploadTickets"), storageId: v.id("_storage") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const u = await user(ctx),
      ticket = await ctx.db.get("uploadTickets", args.ticketId);
    if (!ticket || ticket.userId !== u._id) fail("Upload ticket unavailable");
    const c = await campaign(ctx, ticket.campaignId);
    const meta = await ctx.db.system.get("_storage", args.storageId);
    if (
      ticket.state !== "uploading" ||
      Date.now() >= ticket.expiresAt ||
      Date.now() >= c.deadlineAt ||
      c.outcome ||
      !meta ||
      meta.size > LIMITS.uploadBytes ||
      !ALLOWED_TYPES.includes(meta.contentType ?? "")
    ) {
      await ctx.storage.delete(args.storageId);
      return false;
    }
    await ctx.db.patch("uploadTickets", ticket._id, {
      state: "uploaded",
      storageId: args.storageId,
    });
    return true;
  },
});
export const expireUpload = internalMutation({
  args: { ticketId: v.id("uploadTickets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get("uploadTickets", args.ticketId);
    if (!ticket || ticket.state === "consumed" || Date.now() < ticket.expiresAt)
      return null;
    if (ticket.storageId) await ctx.storage.delete(ticket.storageId);
    await ctx.db.patch("uploadTickets", ticket._id, {
      state: "expired",
      storageId: undefined,
    });
    return null;
  },
});
export const submit = mutation({
  args: {
    campaignId: v.id("campaigns"),
    uploadToken: v.string(),
    requestId: v.string(),
  },
  returns: v.object({
    submissionId: v.id("submissions"),
    status: submissionStatus,
  }),
  handler: async (ctx, args) => {
    requestKey(args.requestId);
    const u = await user(ctx);
    const prior = await ctx.db
      .query("submissions")
      .withIndex("by_userId_and_requestId", (q) =>
        q.eq("userId", u._id).eq("requestId", args.requestId),
      )
      .unique();
    if (prior) {
      if (
        prior.campaignId !== args.campaignId ||
        prior.uploadToken !== args.uploadToken
      )
        fail("requestId payload conflict");
      return { submissionId: prior._id, status: prior.status };
    }
    const { c, p } = await uploadPermission(ctx, args.campaignId);
    const ticketId = ctx.db.normalizeId("uploadTickets", args.uploadToken),
      ticket = ticketId ? await ctx.db.get("uploadTickets", ticketId) : null;
    if (
      !ticket ||
      ticket.campaignId !== c._id ||
      ticket.userId !== u._id ||
      ticket.state !== "uploaded" ||
      !ticket.storageId ||
      Date.now() >= ticket.expiresAt
    )
      fail("Uploaded ticket unavailable");
    const id = await ctx.db.insert("submissions", {
      ...args,
      userId: u._id,
      storageId: ticket.storageId,
      submittedAt: Date.now(),
      status: "pending",
      reason: null,
    });
    await ctx.db.patch("uploadTickets", ticket._id, { state: "consumed" });
    await ctx.db.patch("participations", p._id, {
      submissionCount: p.submissionCount + 1,
    });
    await ctx.db.patch("campaigns", c._id, {
      submissionCount: c.submissionCount + 1,
      pendingCount: c.pendingCount + 1,
    });
    return { submissionId: id, status: "pending" as const };
  },
});
export const mine = query({
  args: { campaignId: v.id("campaigns") },
  returns: v.array(evidenceView),
  handler: async (ctx, args) => {
    const u = await user(ctx);
    const rows = await ctx.db
      .query("submissions")
      .withIndex("by_campaignId_and_userId", (q) =>
        q.eq("campaignId", args.campaignId).eq("userId", u._id),
      )
      .take(LIMITS.submissions);
    return rows.map((s) => ({
      id: s._id,
      submittedAt: s.submittedAt,
      status: s.status,
      reason: s.reason,
    }));
  },
});
export const listForReview = query({
  args: { campaignId: v.id("campaigns") },
  returns: v.array(
    evidenceView.extend({
      userId: v.id("users"),
      mediaUrl: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const c = await campaign(ctx, args.campaignId);
    await reviewer(ctx, c);
    const rows = await ctx.db
      .query("submissions")
      .withIndex("by_campaignId_and_userId", (q) => q.eq("campaignId", c._id))
      .take(LIMITS.participants * LIMITS.submissions);
    return await Promise.all(
      rows.map(async (s) => ({
        id: s._id,
        userId: s.userId,
        submittedAt: s.submittedAt,
        status: s.status,
        reason: s.reason,
        mediaUrl: await ctx.storage.getUrl(s.storageId),
      })),
    );
  },
});
export const review = mutation({
  args: {
    submissionId: v.id("submissions"),
    decision,
    reason: v.string(),
    requestId: v.string(),
  },
  returns: v.object({ submissionId: v.id("submissions"), status: decision }),
  handler: async (ctx, args) => {
    requestKey(args.requestId);
    if (!args.reason.trim() || args.reason.length > 1000)
      fail("Review reason is required (maximum 1000 characters)");
    const s = await ctx.db.get("submissions", args.submissionId);
    if (!s) fail("Submission not found");
    const c = await campaign(ctx, s.campaignId),
      u = await reviewer(ctx, c);
    const prior = await ctx.db
      .query("reviewRequests")
      .withIndex("by_userId_and_requestId", (q) =>
        q.eq("userId", u._id).eq("requestId", args.requestId),
      )
      .unique();
    if (prior) {
      if (
        prior.submissionId !== s._id ||
        prior.decision !== args.decision ||
        prior.reason !== args.reason
      )
        fail("requestId payload conflict");
      return { submissionId: s._id, status: prior.decision };
    }
    if (c.outcome || Date.now() >= c.reviewDeadlineAt)
      fail("Review window is closed");
    if (s.status !== "pending") fail("Evidence already reviewed");
    if (s.userId === u._id) fail("Cannot review your own evidence");
    await ctx.db.patch("submissions", s._id, {
      status: args.decision,
      reason: args.reason,
      reviewedBy: u._id,
      reviewedAt: Date.now(),
    });
    await ctx.db.patch("campaigns", c._id, {
      pendingCount: c.pendingCount - 1,
    });
    await ctx.db.insert("reviewRequests", { ...args, userId: u._id });
    await resolveCampaign(ctx, c._id);
    return { submissionId: s._id, status: args.decision };
  },
});
