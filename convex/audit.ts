/* NULL · audit.ts
   The log. Every staff action that changes somebody's standing is written
   here as it happens, and nothing ever deletes a row.

   It lives in its own file so both sides can reach it: the moderation page
   reads it, and members.ts writes a row from inside ban and unban. Keeping it
   out of mod.ts is what stops those two files importing each other. */

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { isStaff } from "./members";

export type AuditAction =
  | "ban"
  | "unban"
  | "appeal"
  | "appeal-decided"
  | "roles"
  | "verified"
  | "report"
  | "report-handled"
  | "purge";

/** Write one row. Called from inside the action it records, never on its own,
 *  so the log cannot drift from what actually happened. */
export async function logAction(
  ctx: any,
  row: { by: string; action: AuditAction; user: string; detail: string },
) {
  await ctx.db.insert("audit", {
    by: (row.by || "system").trim().toLowerCase(),
    action: row.action,
    user: (row.user || "").trim().toLowerCase(),
    detail: row.detail.slice(0, 400),
    at: Date.now(),
  });
}

/** The log, newest first, for staff only. Non-staff get an empty list rather
 *  than a refusal, so the panel can simply not draw. */
export const log = query({
  args: { by: v.string(), claimed: v.boolean(), limit: v.optional(v.number()) },
  handler: async (ctx, { by, claimed, limit }) => {
    if (!(await isStaff(ctx, by, claimed))) return [];
    const take = Math.max(1, Math.min(200, limit ?? 80));
    const rows = await ctx.db.query("audit").withIndex("by_at").order("desc").take(take);
    return rows.map((r: any) => ({
      id: r._id as string,
      by: r.by,
      action: r.action,
      user: r.user,
      detail: r.detail,
      at: r.at,
    }));
  },
});

/** Two rows for the price of one, for the rare case where the second half of
 *  an action is worth keeping on its own. */
export const note = mutation({
  args: { by: v.string(), claimed: v.boolean(), user: v.string(), detail: v.string() },
  handler: async (ctx, { by, claimed, user, detail }) => {
    if (!(await isStaff(ctx, by, claimed))) throw new Error("only staff can write to the log");
    await logAction(ctx, { by, action: "purge", user, detail });
    return true;
  },
});
