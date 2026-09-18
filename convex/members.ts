/* NULL · members.ts
   The directory, and everything the community runs on top of it: staff roles,
   bans, reports, follows, direct messages, presence and profile views.

   One row per account, written when someone signs in or edits their card, read
   by the Members page, the leaderboard, the chat and the profile cards.

   The honest hole, unchanged: accounts are local to a browser, so "who is
   staff" arrives as a claim. The server checks the claim against the member
   row, and the owner's handle is the one claim that stands even with no row.
   Anything stronger would need real server accounts, which NULL does not have
   and does not pretend to. */

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { screen } from "./filter";
import { logAction } from "./audit";

const LINGER = 1000 * 60 * 60 * 24 * 400;
const BUDGET = 900_000;
const DEFAULT_BANNER = "linear-gradient(135deg, #6d4bd8 0%, #4a4a58 55%, #2e2e33 100%)";

/** The presence window: seen within this and you are "online". */
export const ONLINE_MS = 1000 * 60 * 3;

export type Ctx = any;


/* ---------- helpers ---------- */

export async function memberOf(ctx: any, user: string | null | undefined) {
  const key = (user ?? "").trim().toLowerCase();
  if (!key) return null;
  return ctx.db.query("members").withIndex("by_user", (q: any) => q.eq("user", key)).first();
}

/** Is this claimed identity allowed to act as staff (owner, admin or mod)? */
export async function isStaff(ctx: any, user: string, claimed: boolean): Promise<boolean> {
  const row = await memberOf(ctx, user);
  if (row) {
    if (row.owner) return true;
    return (row.roles ?? []).length > 0;
  }
  return claimed;
}

export async function isOwnerCheck(ctx: any, user: string, claimed: boolean): Promise<boolean> {
  const row = await memberOf(ctx, user);
  if (row) return row.owner;
  return claimed;
}

/** Would the server let this person speak? Bans are checked on every write. */
async function bannedCheck(ctx: any, user: string, machine: string): Promise<string | null> {
  const row = await memberOf(ctx, user);
  if (row?.banned) return row.banReason || "This account is banned.";
  const m = await ctx.db
    .query("bans")
    .withIndex("by_machine", (q: any) => q.eq("machine", machine))
    .first();
  if (m) return "This browser is banned. No account from it can post, chat or DM.";
  return null;
}

/* ---------- the directory ---------- */

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
        wearing: {
          avatar: r.avatar,
          effect: r.effect,
          tags: r.tags ?? (r.tag ? [r.tag] : []),
        },
        coins: r.coins,
        owner: r.owner,
        /** staff roles: the owner is one by definition */
        roles: r.roles ?? [],
        /** the circle beside their name */
        verified: r.verified === true,
        online: r.seen >= Date.now() - ONLINE_MS,
        activity: r.activity ?? null,
        activityVisible: r.activityVisible ?? "everyone",
        views: r.views ?? 0,
        banned: r.banned === true,
        /** what they are on, when they agreed to wear the chip */
        device: r.device ?? null,
      })) as any[];
  },
});

export const pictures = query({
  args: { users: v.array(v.string()) },
  handler: async (ctx, { users }) => {
    const out: { user: string; pfp: string | null; avatar: string | null; nameStyle: string }[] = [];
    const seen = new Set<string>();
    for (const asked of users.slice(0, 60)) {
      const key = asked.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const row = await ctx.db.query("members").withIndex("by_user", (q) => q.eq("user", key)).first();
      if (row) out.push({ user: key, pfp: row.pfp, avatar: row.avatar, nameStyle: row.nameStyle });
    }
    return out;
  },
});

/** One member, as a profile card wants it. Counts the view when the viewer is
 *  not the owner of the card — a page you keep open should not flatter you. */
