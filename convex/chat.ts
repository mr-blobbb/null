/* NULL · chat.ts
   One room. Not channels, not threads, not DMs — the whole site's traffic
   would fit in a single day's scroll, and pretending otherwise would be
   furniture with nothing in it.

   Everything a message needs to draw itself is stored on the message: the
   name, the tag, whether the author owns the place. A reader should not have
   to join anything to see the room. */

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { screen } from "./filter";

/** The newest slice of the room, oldest first so it reads like a log. */
export const recent = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("messages").withIndex("by_at").order("desc").take(80);
    return rows.reverse().map((m) => ({
      id: m._id,
      user: m.user,
      name: m.name,
      body: m.body,
      at: m.at,
      owner: m.owner,
      tag: m.tag,
      machine: m.machine,
    }));
  },
});

export const send = mutation({
  args: {
    user: v.string(),
    name: v.string(),
    body: v.string(),
    owner: v.boolean(),
    tag: v.union(v.string(), v.null()),
    machine: v.string(),
  },
  handler: async (ctx, args) => {
    const said = screen(args.body);
    if (!said.clean.trim()) throw new Error("say something first");

    /* a wall, not a door: anywhere between four and six a second is a human
       typing fast, and anything beyond it is a script filling the room */
    const since = Date.now() - 4000;
    const mine = await ctx.db.query("messages").withIndex("by_at").order("desc").take(12);
    const onMe = mine.filter((m) => m.machine === args.machine && m.at > since).length;
    if (onMe >= 5) throw new Error("slow down a moment");

    await ctx.db.insert("messages", {
      user: args.user.slice(0, 24),
      name: args.name.slice(0, 40),
      body: said.clean.trim(),
      at: Date.now(),
      owner: args.owner,
      tag: args.tag,
      machine: args.machine.slice(0, 40),
    });
    return said.caught.length ? { caught: said.caught } : null;
  },
});

/** The room only needs a broom now and then. */
export const sweep = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("messages").withIndex("by_at").order("desc").collect();
    const old = rows.slice(400);
    for (const m of old) await ctx.db.delete(m._id);
    return old.length;
  },
});
