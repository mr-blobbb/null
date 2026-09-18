/* NULL · friends.ts
   Friends, in the ordinary sense: two people who have each said yes.

   There is no separate friend table, because the follow graph already is one.
   A row in `follows` is "a asked for b"; two rows pointing at each other are
   a friendship. So accepting a request is following back — and the day
   somebody unfriends you, the edge you were owed simply goes away.

   Requests are therefore requests you have not answered yet: somebody
   follows you and you do not follow them. Nothing is hidden; the panel just
   puts the ones waiting on you at the top. */

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { memberOf } from "./members";

const key = (s: string) => s.trim().toLowerCase();

/** One edge, if it exists. */
async function edge(ctx: any, a: string, b: string) {
  return ctx.db
    .query("follows")
    .withIndex("by_pair", (q: any) => q.eq("a", a).eq("b", b))
    .first();
}

/** A card's worth of somebody, for the list. Deliberately smaller than the
 *  member row: a friends list draws a name, a picture and a dot. */
async function brief(ctx: any, user: string, now: number) {
  const row = await memberOf(ctx, user);
  if (!row) return { user, name: user, pfp: null, nameStyle: "", roles: [], verified: false, owner: false, online: false, seen: 0, banned: false };
  return {
    user: row.user,
    name: row.name,
    pfp: row.pfp,
    nameStyle: row.nameStyle,
    roles: row.roles ?? [],
    verified: row.verified === true,
    owner: row.owner === true,
    online: row.seen >= now - 1000 * 60 * 3,
    seen: row.seen,
    banned: row.banned === true,
  };
}

/** Everything the friends panel needs in one answer: who is a friend, who is
 *  waiting on you, and who you are waiting on. */
export const mine = query({
  args: { user: v.string() },
  handler: async (ctx, { user }) => {
    const me = key(user);
    if (!me) return { friends: [], incoming: [], outgoing: [] };
    const now = Date.now();
    const out = await ctx.db.query("follows").withIndex("by_a", (q: any) => q.eq("a", me)).collect();
    const inc = await ctx.db.query("follows").withIndex("by_b", (q: any) => q.eq("b", me)).collect();

    const outSet = new Set(out.map((r: any) => r.b));
    const inSet = new Set(inc.map((r: any) => r.a));

    const friends = [];
    for (const handle of inSet) {
      if (outSet.has(handle)) friends.push(await brief(ctx, handle, now));
    }
    const incoming = [];
    for (const row of inc) {
      if (!outSet.has(row.a)) incoming.push({ ...(await brief(ctx, row.a, now)), at: row.at });
    }
    const outgoing = [];
    for (const row of out) {
      if (!inSet.has(row.b)) outgoing.push({ ...(await brief(ctx, row.b, now)), at: row.at });
    }

    const rank = (r: any) => (r.owner ? 0 : r.roles.length ? 1 : r.online ? 2 : 3);
    const byRank = (a: any, b: any) => rank(a) - rank(b) || a.name.localeCompare(b.name);
    return {
      friends: friends.sort(byRank),
      incoming: incoming.sort((a, b) => b.at - a.at),
      outgoing: outgoing.sort((a, b) => b.at - a.at),
    };
  },
});

/** Ask somebody to be friends. Asking twice changes nothing. */
export const request = mutation({
  args: { by: v.string(), user: v.string() },
  handler: async (ctx, { by, user }) => {
    const a = key(by);
    const b = key(user);
    if (!a || !b) throw new Error("nobody to ask");
    if (a === b) throw new Error("you are already stuck with yourself");
    if (await edge(ctx, a, b)) return "sent";
    await ctx.db.insert("follows", { a, b, at: Date.now() });
    return "sent";
  },
});

/** Say yes. Accepting is following back, which is what makes it mutual. */
export const accept = mutation({
  args: { by: v.string(), user: v.string() },
  handler: async (ctx, { by, user }) => {
    const a = key(by);
    const b = key(user);
    if (!a || !b || a === b) throw new Error("nobody to accept");
    if (await edge(ctx, a, b)) return "friends";
    await ctx.db.insert("follows", { a, b, at: Date.now() });
    return "friends";
  },
});

/** Say no, and let the ask disappear: their edge goes, so they can ask again
 *  another day without either of you having to remember this. */
export const decline = mutation({
  args: { by: v.string(), user: v.string() },
  handler: async (ctx, { by, user }) => {
    const mine = key(by);
    const theirs = key(user);
    const row = await edge(ctx, theirs, mine);
    if (row) await ctx.db.delete(row._id);
    return "declined";
  },
});

/** Take it back, or unfriend: both edges go, in both directions. */
export const remove = mutation({
  args: { by: v.string(), user: v.string(), both: v.optional(v.boolean()) },
  handler: async (ctx, { by, user, both }) => {
    const a = key(by);
    const b = key(user);
    const mine = await edge(ctx, a, b);
    if (mine) await ctx.db.delete(mine._id);
    if (both) {
      const theirs = await edge(ctx, b, a);
      if (theirs) await ctx.db.delete(theirs._id);
    }
    return "removed";
  },
});

/** Which of these handles are friends, for drawing buttons on a profile.
 *  (`with` is a reserved word, so it is called `between` here.) */
export const between = query({
  args: { by: v.string(), user: v.string() },
  handler: async (ctx, { by, user }) => {
    const a = key(by);
    const b = key(user);
    if (!a || !b) return { following: false, follows: false, friends: false };
    const following = !!(await edge(ctx, a, b));
    const follows = !!(await edge(ctx, b, a));
    return { following, follows, friends: following && follows };
  },
});
