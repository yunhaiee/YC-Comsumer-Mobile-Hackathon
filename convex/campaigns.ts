import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  campaign,
  eligibility,
  fail,
  integer,
  LIMITS,
  membership,
  participation,
  position,
  summary,
  user,
} from "./model";
import { campaignSummary, templateId, viewer } from "./validators";

const MIN_CAMPAIGN_LEAD_MS = 180_000;
const TEMPLATES = {
  "balance-object": {
    title: "The 30-second balance challenge",
    description:
      "Balance a lightweight object on the back of your hand while seated.",
    criteria:
      "One continuous video: remain seated, show both your hand and a lightweight non-sharp object, and balance the object on the back of your hand for 30 uninterrupted seconds without support. Do not use dangerous, hot, fragile, or heavy objects.",
  },
  "paper-plane": {
    title: "Paper-plane target challenge",
    description:
      "Fold a paper airplane and land it on a visible tabletop target.",
    criteria:
      "One continuous video: show a paper-only airplane, a marked tabletop target, and a launch line at least one metre away. Throw from behind the line and have the airplane come to rest touching the target. Keep people, animals, traffic, and fragile objects out of the flight path.",
  },
  "open-can-plank": {
    title: "Hold a 60s plank with an open Coke on your back",
    description:
      "Balance an open can of Coca-Cola on your back and hold a plank for 60 seconds without spilling.",
    criteria:
      "Balance an open, full can of Coca-Cola on your lower back. Hold a forearm plank for 60 seconds without spilling. Film it in one take with a visible timer.",
  },
  "big-mac-30": {
    title: "Eat a Big Mac in 30 seconds",
    description: "Finish a whole Big Mac in 30 seconds or less.",
    criteria:
      "One continuous video: show the unopened Big Mac box, start a visible timer, and finish the entire burger within 30 seconds, ending with an empty box and empty mouth. Keep water on hand and do not attempt alone.",
  },
  "hoodie-pitch": {
    title: "Pitch a stranger on your side hustle in 30 seconds",
    description:
      "Wear a Whop hoodie and get a stranger to say \"I'd buy that\" in 30 seconds.",
    criteria:
      "One continuous video: wearing visible Whop merch, pitch your side hustle to a stranger who has agreed to be filmed. Within 30 seconds they say \"I'd buy that\" on camera. No staged friends or paid actors.",
  },
  "big-mac-proposal": {
    title: "Propose to a Big Mac in a wedding dress",
    description: "Wear a wedding dress to McDonald's and propose to a Big Mac.",
    criteria:
      "Wear a wedding dress to McDonald's. Get on one knee and propose to a Big Mac. Film it in one take, with permission.",
  },
  "whop-logo-head": {
    title: "Tattoo the Whop logo on your forehead",
    description: "Get the Whop logo tattooed or shaved on your head.",
    criteria:
      "Get the Whop logo tattooed or shaved on your head. Show the logo clearly in good light. Film the reveal in one take.",
  },
  "marathon-suit": {
    title: "Run a marathon in a suit",
    description: "Finish an official marathon in a full suit, shirt, and tie.",
    criteria:
      "Wear a full suit, shirt and tie the entire race. Finish an official marathon. Show your bib and finish time on camera.",
  },
};
export const templates = query({
  args: {},
  returns: v.object({
    templates: v.array(
      v.object({
        id: templateId,
        title: v.string(),
        description: v.string(),
        criteria: v.string(),
      }),
    ),
    limits: v.object({
      minWinnerCount: v.number(),
      maxWinnerCount: v.number(),
      minRewardUsdCents: v.number(),
      maxRewardUsdCents: v.number(),
      minLeadMs: v.number(),
      maxStartLeadMs: v.number(),
      minAttemptDurationMs: v.number(),
      maxDeadlineLeadMs: v.number(),
    }),
  }),
  handler: async () => ({
    templates: (Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map(
      (id) => ({ id, ...TEMPLATES[id] }),
    ),
    limits: {
      minWinnerCount: 1,
      maxWinnerCount: 20,
      minRewardUsdCents: 100,
      maxRewardUsdCents: 100000,
      minLeadMs: MIN_CAMPAIGN_LEAD_MS,
      maxStartLeadMs: 2592000000,
      minAttemptDurationMs: 60000,
      maxDeadlineLeadMs: 2678400000,
    },
  }),
});
export const generateThumbnailUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const u = await user(ctx);
    if (!(await membership(ctx, u._id))) fail("Sponsor membership required");
    return await ctx.storage.generateUploadUrl();
  },
});
export const createDraft = mutation({
  args: {
    templateId,
    title: v.optional(v.string()),
    rules: v.optional(v.string()),
    thumbnailId: v.optional(v.id("_storage")),
    winnerCount: v.number(),
    rewardUsdCents: v.number(),
    predictionClosesAt: v.number(),
    attemptStartsAt: v.number(),
    deadlineAt: v.number(),
  },
  returns: v.id("campaigns"),
  handler: async (ctx, args) => {
    const u = await user(ctx);
    const m = await membership(ctx, u._id);
    if (!m) fail("Sponsor membership required");
    const s = await ctx.db.get("sponsors", m.sponsorId);
    if (!s || s.campaignCount >= 50) fail("Sponsor campaign limit reached");
    integer(args.winnerCount, 1, 20, "winnerCount");
    integer(args.rewardUsdCents, 100, 100_000, "rewardUsdCents");
    const now = Date.now();
    integer(
      args.predictionClosesAt,
      now + MIN_CAMPAIGN_LEAD_MS,
      now + 30 * 86400_000,
      "predictionClosesAt",
    );
    integer(
      args.attemptStartsAt,
      args.predictionClosesAt,
      now + 30 * 86400_000,
      "attemptStartsAt",
    );
    integer(
      args.deadlineAt,
      args.attemptStartsAt + 60_000,
      now + 31 * 86400_000,
      "deadlineAt",
    );
    const { title, rules, thumbnailId, ...fields } = args;
    let text: { title: string; description: string; criteria: string };
    if (args.templateId === "custom") {
      const t = title?.trim() ?? "";
      if (!t || t.length > 80) fail("Title must be 1-80 characters");
      const r = rules?.trim() || t;
      if (r.length > 500) fail("Rules must be at most 500 characters");
      text = { title: t, description: t, criteria: r };
    } else {
      text = TEMPLATES[args.templateId];
    }
    let thumbnailUrl: string | undefined;
    if (thumbnailId) {
      const file = await ctx.db.system.get("_storage", thumbnailId);
      if (!file?.contentType?.startsWith("image/") || file.size > 10_000_000)
        fail("Thumbnail must be an image under 10 MB");
      thumbnailUrl = (await ctx.storage.getUrl(thumbnailId)) ?? undefined;
    }
    const id = await ctx.db.insert("campaigns", {
      ...fields,
      ...text,
      thumbnailUrl,
      sponsorId: s._id,
      sponsorName: s.name,
      amountUsdCents: args.winnerCount * args.rewardUsdCents,
      reviewDeadlineAt: args.deadlineAt + 86400_000,
      state: "draft",
      predictionClosed: false,
      joinsClosed: false,
      participantCount: 0,
      positionCount: 0,
      submissionCount: 0,
      pendingCount: 0,
      yesStakeUnits: 0,
      noStakeUnits: 0,
      outcome: null,
      isDemo: s.isDemo,
      published: false,
    });
    await ctx.db.patch("sponsors", s._id, {
      campaignCount: s.campaignCount + 1,
    });
    return id;
  },
});
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(campaignSummary),
  handler: async (ctx, args) => {
    integer(args.paginationOpts.numItems, 1, 50, "page size");
    const page = await ctx.db
      .query("campaigns")
      .withIndex("by_published", (q) => q.eq("published", true))
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...page, page: page.page.map(summary) };
  },
});
export const listOwned = query({
  args: {},
  returns: v.array(campaignSummary),
  handler: async (ctx) => {
    const u = await user(ctx);
    const m = await membership(ctx, u._id);
    if (!m) fail("Sponsor membership required");
    return (
      await ctx.db
        .query("campaigns")
        .withIndex("by_sponsorId", (q) => q.eq("sponsorId", m.sponsorId))
        .order("desc")
        .take(50)
    )
      .filter((c) => c.published)
      .map(summary);
  },
});
export const get = query({
  args: { campaignId: v.id("campaigns") },
  returns: v.union(campaignSummary.extend({ viewer }), v.null()),
  handler: async (ctx, args) => {
    const c = await ctx.db.get("campaigns", args.campaignId);
    if (!c) return null;
    const view = await eligibility(ctx, c);
    if (!c.published && view.role !== "reviewer") return null;
    return { ...summary(c), viewer: view };
  },
});
export const join = mutation({
  args: { campaignId: v.id("campaigns") },
  returns: v.id("participations"),
  handler: async (ctx, args) => {
    const u = await user(ctx),
      c = await campaign(ctx, args.campaignId);
    const prior = await participation(ctx, c._id, u._id);
    if (prior) return prior._id;
    if (!c.published || c.outcome || Date.now() >= c.attemptStartsAt)
      fail("Joining is closed");
    if (await membership(ctx, u._id))
      fail("Sponsor reviewers cannot participate");
    if (await position(ctx, c._id, u._id))
      fail("Predictors cannot participate");
    if (c.participantCount >= LIMITS.participants)
      fail("Participant limit reached");
    const id = await ctx.db.insert("participations", {
      campaignId: c._id,
      userId: u._id,
      joinedAt: Date.now(),
      submissionCount: 0,
      ticketCount: 0,
    });
    await ctx.db.patch("campaigns", c._id, {
      participantCount: c.participantCount + 1,
    });
    return id;
  },
});
