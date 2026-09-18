/* NULL · saves.ts
   Cloud saves: one game's progress, on the account instead of the machine.

   The shape is deliberately dumb. A save is a blob of text under a name, and
   NULL never looks inside it — games keep their progress in a hundred
   different formats, and a service that only understood one of them would be
   a service that worked for one game. A slot is (game, name), so a game can
   keep "before the boss" and "after the boss" side by side.

   The interesting half is on the client, in src/lib/saves.ts: where the blob
   comes from. A game NULL copied into a frame can be read directly — it runs
   as its own document and keeps its own storage — and a game that will not
   be read hands over a paste box instead. Either way it ends up here. */

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

/** Enough for a big save file and far short of a database people can use as a
 *  hard drive. Well past this and it is not a save, it is a screenshot. */
const CAP = 200_000;

const key = (s: string) => s.trim().toLowerCase();

export const list = query({
  args: { user: v.string() },
  handler: async (ctx, { user }) => {
    const me = key(user);
    if (!me) return [];
    const rows = await ctx.db.query("saves").withIndex("by_user", (q) => q.eq("user", me)).collect();
    return rows
      .sort((a, b) => b.at - a.at)
      .map((r) => ({
        id: r._id as string,
        game: r.game,
        name: r.name,
        slot: r.slot,
        from: r.from,
        at: r.at,
        /** the size, not the contents: a list of saves should not ship every
         *  save file to every machine that opens the page */
        size: r.data.length,
      }));
  },
});

/** One save, contents and all. Kept separate from the list for the reason
 *  above — you ask for the blob when you are about to use it. */
export const read = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.normalizeId("saves", id as never);
    if (!row) return null;
    const doc = await ctx.db.get(row);
    if (!doc) return null;
    return { id: doc._id as string, game: doc.game, name: doc.name, slot: doc.slot, data: doc.data, at: doc.at, from: doc.from };
  },
});

/** Write a slot, replacing whatever had that name. */
export const put = mutation({
  args: {
    user: v.string(),
    game: v.string(),
    label: v.string(),
    name: v.string(),
    slot: v.string(),
    data: v.string(),
    from: v.optional(v.string()),
  },
  handler: async (ctx, { user, game, label, name, slot, data, from }) => {
    const me = key(user);
    if (!me) throw new Error("sign in first");
    if (!data.trim()) throw new Error("there is nothing to save yet");
    if (data.length > CAP) throw new Error("that save is too big to keep");
    const clean = slot.trim().slice(0, 40) || "slot";
    const hit = await ctx.db
      .query("saves")
      .withIndex("by_user_game", (q) => q.eq("user", me).eq("game", game))
      .collect();
    const same = hit.find((r) => r.slot === clean);
    const row = {
      user: me,
      game,
      name: (name || game).slice(0, 60),
      slot: clean,
      data,
      from: from ?? "this browser",
      at: Date.now(),
    };
    if (same) {
      await ctx.db.patch(same._id, { ...row });
      return same._id as string;
    }
    /* a handful of slots per game, oldest first out: the point is a safety
       net, not an archive */
    if (hit.length >= 12) {
      const oldest = hit.sort((a, b) => a.at - b.at)[0];
      await ctx.db.delete(oldest._id);
    }
    return (await ctx.db.insert("saves", row)) as string;
  },
});

export const remove = mutation({
  args: { user: v.string(), id: v.string() },
  handler: async (ctx, { user, id }) => {
    const me = key(user);
    const row = await ctx.db.normalizeId("saves", id as never);
    if (!row) return false;
    const doc = await ctx.db.get(row);
    /* only the owner can drop it: the handle is a claim, but a save you did
       not write is not one you get to delete by guessing an id */
    if (!doc || doc.user !== me) return false;
    await ctx.db.delete(row);
    return true;
  },
});
