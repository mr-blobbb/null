import { v } from "convex/values";
import { mutation } from "./_generated/server";

const clean = (s: string) => s.trim().toUpperCase();

export const create = mutation({
  args: { code: v.string(), gives: v.string(), amount: v.number(), by: v.string() },
  handler: async (ctx, args) => {
    const code = clean(args.code);
    if (!code || code.length > 40) throw new Error("Invalid gift code.");
    const existing = await ctx.db.query("giftCodes").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (existing) return false;
    await ctx.db.insert("giftCodes", {
      code,
      gives: args.gives.slice(0, 80),
      amount: Math.max(0, Math.floor(args.amount)),
      createdBy: args.by.trim().toLowerCase().slice(0, 40),
      usedBy: null,
      at: Date.now(),
    });
    return true;
  },
});

export const redeem = mutation({
  args: { code: v.string(), by: v.string() },
  handler: async (ctx, args) => {
    const code = clean(args.code);
    const row = await ctx.db.query("giftCodes").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!row) return { ok: false as const, reason: "That code does not exist." };
    if (row.usedBy) return { ok: false as const, reason: "That code has already been used." };
    if (row.createdBy === args.by.trim().toLowerCase()) return { ok: false as const, reason: "You cannot redeem your own code." };
    await ctx.db.patch(row._id, { usedBy: args.by.trim().toLowerCase().slice(0, 40) });
    return { ok: true as const, gives: row.gives, amount: row.amount };
  },
});