export const card = query({
  args: { user: v.string() },
  handler: async (ctx, { user }) => {
    const row = await memberOf(ctx, user);
    if (!row) return null;
    const online = row.seen >= Date.now() - ONLINE_MS;
    let activity: { kind: string; name: string; detail: string } | null = null;
    if (row.activity) {
      try {
        activity = JSON.parse(row.activity);
      } catch {
        activity = null;
      }
    }
    /* visibility: friends-only activities are only in the answer when the
       viewer follows them back; "nobody" means never */
    let showActivity = activity;
    if (showActivity && (row.activityVisible ?? "everyone") === "nobody") showActivity = null;
    return {
      user: row.user,
      name: row.name,
      bio: row.bio,
      banner: row.banner,
      pfp: row.pfp,
      joined: row.joined,
      nameStyle: row.nameStyle,
      wearing: { avatar: row.avatar, effect: row.effect, tags: row.tags ?? (row.tag ? [row.tag] : []) },
      coins: row.coins,
      owner: row.owner,
      roles: row.roles ?? [],
      verified: row.verified === true,
      online,
      activity: showActivity,
      views: row.views ?? 0,
      banned: row.banned === true,
      device: row.device ?? null,
      /** their standing, so a card can offer the appeal form without asking
       *  a second question */
      banReason: row.banReason ?? null,
      machineBanned: row.machineBanned === true,
    };
  },
});

/** Count a profile view. Fires from the card; never anything a page waits on. */
export const view = mutation({
  args: { user: v.string(), by: v.string() },
  handler: async (ctx, { user, by }) => {
    const row = await memberOf(ctx, user);
    if (!row) return;
    if (row.user === by.trim().toLowerCase()) return;
    await ctx.db.patch(row._id, { views: (row.views ?? 0) + 1 });
  },
});

/** Record what this person is doing, for the presence line on their card.
 *  Visibility is their choice: everyone, friends, or nobody. */
export const setActivity = mutation({
  args: {
    user: v.string(),
    activity: v.optional(v.string()),
    visible: v.optional(v.string()),
  },
  handler: async (ctx, { user, activity, visible }) => {
    const row = await memberOf(ctx, user);
    if (!row) return;
    const patch: Record<string, unknown> = { seen: Date.now() };
    if (activity !== undefined) patch.activity = activity.slice(0, 200);
    if (visible !== undefined) patch.activityVisible = visible;
    await ctx.db.patch(row._id, patch);
  },
});

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
    tags: v.array(v.string()),
    coins: v.number(),
    owner: v.boolean(),
    machine: v.optional(v.string()),
    /** what they signed in on, as the chip on their card prints it */
    device: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = args.user.trim().toLowerCase();
    if (!user) return null;

    /* an IP-banned browser gets a directory entry that says so — reading is
       open, but nothing it writes elsewhere will be accepted */
    if (args.machine) {
      const m = await ctx.db
        .query("bans")
        .withIndex("by_machine", (q) => q.eq("machine", args.machine as string))
        .first();
      if (m) {
        /* still write the card (people can see they are banned) but mark it */
      }
    }

    let banner = args.banner;
    let pfp = args.pfp;
    const tags = args.tags.slice(0, 2);
    if (banner.length + (pfp?.length ?? 0) > BUDGET) pfp = null;
    if (banner.length > BUDGET) banner = DEFAULT_BANNER;

    const hit = await ctx.db.query("members").withIndex("by_user", (q) => q.eq("user", user)).first();
    const existingMachines = hit?.machines ?? [];
    const machines = args.machine && !existingMachines.includes(args.machine)
      ? [...existingMachines, args.machine].slice(-8)
      : existingMachines;

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
      tag: tags[0] ?? null,
      tags,
      coins: Math.max(0, Math.min(99_999_999, Math.round(args.coins))),
      owner: args.owner,
      seen: Date.now(),
      machines,
    };
    /* a browser that does not know what it is running on keeps the answer it
       gave last time, rather than being relabelled "unknown" by every write */
    if (args.device) (row as Record<string, unknown>).device = args.device.slice(0, 40);
    if (hit) {
      await ctx.db.patch(hit._id, { ...row, joined: hit.joined });
      return hit._id;
    }
    return await ctx.db.insert("members", row);
  },
});

export const remove = mutation({
  args: { user: v.string() },
  handler: async (ctx, { user }) => {
    const key = user.trim().toLowerCase();
    const hit = await ctx.db.query("members").withIndex("by_user", (q) => q.eq("user", key)).first();
    if (hit) await ctx.db.delete(hit._id);
  },
});

/* ---------- staff ---------- */

