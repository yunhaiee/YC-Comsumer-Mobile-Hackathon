import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { fail, membership } from "./model";

export const provisionSponsor = internalMutation({
  args: { userId: v.id("users") },
  returns: v.id("sponsors"),
  handler: async (ctx, args) => {
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
