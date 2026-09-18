/* NULL · social.ts
   The three things members do with each other: hand something over, keep the
   same music on two machines, and listen together.

   All three are stored as JSON strings rather than nested documents. A track
   is the catalogue's row, not this site's schema — it has whatever fields the
   source had — and a gift of an item is an id that the shop on the receiving
   machine looks up. Keeping the payload opaque means a new field on a track
   or a new piece on the shelf is a change in one place, and an old row still
   reads.

   What is *not* here is the till. Coins live in the browser that earned them
   (`src/lib/econ.ts`), because the clock that pays them is the tab. So sending
   a gift takes the coins on the sender's side and writes the gift here; the
   receiving machine adds them when it claims it. That is the honest shape of a
   site with no accounts behind it — and it means a gift can be refused by
   simply never opening it. */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** How much may ride in one gift, so a hand-written mutation cannot mint a
 *  fortune for a friend. */
const MOST_COINS = 100_000;
const NOTE = 240;

function key(s: string): string {
  return s.trim().replace(/^@/, "").toLowerCase();
}

/** Could this be a handle at all? Deliberately not "is this a member already":
 *  a gift to somebody who has not signed up yet is still theirs the moment
 *  they do, and refusing it would only mean the sender has to wait. */
function looksLikeHandle(user: string): boolean {
  return /^[a-z0-9._-]{3,20}$/.test(user);
}

/* ============================================================
   gifts
   ============================================================ */

export const sendGift = mutation({
  args: {
    by: v.string(),
    to: v.string(),
    /** an item id, or the literal "coins" */
    gives: v.string(),
    amount: v.number(),
    note: v.optional(v.string()),
    /** asked for in return. Present, this is a trade offer rather than a
     *  gift — nothing moves until the other side says yes. */
    wants: v.optional(v.string()),
    wantAmount: v.optional(v.number()),
  },
  handler: async (ctx, { by, to, gives, amount, note, wants, wantAmount }) => {
    const from = key(by);
    const toKey = key(to);
    if (!from || !toKey) throw new Error("pick somebody to send it to");
    if (from === toKey) throw new Error("you cannot send yourself a gift");
    if (!gives) throw new Error("nothing to send");
    if (!looksLikeHandle(toKey)) throw new Error(`“${to}” is not a handle anyone could hold`);
    if (gives === "coins") {
      const n = Math.floor(amount);
      if (n <= 0) throw new Error("a gift of no coins is not a gift");
      if (n > MOST_COINS) throw new Error(`keep it under ${MOST_COINS} coins`);
    }
    if (wants !== undefined) {
      if (!wants) throw new Error("a trade asks for something");
      if (wants === gives) throw new Error("swapping a thing for itself is not a trade");
      if (wants === "coins") {
        const n = Math.floor(wantAmount ?? 0);
        if (n <= 0) throw new Error("ask for a number of coins, or for a piece off the shelf");
        if (n > MOST_COINS) throw new Error(`keep it under ${MOST_COINS} coins`);
      }
    }

    await ctx.db.insert("gifts", {
      from,
      to: toKey,
      gives,
      amount: Math.floor(amount) || 0,
      note: (note ?? "").slice(0, NOTE),
      at: Date.now(),
      wants,
      wantAmount: wants === undefined ? undefined : Math.floor(wantAmount ?? 0) || 0,
    });
    return true;
  },
});

/** What is waiting for you, newest first — and what you have already opened,
 *  so the thread can show both halves of the exchange. */