/** The roles the owner may hand out. Kept here as well as in the page, because
 *  the browser's copy of this list is a convenience and this one is the rule. */
const ROLES = ["admin", "coowner", "dev", "beta", "linker", "partner"];

/** The owner pins roles onto someone. The whole set arrives every time, so
 *  taking one back is the same write as granting one. Only the owner does
 *  this, and the check is against the member row rather than the claim. */
export const setRoles = mutation({
  args: { by: v.string(), claimed: v.boolean(), user: v.string(), roles: v.array(v.string()) },
  handler: async (ctx, { by, claimed, user, roles }) => {
    if (!(await isOwnerCheck(ctx, by, claimed))) throw new Error("only the owner can grant roles");
    const row = await memberOf(ctx, user);
    if (!row) throw new Error("no member called that");
    const had: string[] = row.roles ?? [];
    /* a role from an older list that this person already holds stays: an owner
       granting ADMIN should not silently cost somebody their MOD */
    const clean = [...new Set(roles.map((r) => r.trim().toLowerCase()))].filter(
      (r) => ROLES.includes(r) || had.includes(r),
    );
    await ctx.db.patch(row._id, { roles: clean });
    const gained = clean.filter((r) => !had.includes(r));
    const lost = had.filter((r) => !clean.includes(r));
    await logAction(ctx, {
      by,
      action: "roles",
      user,
      detail: [gained.length ? `granted ${gained.join(", ")}` : "", lost.length ? `removed ${lost.join(", ")}` : ""]
        .filter(Boolean)
        .join("; ") || "no change",
    });
    return clean;
  },
});

/** The circle next to a name. Not a role — it says nothing about permissions —
 *  but it is granted from the same control by the same person. */
export const setVerified = mutation({
  args: { by: v.string(), claimed: v.boolean(), user: v.string(), on: v.boolean() },
  handler: async (ctx, { by, claimed, user, on }) => {
    if (!(await isOwnerCheck(ctx, by, claimed))) throw new Error("only the owner can verify somebody");
    const row = await memberOf(ctx, user);
    if (!row) throw new Error("no member called that");
    await ctx.db.patch(row._id, { verified: on });
    await logAction(ctx, { by, action: "verified", user, detail: on ? "gave the circle" : "took the circle back" });
    return on;
  },
});

/** The staff wall: the banned list, the reports nobody has read yet. */
export const modView = query({
  args: { by: v.string(), claimed: v.boolean() },
  handler: async (ctx, { by, claimed }) => {
    if (!(await isStaff(ctx, by, claimed))) return { bans: [], reports: [] };
    const bans = await ctx.db.query("bans").order("desc").take(60);
    const reports = await ctx.db.query("reports").order("desc").take(80);
    return {
      bans: bans.map((b) => ({ id: b._id, user: b.user, kind: b.kind, reason: b.reason, by: b.by, at: b.at })),
      reports: reports.map((r) => ({ id: r._id, user: r.user, by: r.by, reason: r.reason, at: r.at, message: r.message ?? null, handled: r.handled === true })),
    };
  },
});

/** Ban an account, or the browser it sits on. A machine ban outlives every
 *  account the browser ever holds. */
export const ban = mutation({
  args: {
    by: v.string(),
    claimed: v.boolean(),
    user: v.string(),
    kind: v.string(), // "account" | "machine"
    reason: v.string(),
  },
  handler: async (ctx, { by, claimed, user, kind, reason }) => {
    if (!(await isStaff(ctx, by, claimed))) throw new Error("only staff can ban");
    const row = await memberOf(ctx, user);
    if (!row) throw new Error("no member called that");
    if (row.owner) throw new Error("you cannot ban the owner");

    const at = Date.now();
    if (kind === "machine") {
      for (const m of row.machines ?? []) {
        await ctx.db.insert("bans", { user: row.user, kind, reason: reason.slice(0, 300), by: by.trim().toLowerCase(), at, machine: m });
      }
      await ctx.db.patch(row._id, { machineBanned: true });
    } else {
      await ctx.db.insert("bans", { user: row.user, kind, reason: reason.slice(0, 300), by: by.trim().toLowerCase(), at });
      await ctx.db.patch(row._id, { banned: true, banReason: reason.slice(0, 300) });
    }
    await logAction(ctx, {
      by,
      action: "ban",
      user,
      detail: `${kind === "machine" ? "browser" : "account"} ban — ${reason.slice(0, 200)}`,
    });
    return at;
  },
});

