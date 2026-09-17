/* NULL · members.ts
   The directory. One row per account, written when someone signs in or edits
   their card, read by the Members page and the leaderboard.

   The owner is pinned first by the client, not here: the database should not
   care who is special, and the page can. */

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

/** How long a card stays in the directory after its last sign-in. Long,
 *  because a member who comes back in three months should still be here. */
const LINGER = 1000 * 60 * 60 * 24 * 400;

/** A banner and a picture are both uploaded images stored as data URLs on the
 *  card, and a Convex document has a size limit. So the card is fitted before
 *  it is written: past the budget the picture goes first, since the banner is
 *  the bigger piece of the design, and past it alone the banner falls back to
 *  the gradient every profile starts with. Losing a picture is survivable;
 *  truncating a data URL is not, because a truncated one is not an image. */
const BUDGET = 900_000;
const DEFAULT_BANNER = "linear-gradient(135deg, #6d4bd8 0%, #4a4a58 55%, #2e2e33 100%)";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("members").collect();
    const cut = Date.now() - LINGER;
    return rows
      .filter((r) => r.seen >= cut)
      .map((r) => ({
        user: r.user,
        name: r.name,
        bio: r.bio,
        banner: r.banner,
        pfp: r.pfp,
        joined: r.joined,
        nameStyle: r.nameStyle,
        /* a row written before tags came in twos holds one under `tag` */
        wearing: {
          avatar: r.avatar,
          effect: r.effect,
          tags: r.tags ?? (r.tag ? [r.tag] : []),
        },
        coins: r.coins,
        owner: r.owner,
        seen: r.seen,
      }));
  },
});

/** Write (or refresh) one card. Keyed by handle, case-insensitively, so
 *  "@MrBlob" and "@mrblob" are one member rather than two. */
export const put = mutation({
  args: {
    user: v.string(),
    name: v.string(),
    bio: v.string(),
    banner: v.string(),
    pfp: v.union(v.string(), v.null()),
    joined: v.number(),
    nameStyle: v.string(),
    avatar: v.union(v.string(), v.null()),
    effect: v.union(v.string(), v.null()),
    /** the worn tags, in the order they were put on */
    tags: v.array(v.string()),
    coins: v.number(),
    owner: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = args.user.trim().toLowerCase();
    if (!user) return null;
    let banner = args.banner;
    let pfp = args.pfp;
    const tags = args.tags.slice(0, 2);
    if (banner.length + (pfp?.length ?? 0) > BUDGET) pfp = null;
    if (banner.length > BUDGET) banner = DEFAULT_BANNER;

    const row = {
      user,
      name: args.name.slice(0, 40),
      bio: args.bio.slice(0, 400),
      banner,
      pfp,
      joined: args.joined || Date.now(),
      nameStyle: args.nameStyle.slice(0, 800),
      avatar: args.avatar,
      effect: args.effect,
      /* `tag` is the first of the list: the field the chat bot and any older
         reader already know how to read */
      tag: tags[0] ?? null,
      tags,
      coins: Math.max(0, Math.min(99_999_999, Math.round(args.coins))),
      owner: args.owner,
      seen: Date.now(),
    };
    const hit = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("user", user))
      .first();
    if (hit) {
      /* the join date is the account's, not this write's */
      await ctx.db.patch(hit._id, { ...row, joined: hit.joined });
      return hit._id;
    }
    return await ctx.db.insert("members", row);
  },
});

/** Gone for good, from every machine. */
export const remove = mutation({
  args: { user: v.string() },
  handler: async (ctx, { user }) => {
    const key = user.trim().toLowerCase();
    const hit = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("user", key))
      .first();
    if (hit) await ctx.db.delete(hit._id);
  },
});
