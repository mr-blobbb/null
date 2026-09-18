/* NULL · appeals.ts
   The other half of a ban: the part where the person gets to say something.

   Reports and bans already existed, and both of them could only accuse. This
   is the return path. Somebody who has been banned — account or browser —
   writes one appeal, staff read it, and one person decides. Filing an appeal
   never unlocks anything by itself; that is the whole design, because an
   appeal that grants itself is just a "continue" button with paperwork.

   Granting clears the ban and writes a row to the log, so the decision is
   visible to every member of staff afterwards, including the ones who were
   not there when it was made. */

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { isStaff, memberOf } from "./members";
import { logAction } from "./audit";

const key = (s: string) => s.trim().toLowerCase();

/** What is this person's standing, and have they already said their piece? */
export const mine = query({
  args: { user: v.string() },
  handler: async (ctx, { user }) => {
    const me = key(user);
    const row = me ? await memberOf(ctx, me) : null;
    const rows = me
      ? await ctx.db.query("appeals").withIndex("by_user", (q) => q.eq("user", me)).collect()
      : [];
    return {
      banned: row?.banned === true || row?.machineBanned === true,
      banReason: row?.banReason ?? null,
      machineBanned: row?.machineBanned === true,
      appeals: rows
        .sort((a, b) => b.at - a.at)
        .map((r) => ({
          id: r._id as string,
          kind: r.kind,
          body: r.body,
          at: r.at,
          status: r.status,
          by: r.by ?? null,
          note: r.note ?? null,
          decidedAt: r.decidedAt ?? null,
        })),
    };
  },
});

/** Say your piece. One open appeal at a time: a pile of them from one person
 *  is not a stronger case, it is just a slower queue. */
export const file = mutation({
  args: { user: v.string(), kind: v.optional(v.string()), body: v.string() },
  handler: async (ctx, { user, kind, body }) => {
    const me = key(user);
    if (!me) throw new Error("sign in first, so staff know who is asking");
    const said = body.trim();
    if (said.length < 12) throw new Error("write a little more than that — what actually happened?");
    const row = await memberOf(ctx, me);
    const mine = await ctx.db.query("appeals").withIndex("by_user", (q) => q.eq("user", me)).collect();
    if (mine.some((r) => r.status === "open")) throw new Error("you already have an appeal waiting");
    const what = kind === "machine" || row?.machineBanned ? "machine" : "account";
    const id = await ctx.db.insert("appeals", {
      user: me,
      kind: what,
      body: said.slice(0, 1500),
      at: Date.now(),
      status: "open",
    });
    return { id: id as string, kind: what };
  },
});

/** The queue, for staff. Open ones first, oldest first, because a queue that
 *  answers the newest question first is not a queue. */
export const queue = query({
  args: { by: v.string(), claimed: v.boolean() },
  handler: async (ctx, { by, claimed }) => {
    if (!(await isStaff(ctx, by, claimed))) return { open: [], decided: [] };
    const rows = await ctx.db.query("appeals").collect();
    const open = rows.filter((r) => r.status === "open").sort((a, b) => a.at - b.at);
    const decided = rows.filter((r) => r.status !== "open").sort((a, b) => (b.decidedAt ?? b.at) - (a.decidedAt ?? a.at));
    const drawn = [...open, ...decided.slice(0, 20)];
    const out = [];
    for (const r of drawn) {
      const member = await memberOf(ctx, r.user);
      out.push({
        id: r._id as string,
        user: r.user,
        name: member?.name ?? r.user,
        kind: r.kind,
        body: r.body,
        at: r.at,
        status: r.status,
        by: r.by ?? null,
        note: r.note ?? null,
        decidedAt: r.decidedAt ?? null,
        banReason: member?.banReason ?? null,
        stillBanned: member?.banned === true || member?.machineBanned === true,
      });
    }
    const cut = open.length;
    return { open: out.slice(0, cut), decided: out.slice(cut) };
  },
});

/** Decide. Granting lifts the ban in the same breath as it records the
 *  decision, so there is no state where the paperwork says yes and the door
 *  is still shut. */
export const decide = mutation({
  args: {
    by: v.string(),
    claimed: v.boolean(),
    id: v.string(),
    granted: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { by, claimed, id, granted, note }) => {
    if (!(await isStaff(ctx, by, claimed))) throw new Error("only staff can decide an appeal");
    const doc = await ctx.db.normalizeId("appeals", id as never);
    if (!doc) throw new Error("no such appeal");
    const appeal = await ctx.db.get(doc);
    if (!appeal) throw new Error("no such appeal");
    const staff = key(by);
    const said = (note ?? "").trim().slice(0, 400);

    if (granted) {
      const member = await memberOf(ctx, appeal.user);
      if (member) {
        for (const b of await ctx.db.query("bans").withIndex("by_user", (q) => q.eq("user", appeal.user)).collect()) {
          await ctx.db.delete(b._id);
        }
        const machines = member.machines ?? [];
        for (const m of machines) {
          const row = await ctx.db.query("bans").withIndex("by_machine", (q) => q.eq("machine", m)).first();
          if (row) await ctx.db.delete(row._id);
        }
        await ctx.db.patch(member._id, { banned: false, machineBanned: false, banReason: undefined });
      }
    }

    await ctx.db.patch(doc, {
      status: granted ? "granted" : "denied",
      by: staff,
      note: said,
      decidedAt: Date.now(),
    });
    await logAction(ctx, {
      by: staff,
      action: "appeal-decided",
      user: appeal.user,
      detail: `${granted ? "granted" : "denied"} a ${appeal.kind} appeal${said ? ` — ${said}` : ""}`,
    });
    return granted ? "granted" : "denied";
  },
});
