import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { credit, LIMITS } from "./model";

export const createUser = internalMutation({
  args: {
    method: v.object({
      name: v.literal("usernamePassword"),
      profile: v.object({}),
    }),
  },
  returns: v.id("users"),
  handler: async (ctx) => {
    const id = await ctx.db.insert("users", {
      balanceUnits: 0,
      createdAt: Date.now(),
    });
    await credit(ctx, id, LIMITS.grantUnits, "grant", `grant:${id}`);
    return id;
  },
});