export const giftsFor = query({
  args: { me: v.string() },
  handler: async (ctx, { me }) => {
    const who = key(me);
    const rows = await ctx.db
      .query("gifts")
      .withIndex("by_to", (q) => q.eq("to", who))
      .collect();
    const sent = await ctx.db
      .query("gifts")
      .withIndex("by_from", (q) => q.eq("from", who))
      .collect();
    const shape = (r: (typeof rows)[number], mine: boolean) => ({
      id: r._id as string,
      from: r.from,
      to: r.to,
      gives: r.gives,
      amount: r.amount,
      note: r.note ?? "",
      at: r.at,
      /** true when this one is yours to take */
      mine,
      /** on a trade this is "they said yes", not "they were paid" */
      claimed: r.claimedAt !== undefined,
      declined: r.declined === true,
      /** what the sender asked for, and the two halves of the swap */
      wants: r.wants ?? null,
      wantAmount: r.wantAmount ?? 0,
      gave: r.gave === true,
      got: r.got === true,
    });
    return [
      ...rows.map((r) => shape(r, false)),
      ...sent.map((r) => shape(r, true)),
    ].sort((a, b) => a.at - b.at);
  },
});

/** Say yes to a trade. The offer, not the payment: each side hands its own
 *  half over afterwards, and each side can see what the other has done. */
export const acceptTrade = mutation({
  args: { me: v.string(), id: v.id("gifts") },
  handler: async (ctx, { me, id }) => {
    const row = await ctx.db.get(id);
    if (!row) throw new Error("that trade is gone");
    if (row.wants === undefined) throw new Error("that is a gift, not a trade — just take it");
    if (row.to !== key(me)) throw new Error("that trade was not offered to you");
    if (row.declined) throw new Error("it was already waved away");
    if (row.claimedAt === undefined) await ctx.db.patch(id, { claimedAt: Date.now() });
    return true;
  },
});

/** One side of a swap. The sender hands over what they promised; the receiver
 *  hands over what was asked. Each may only mark their own half, only after
 *  the offer was accepted, and only once.
 *
 *  The other side's half is what the browser then pays out on, so a trade is
 *  never marked paid while one of the two has not parted with anything. If
 *  somebody no longer has what they promised, they say so with `ok: false`
 *  and the whole thing is off rather than half-done. */
export const handOver = mutation({
  args: { me: v.string(), id: v.id("gifts"), side: v.string(), ok: v.boolean() },
  handler: async (ctx, { me, id, side, ok }) => {
    const row = await ctx.db.get(id);
    if (!row) throw new Error("that trade is gone");
    if (row.wants === undefined) throw new Error("that is a gift, not a trade");
    const who = key(me);
    if (side === "from" && row.from !== who) throw new Error("that half is not yours to hand over");
    if (side === "to" && row.to !== who) throw new Error("that half is not yours to hand over");
    if (side !== "from" && side !== "to") throw new Error("which half?");
    if (row.declined) throw new Error("that trade was called off");
    if (row.claimedAt === undefined) throw new Error("the offer has not been accepted yet");

    if (!ok) {
      await ctx.db.patch(id, { declined: true });
      return { done: false };
    }
    if (side === "from") {
      if (row.gave) throw new Error("you have already handed it over");
      await ctx.db.patch(id, { gave: true });
    } else {
      /* the receiver waits for the sender's half: no side pays out on a trade
         the other side has not paid into */
      if (!row.gave) throw new Error("waiting for them to hand theirs over");
      if (row.got) throw new Error("you have already handed it over");
      await ctx.db.patch(id, { got: true });
    }
    const now = await ctx.db.get(id);
    return { done: now?.gave === true && now.got === true };
  },
});

/** Take it, or wave it away, once. */
export const settleGift = mutation({
  args: { me: v.string(), id: v.id("gifts"), take: v.boolean() },
  handler: async (ctx, { me, id, take }) => {
    const row = await ctx.db.get(id);
    if (!row) throw new Error("that gift is gone");
    if (row.to !== key(me)) throw new Error("that gift was not sent to you");
    if (row.claimedAt !== undefined) throw new Error("you have already opened it");
    if (take) await ctx.db.patch(id, { claimedAt: Date.now() });
    else await ctx.db.patch(id, { declined: true });
    return true;
  },
});

/** Take it back: only the sender, and only while it is still shut. Once it
 *  has been opened the coins are on the other machine and there is nothing
 *  left here to undo. */
