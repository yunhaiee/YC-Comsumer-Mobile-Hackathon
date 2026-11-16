import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { fail, membership, user } from "./model";

export const provisionSponsor = internalMutation({
  args: { userId: v.id("users"), expectedUsername: v.string() },
  returns: v.id("sponsors"),
  handler: async (ctx, args) => {
    if (!args.expectedUsername.startsWith("dare-demo-"))
      fail("A dedicated dare-demo- account is required");
    const actualId = await ctx.runQuery(
      components.authUsername.public.getUserIdByUsername,
      { username: args.expectedUsername },
    );
    if (actualId !== args.userId)
      fail("Authenticated demo username and confirmed user ID must match");
    if (!(await ctx.db.get("users", args.userId)))
      fail("Create an authenticated account first");
    const existing = await membership(ctx, args.userId);
    if (existing) return existing.sponsorId;
    const positions = await ctx.db
      .query("positions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(1);
    if (positions.length) fail("Predictors cannot become demo reviewers");
    const sponsorId = await ctx.db.insert("sponsors", {
      name: "DARE Demo Sponsor — sandbox",
      isDemo: true,
      campaignCount: 0,
    });
    await ctx.db.insert("memberships", { userId: args.userId, sponsorId });
    return sponsorId;
  },
});

export const renameSponsor = internalMutation({
  args: { expectedUsername: v.string(), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.expectedUsername.startsWith("dare-demo-"))
      fail("A dedicated dare-demo- account is required");
    const name = args.name.trim();
    if (!name || name.length > 60) fail("Sponsor name must be 1-60 characters");
    const userId = await ctx.runQuery(
      components.authUsername.public.getUserIdByUsername,
      { username: args.expectedUsername },
    );
    if (!userId) fail("Demo account not found");
    const m = await membership(ctx, userId as Id<"users">);
    const sponsor = m ? await ctx.db.get("sponsors", m.sponsorId) : null;
    if (!sponsor?.isDemo) fail("Demo sponsor membership required");
    await ctx.db.patch("sponsors", sponsor._id, { name });
    return null;
  },
});

export const unpublishCampaign = internalMutation({
  args: { campaignId: v.id("campaigns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const c = await ctx.db.get("campaigns", args.campaignId);
    if (!c?.isDemo) fail("Demo campaign required");
    if (c.positionCount || c.participantCount || c.submissionCount)
      fail("Campaign already has activity");
    await ctx.db.patch("campaigns", c._id, { published: false });
    return null;
  },
});

export const seedDrafts = internalMutation({
  args: {},
  returns: v.array(v.id("campaigns")),
  handler: async (ctx): Promise<Id<"campaigns">[]> => {
    const u = await user(ctx),
      m = await membership(ctx, u._id);
    const sponsor = m ? await ctx.db.get("sponsors", m.sponsorId) : null;
    if (!sponsor?.isDemo) fail("Authenticated demo sponsor required");
    const existing = await ctx.db
      .query("campaigns")
      .withIndex("by_sponsorId", (q) => q.eq("sponsorId", sponsor._id))
      .take(50);
    const ids: Id<"campaigns">[] = [];
    const now = Date.now();
    for (const templateId of ["balance-object", "paper-plane"] as const) {
      const previous = existing.find((c) => c.templateId === templateId);
      ids.push(
        previous?._id ??
          (await ctx.runMutation(api.campaigns.createDraft, {
            templateId,
            winnerCount: 2,
            rewardUsdCents: 1000,
            predictionClosesAt: now + 3600_000,
            attemptStartsAt: now + 7200_000,
            deadlineAt: now + 86400_000,
          })),
      );
    }
    return ids;
  },
});
