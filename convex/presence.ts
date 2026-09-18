/* NULL · presence.ts
   Who is here right now, and what they are doing.

   Presence is a heartbeat and nothing else: a browser says "still me" every
   forty-five seconds, and anybody whose last word was inside the online
   window counts as here. There is no session to close, which is why shutting
   a laptop lid reads as somebody going quiet rather than as a bug.

   The write is deliberately smaller than `members.put`: a pulse touches two
   fields on one row, so a page that is left open overnight costs a handful of
   bytes a minute instead of re-writing a whole card. */

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { ONLINE_MS, memberOf } from "./members";

/** Still me. `activity` is optional because most beats are just a beat. */
export const pulse = mutation({
  args: { user: v.string(), activity: v.optional(v.string()) },
  handler: async (ctx, { user, activity }) => {
    const row = await memberOf(ctx, user);
    if (!row) return null;
    const patch: Record<string, unknown> = { seen: Date.now() };
    if (activity !== undefined) patch.activity = activity.slice(0, 300);
    await ctx.db.patch(row._id, patch);
    return Date.now();
  },
});

/** What this person is doing, and who may see it. The visibility rule is
 *  enforced on the way out rather than on the way in: the row keeps the
 *  truth, and every reader gets only the part they are entitled to. */
export const setActivity = mutation({
  args: { user: v.string(), activity: v.string(), visibility: v.string() },
  handler: async (ctx, { user, activity, visibility }) => {
    const row = await memberOf(ctx, user);
    if (!row) throw new Error("no member called that");
    const vis = ["everyone", "friends", "nobody"].includes(visibility) ? visibility : "everyone";
    await ctx.db.patch(row._id, { activity: activity.slice(0, 300), activityVisible: vis, seen: Date.now() });
    return vis;
  },
});

/** Is this handle following that one? Used to decide whether a friends-only
 *  activity may be shown. */
async function follows(ctx: any, by: string, whom: string): Promise<boolean> {
  const hit = await ctx.db
    .query("follows")
    .withIndex("by_pair", (q: any) => q.eq("a", by).eq("b", whom))
    .first();
  return !!hit;
}

/** The presence board. With no `users` it is everybody who is here; with a
 *  list it is those handles, online or not, which is what a friends list
 *  wants — a friend who is away should still be drawn, just greyed. */
export const live = query({
  args: { users: v.optional(v.array(v.string())), me: v.optional(v.string()) },
  handler: async (ctx, { users, me }) => {
    const mine = (me ?? "").trim().toLowerCase();
    const now = Date.now();
    const wanted = users?.map((u) => u.trim().toLowerCase()).filter(Boolean);
    const rows: any[] = [];
    if (wanted?.length) {
      for (const key of wanted.slice(0, 120)) {
        const row = await memberOf(ctx, key);
        if (row) rows.push(row);
      }
    } else {
      const all = await ctx.db.query("members").collect();
      rows.push(...all.filter((r: any) => r.seen >= now - ONLINE_MS));
    }

    const out = [];
    for (const r of rows) {
      let activity: { kind: string; name: string; detail: string } | null = null;
      if (r.activity) {
        try {
          activity = JSON.parse(r.activity);
        } catch {
          activity = null;
        }
      }
      const vis = r.activityVisible ?? "everyone";
      if (activity && vis === "nobody") activity = null;
      if (activity && vis === "friends") {
        const mutual = mine && (await follows(ctx, mine, r.user)) && (await follows(ctx, r.user, mine));
        if (!mutual) activity = null;
      }
      out.push({
        user: r.user,
        name: r.name,
        seen: r.seen,
        online: r.seen >= now - ONLINE_MS,
        activity,
      });
    }
    return out.sort((a, b) => b.seen - a.seen);
  },
});
