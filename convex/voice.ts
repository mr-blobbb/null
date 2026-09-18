/* NULL · voice.ts
   The voice rooms, and nothing else.

   NULL does not run a media server, and it does not need to: a voice channel
   here is a mesh of direct browser-to-browser calls. This file is the
   introduction service — who is in the room, and the offers, answers and
   addresses they hand each other on the way in. Audio never touches Convex.

   That choice has consequences worth stating plainly. Every browser holds one
   microphone stream and one connection per other speaker, so a room of four
   is six connections, and a room of twenty would be a hundred and ninety. It
   is built for a handful of people talking, which is what a channel like this
   is for in practice. Nothing is recorded, nothing is stored, and leaving
   the room removes the row within seconds. */

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

/** A row older than this is somebody whose browser stopped talking to us:
 *  closed tab, dead wifi, asleep laptop. */
const ALIVE = 20_000;

/** Signals are disposable. Anything older than a minute was for a handshake
 *  that already happened, or never will. */
const SIGNAL_ALIVE = 60_000;

const key = (s: string) => s.trim().toLowerCase();

export const join = mutation({
  args: { thread: v.string(), user: v.string(), name: v.string() },
  handler: async (ctx, { thread, user, name }) => {
    const me = key(user);
    const hit = await ctx.db
      .query("voice")
      .withIndex("by_thread_user", (q) => q.eq("thread", thread).eq("user", me))
      .first();
    const at = Date.now();
    if (hit) {
      await ctx.db.patch(hit._id, { at, name: name.slice(0, 40) });
      return hit._id;
    }
    /* the room is left as we found it: rows for people who are long gone go
       now, rather than making the microphone list look haunted */
    for (const row of await ctx.db.query("voice").withIndex("by_thread", (q) => q.eq("thread", thread)).collect()) {
      if (row.at < at - ALIVE * 6) await ctx.db.delete(row._id);
    }
    return await ctx.db.insert("voice", { thread, user: me, name: name.slice(0, 40), at, muted: false, deaf: false });
  },
});

/** Still here, and still on/off mute. Called every few seconds. */
export const beat = mutation({
  args: { thread: v.string(), user: v.string(), muted: v.boolean(), deaf: v.boolean() },
  handler: async (ctx, { thread, user, muted, deaf }) => {
    const me = key(user);
    const hit = await ctx.db
      .query("voice")
      .withIndex("by_thread_user", (q) => q.eq("thread", thread).eq("user", me))
      .first();
    if (!hit) return null;
    await ctx.db.patch(hit._id, { at: Date.now(), muted, deaf });
    return true;
  },
});

export const leave = mutation({
  args: { thread: v.string(), user: v.string() },
  handler: async (ctx, { thread, user }) => {
    const me = key(user);
    const hit = await ctx.db
      .query("voice")
      .withIndex("by_thread_user", (q) => q.eq("thread", thread).eq("user", me))
      .first();
    if (hit) await ctx.db.delete(hit._id);
    /* sweep the post: anything addressed to or from a browser that has left
       would otherwise sit in somebody's inbox until it timed out */
    const rows = await ctx.db.query("voiceSignals").collect();
    for (const r of rows) {
      if (r.thread === thread && (r.to === me || r.from === me)) await ctx.db.delete(r._id);
    }
    return true;
  },
});

/** Who is in the room. Rows are filtered, not swept: a stale row costs one
 *  comparison and disappears on the next beat anyway. */
export const roster = query({
  args: { thread: v.string() },
  handler: async (ctx, { thread }) => {
    const cut = Date.now() - ALIVE;
    const rows = await ctx.db.query("voice").withIndex("by_thread", (q) => q.eq("thread", thread)).collect();
    return rows
      .filter((r) => r.at >= cut)
      .sort((a, b) => a.user.localeCompare(b.user))
      .map((r) => ({ user: r.user, name: r.name, muted: r.muted, deaf: r.deaf, at: r.at }));
  },
});

/** Hand the other browser a piece of the handshake. */
export const signal = mutation({
  args: { thread: v.string(), from: v.string(), to: v.string(), kind: v.string(), data: v.string() },
  handler: async (ctx, { thread, from, to, kind, data }) => {
    await ctx.db.insert("voiceSignals", {
      thread,
      from: key(from),
      to: key(to),
      kind: kind.slice(0, 16),
      data: data.slice(0, 8000),
      at: Date.now(),
    });
    return true;
  },
});

/** Everything waiting for me in this room. The client deletes what it has
 *  read, which is why this is a query and not a queue with a head pointer. */
export const mailbox = query({
  args: { thread: v.string(), user: v.string() },
  handler: async (ctx, { thread, user }) => {
    const me = key(user);
    const rows = await ctx.db
      .query("voiceSignals")
      .withIndex("by_to_thread", (q) => q.eq("to", me).eq("thread", thread))
      .collect();
    const cut = Date.now() - SIGNAL_ALIVE;
    return rows
      .filter((r) => r.at >= cut)
      .map((r) => ({ id: r._id as string, from: r.from, kind: r.kind, data: r.data }));
  },
});

/** Read and done. */
export const take = mutation({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    for (const id of ids.slice(0, 200)) {
      const row = await ctx.db.normalizeId("voiceSignals", id as never);
      if (row) await ctx.db.delete(row);
    }
    return true;
  },
});