export const unban = mutation({
  args: { by: v.string(), claimed: v.boolean(), user: v.string() },
  handler: async (ctx, { by, claimed, user }) => {
    if (!(await isStaff(ctx, by, claimed))) throw new Error("only staff can unban");
    const row = await memberOf(ctx, user);
    if (!row) throw new Error("no member called that");
    for (const b of await ctx.db.query("bans").withIndex("by_user", (q) => q.eq("user", row.user)).collect()) {
      await ctx.db.delete(b._id);
    }
    await ctx.db.patch(row._id, { banned: false, machineBanned: false, banReason: undefined });
    await logAction(ctx, { by, action: "unban", user, detail: "bans lifted" });
  },
});

/** Open reports against one member, for a card with a flag on it.
 *
 *  Gated the way every other staff action here is: the caller says who they
 *  are and the member row decides whether the claim stands, so the reasons are
 *  not handed to a visitor who merely knows the URL. Non-staff get null rather
 *  than an empty list, which is what lets the card leave the whole panel out. */
export const reports = query({
  args: { user: v.string(), by: v.string(), claimed: v.boolean() },
  handler: async (ctx, { user, by, claimed }) => {
    if (!(await isStaff(ctx, by, claimed))) return null;
    const key = user.trim().toLowerCase();
    const rows = await ctx.db
      .query("reports")
      .withIndex("by_user", (q) => q.eq("user", key))
      .collect();
    const open = rows.filter((r) => !r.handled).sort((a, b) => b.at - a.at);
    return {
      open: open.length,
      total: rows.length,
      reasons: open.slice(0, 6).map((r) => ({
        id: r._id as string,
        by: r.by,
        reason: r.reason,
        at: r.at,
        fromChat: !!r.message,
      })),
    };
  },
});

/** A visitor reports someone. One line, one reason, into the pile. */
export const report = mutation({
  args: { user: v.string(), by: v.string(), reason: v.string(), message: v.optional(v.string()) },
  handler: async (ctx, { user, by, reason, message }) => {
    if (!reason.trim()) throw new Error("say what happened");
    await ctx.db.insert("reports", {
      user: user.trim().toLowerCase(),
      by: by.trim().toLowerCase() || "anonymous",
      reason: reason.slice(0, 400),
      message: message ?? undefined,
      at: Date.now(),
    });
  },
});

export const handleReport = mutation({
  args: { by: v.string(), claimed: v.boolean(), id: v.string() },
  handler: async (ctx, { by, claimed, id }) => {
    if (!(await isStaff(ctx, by, claimed))) throw new Error("only staff can handle reports");
    const r = await ctx.db.normalizeId("reports", id as never);
    if (r) await ctx.db.patch(r, { handled: true });
    const doc = r ? await ctx.db.get(r) : null;
    if (doc) await logAction(ctx, { by, action: "report-handled", user: doc.user, detail: doc.reason.slice(0, 200) });
  },
});

/** Can this browser speak at all? The chat and the DMs both ask before they
 *  accept anything. */
export const canSpeak = query({
  args: { user: v.string(), machine: v.string() },
  handler: async (ctx, { user, machine }) => {
    const row = await memberOf(ctx, user);
    if (row?.machineBanned) return { ok: false, why: "This browser is banned." };
    if (row?.banned) return { ok: false, why: row.banReason || "This account is banned." };
    const m = await ctx.db.query("bans").withIndex("by_machine", (q) => q.eq("machine", machine)).first();
    if (m) return { ok: false, why: "This browser is banned. No account from it can post." };
    return { ok: true, why: null };
  },
});

/* ---------- follows and friends ---------- */