export const unsendGift = mutation({
  args: { by: v.string(), id: v.id("gifts") },
  handler: async (ctx, { by, id }) => {
    const row = await ctx.db.get(id);
    if (!row) return true;
    if (row.from !== key(by)) throw new Error("that gift is not yours to take back");
    if (row.claimedAt !== undefined || row.declined) throw new Error("it has already been opened");
    await ctx.db.delete(id);
    return true;
  },
});

/* ============================================================
   the music that follows you
   ============================================================ */

/** Favourites and playlists are JSON, and this is a copy rather than the
 *  original: the page keeps its own so it plays with no network at all, and
 *  pushes here whenever it changes. */
export const tunes = query({
  args: { user: v.string() },
  handler: async (ctx, { user }) => {
    const row = await ctx.db
      .query("tunes")
      .withIndex("by_user", (q) => q.eq("user", key(user)))
      .first();
    if (!row) return null;
    return { favorites: row.favorites, playlists: row.playlists, at: row.at };
  },
});

export const saveTunes = mutation({
  args: { user: v.string(), favorites: v.string(), playlists: v.string() },
  handler: async (ctx, { user, favorites, playlists }) => {
    const who = key(user);
    if (!who) throw new Error("sign in first");
    /* a shelf nobody could scroll is a mistake, not a library */
    if (favorites.length > 400_000 || playlists.length > 400_000) {
      throw new Error("that library is too large to keep");
    }
    const row = await ctx.db
      .query("tunes")
      .withIndex("by_user", (q) => q.eq("user", who))
      .first();
    const at = Date.now();
    if (row) await ctx.db.patch(row._id, { favorites, playlists, at });
    else await ctx.db.insert("tunes", { user: who, favorites, playlists, at });
    return at;
  },
});

/* ============================================================
   jams
   ============================================================ */

/** The letters a code is made of — no vowels, so a code never spells a word
 *  somebody would rather it had not. */
function jamCode(): string {
  const abc = "BCDFGHJKLMNPQRSTVWXZ23456789";
  return Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
}

/** Open a room, or keep the one you already have. A host who reloads should
 *  land back in their own jam rather than starting a second one. */
export const openJam = mutation({
  args: { host: v.string() },
  handler: async (ctx, { host }) => {
    const who = key(host);
    if (!who) throw new Error("sign in to start a jam");
    const mine = await ctx.db.query("jams").withIndex("by_host", (q) => q.eq("host", who)).first();
    if (mine?.open) return mine.code;
    const code = jamCode();
    await ctx.db.insert("jams", { code, host: who, playing: false, at: 0, stamp: Date.now(), open: true });
    return code;
  },
});

export const closeJam = mutation({
  args: { host: v.string() },
  handler: async (ctx, { host }) => {
    const mine = await ctx.db.query("jams").withIndex("by_host", (q) => q.eq("host", key(host))).first();
    if (mine) await ctx.db.delete(mine._id);
    return true;
  },
});

/** What the room is on right now. Everyone in the room reads this, which is
 *  the whole of "listening together": one row, pushed by the host. */
export const peekJam = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const row = await ctx.db
      .query("jams")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();
    if (!row || !row.open) return null;
    return {
      code: row.code,
      host: row.host,
      track: row.track ?? null,
      playing: row.playing,
      at: row.at,
      stamp: row.stamp,
    };
  },
});

/** The host says what the room is doing. Only the host: a jam with two
 *  captains is a jam nobody is listening to. */
export const pushJam = mutation({
  args: {
    host: v.string(),
    track: v.optional(v.string()),
    playing: v.boolean(),
    at: v.number(),
  },
  handler: async (ctx, { host, track, playing, at }) => {
    const who = key(host);
    const mine = await ctx.db.query("jams").withIndex("by_host", (q) => q.eq("host", who)).first();
    if (!mine || !mine.open) throw new Error("that jam is closed");
    await ctx.db.patch(mine._id, {
      track: track ?? mine.track,
      playing,
      at: Math.max(0, Math.floor(at)),
      stamp: Date.now(),
    });
    return mine.code;
  },
});