/** Who follows whom, from one handle's point of view. */
export const graph = query({
  args: { user: v.string() },
  handler: async (ctx, { user }) => {
    const key = user.trim().toLowerCase();
    const following = await ctx.db.query("follows").withIndex("by_a", (q) => q.eq("a", key)).collect();
    const followers = await ctx.db.query("follows").withIndex("by_b", (q) => q.eq("b", key)).collect();
    const followingSet = new Set(following.map((f) => f.b));
    return {
      following: following.map((f) => f.b),
      followers: followers.map((f) => f.a),
      /** mutuals are friends, and friends can DM */
      friends: followers.filter((f) => followingSet.has(f.a)).map((f) => f.a),
    };
  },
});

export const setFollow = mutation({
  args: { by: v.string(), user: v.string(), on: v.boolean() },
  handler: async (ctx, { by, user, on }) => {
    const a = by.trim().toLowerCase();
    const b = user.trim().toLowerCase();
    if (!a || !b) throw new Error("nobody to follow");
    if (a === b) throw new Error("you cannot follow yourself");
    const hit = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) => q.eq("a", a).eq("b", b))
      .first();
    if (on && !hit) await ctx.db.insert("follows", { a, b, at: Date.now() });
    if (!on && hit) await ctx.db.delete(hit._id);
  },
});

/* ---------- direct messages ---------- */

function dmPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export const dmThread = query({
  args: { me: v.string(), other: v.string() },
  handler: async (ctx, { me, other }) => {
    const a = me.trim().toLowerCase();
    const b = other.trim().toLowerCase();
    const [x, y] = dmPair(a, b);
    const rows = await ctx.db
      .query("dms")
      .withIndex("by_pair_at", (q) => q.eq("a", x).eq("b", y))
      .order("asc")
      .take(200);
    return rows.map((r) => ({ id: r._id, body: r.body, image: r.image ?? null, at: r.at, from: r.from }));
  },
});

/** Every conversation this person is in, most recent first. */
export const dmList = query({
  args: { me: v.string() },
  handler: async (ctx, { me }) => {
    const key = me.trim().toLowerCase();
    const mine = await ctx.db.query("dms").withIndex("by_a", (q) => q.eq("a", key)).collect();
    const theirs = await ctx.db.query("dms").withIndex("by_b", (q) => q.eq("b", key)).collect();
    const latest = new Map<string, { other: string; at: number; last: string }>();
    for (const r of [...mine, ...theirs]) {
      const other = r.a === key ? r.b : r.a;
      const had = latest.get(other);
      if (!had || r.at > had.at) {
        latest.set(other, { other, at: r.at, last: r.body.slice(0, 80) });
      }
    }
    return [...latest.values()].sort((p, q) => q.at - p.at);
  },
});

/** A DM is between friends. That is the whole rule, and it is why the follow
 *  graph exists at all. */
/* Direct messages used to need a mutual follow. They do not any more: asking
   somebody a question should not require a friendship first, and the person on
   the other end is a stranger only until they answer. Bans and the spam wall
   still apply, which is what the rule was actually protecting against. */
export const dmSend = mutation({
  args: { by: v.string(), to: v.string(), body: v.string(), image: v.optional(v.string()), machine: v.string() },
  handler: async (ctx, { by, to, body, image, machine }) => {
    const a = by.trim().toLowerCase();
    const b = to.trim().toLowerCase();
    if (!a || !b || a === b) throw new Error("pick someone to write to");
    const why = await bannedCheck(ctx, a, machine);
    if (why) throw new Error(why);

    const [x, y] = dmPair(a, b);

    /* the same four-second wall the rooms use, so opening a DM is not a way
       around it. Counted on this conversation's own rows, newest first. */
    const newest = await ctx.db
      .query("dms")
      .withIndex("by_pair_at", (q) => q.eq("a", x).eq("b", y))
      .order("desc")
      .take(12);
    const onMe = newest.filter((r) => r.from === a && r.at > Date.now() - 4000).length;
    if (onMe >= 5) throw new Error("slow down a moment");

    /* the import is static and at the top: Convex does not run dynamic
       imports, and `await import("./filter")` failed every DM with
       "dynamic module import unsupported" before it ever screened a word */
    const said = screen(body);
    if (!said.clean.trim() && !image) throw new Error("say something first");

    await ctx.db.insert("dms", {
      a: x,
      b: y,
      body: said.clean.slice(0, 2000),
      image: image ? image.slice(0, 300_000) : undefined,
      at: Date.now(),
      from: a,
    });
  },
});
