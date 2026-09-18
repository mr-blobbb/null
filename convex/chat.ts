/* NULL · chat.ts
   The rooms, and the bot that lives in them.

   The channels are fixed, the way a community's are: Rules and the Info
   shelves are staff-only to post and open to read; Social is everybody. The
   gate lives on the thread row, so the client draws the lock from the same
   data the server enforces with.

   The filter runs on every message, staff excepted by the member row. A
   member's markdown is bold, italics, underline and numbered lists; staff get
   the whole set — headers, code, quotes, spoilers, masked links — because the
   room trusts them to use it on the room's behalf.

   The one honest hole, still: a handle and a password live in the browser, so
   identity here is a claim checked against the member row. That stops an
   ordinary member from doing staff things. It does not stop somebody who can
   edit a request, and pretending otherwise would be the actual bug. */

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { isStaff, isOwnerCheck, memberOf } from "./members";
import { screen } from "./filter";

/** The room that exists whether or not anybody made one. */
const GENERAL = "general";

/** The channels, in the order the sidebar draws them. `gate: "staff"` means
 *  only staff may post; everyone may read. */
const CHANNELS: { slug: string; name: string; topic: string; kind: string; gate: string | null }[] = [
  { slug: "rules", name: "rules", topic: "the rules of the place. read them once.", kind: "text", gate: "staff" },
  { slug: "announcements", name: "announcements", topic: "what the staff have to say", kind: "text", gate: "staff" },
  { slug: "updates", name: "updates", topic: "what changed on the site", kind: "text", gate: "staff" },
  { slug: "links", name: "links", topic: "things worth clicking", kind: "text", gate: "staff" },
  { slug: "staff-shitpost", name: "staff-shitpost", topic: "staff only. that is the whole point", kind: "text", gate: "staff" },
  { slug: "general", name: "general", topic: "everything that is not about anything in particular", kind: "text", gate: null },
  { slug: "member-shitpost", name: "member-shitpost", topic: "the other kind of posting", kind: "text", gate: null },
  { slug: "advertise", name: "advertise", topic: "your site, your server, your thing", kind: "text", gate: null },
  { slug: "share-links", name: "share-links", topic: "games, songs, pages worth sharing", kind: "text", gate: null },
  { slug: "general-voice", name: "general-voice", topic: "the voice room. some day", kind: "voice", gate: null },
];

/** A staff member's claim, checked the same way everywhere. */
async function staffOf(ctx: any, user: string, claimed: boolean): Promise<boolean> {
  return isStaff(ctx, user, claimed);
}

/* ---------- threads ---------- */

export const threads = query({
  args: {},
  handler: async (ctx) => {
    /* owner-made threads still exist and still show; the fixed channels are
       always there, so the room list is never empty */
    const rows = await ctx.db.query("threads").collect();
    const stored = rows
      .sort((a, b) => a.at - b.at)
      .map((t) => ({
        slug: t.slug,
        name: t.name,
        topic: t.topic,
        kind: t.kind ?? "text",
        gate: t.gate ?? null,
        fixed: false,
      }));
    const fixed = CHANNELS.map((c) => ({ ...c, fixed: true }));
    const seen = new Set(fixed.map((c) => c.slug));
    return [...fixed, ...stored.filter((t) => !seen.has(t.slug))];
  },
});

/** Owner tools kept from the last round: a made thread can still be cleared
 *  or dropped, but never a fixed channel. */
export const clearThread = mutation({
  args: { slug: v.string(), user: v.string(), owner: v.boolean() },
  handler: async (ctx, args) => {
    if (!(await isOwnerCheck(ctx, args.user, args.owner))) throw new Error("only the owner can do that");
    if (CHANNELS.some((c) => c.slug === args.slug)) throw new Error("the fixed channels are not clearable");
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_thread_at", (q: any) => q.eq("thread", args.slug))
      .collect();
    for (const m of rows) await ctx.db.delete(m._id);
    return rows.length;
  },
});

export const dropThread = mutation({
  args: { slug: v.string(), user: v.string(), owner: v.boolean() },
  handler: async (ctx, args) => {
    if (!(await isOwnerCheck(ctx, args.user, args.owner))) throw new Error("only the owner can do that");
    if (CHANNELS.some((c) => c.slug === args.slug)) throw new Error("the fixed channels are not going anywhere");
    const hit = await ctx.db.query("threads").withIndex("by_slug", (q: any) => q.eq("slug", args.slug)).first();
    if (!hit) throw new Error("no such thread");
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_thread_at", (q: any) => q.eq("thread", args.slug))
      .collect();
    for (const m of rows) await ctx.db.delete(m._id);
    await ctx.db.delete(hit._id);
    return rows.length;
  },
});

export const newThread = mutation({
  args: { name: v.string(), topic: v.optional(v.string()), user: v.string(), owner: v.boolean() },
  handler: async (ctx, args) => {
    if (!(await isOwnerCheck(ctx, args.user, args.owner))) throw new Error("only the owner can do that");
    const slug = args.name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 24);
    if (!slug) throw new Error("that name has no letters in it");
    if (CHANNELS.some((c) => c.slug === slug)) throw new Error("there is already a channel called that");
    const had = await ctx.db.query("threads").withIndex("by_slug", (q: any) => q.eq("slug", slug)).first();
    if (had) throw new Error("there is already a thread called that");
    await ctx.db.insert("threads", { slug, name: slug, topic: (args.topic ?? "").slice(0, 120), at: Date.now() });
    return slug;
  },
});

/* ---------- messages ---------- */

/** The newest slice of one room, oldest first so it reads like a log. */
export const recent = query({
  args: { thread: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const slug = args.thread || GENERAL;
    let rows: any[];
    if (slug === GENERAL) {
      const all = await ctx.db.query("messages").withIndex("by_at").order("desc").take(110);
      rows = all.filter((m) => !m.thread || m.thread === GENERAL).slice(0, 80);
    } else {
      rows = await ctx.db
        .query("messages")
        .withIndex("by_thread_at", (q: any) => q.eq("thread", slug))
        .order("desc")
        .take(80);
    }

    /* names and tags come from the directory, so a rename rewrites history;
       the picture is a data URL and is asked for separately */
    const authors = [...new Set(rows.map((m) => m.user.trim().toLowerCase()))].slice(0, 60);
    const known = new Map(
      await Promise.all(
        authors.map(async (u) => [u, u ? await memberOf(ctx, u) : null] as const),
      ),
    );

    return rows.reverse().map((m) => draw(m, known.get(m.user.trim().toLowerCase()) ?? null));
  },
});

function draw(m: any, member: any) {
  return {
    id: m._id,
    user: m.user,
    name: member && member.name.trim() ? member.name : m.name,
    body: m.body,
    at: m.at,
    owner: m.owner || member?.owner === true,
    roles: member?.roles ?? [],
    /** the circle beside the name, from the directory rather than the row */
    verified: member?.verified === true,
    avatar: member ? member.avatar : null,
    tags: member
      ? (member.tags ?? (member.tag ? [member.tag] : []))
      : (m.tags ?? (m.tag ? [m.tag] : [])),
    machine: m.machine,
    bot: m.bot === true,
    image: m.image ?? null,
    replyTo: m.replyTo ?? null,
    reactions: reactsOf(m),
    poll: m.poll ?? null,
    mentions: m.mentions ?? [],
    everyone: m.everyone === true,
    md: m.md ?? "basic",
  };
}

/* `normalizeId` turns a string from a client into an id this table will
   accept, and it is *not* the row. Every handler here used to read fields off
   its answer — `m.user`, `m._id` — which is why a reply pointed at a row of
   nothing and a reaction tried to patch `undefined`. Validate with it, then
   fetch the document with the id it hands back. */

/** What everyone has thrown on a line, as a list of `{ e, by }`.
 *
 *  This started as `{ "🔥": 3 }` and could not be saved: Convex allows only
 *  plain ASCII in a document's *field names*, and an emoji is not ASCII, so
 *  every reaction failed with "Field name 🔥 has invalid character". Values may
 *  be anything at all, so the emoji moved from the key into a value, and the
 *  people who picked it moved in beside it. A row written before the change
 *  still carries its old `{ emoji: count }` map, which is read here so old
 *  lines keep their counts — the names behind them are simply unknown. */
function reactsOf(m: any): { e: string; by: string[] }[] {
  if (Array.isArray(m.reacts)) {
    return m.reacts.map((r: any) => ({ e: String(r.e), by: [...(r.by ?? [])] }));
  }
  const old = m.reactions;
  if (!old || typeof old !== "object") return [];
  return Object.entries(old as Record<string, number>).map(([e, n]) => ({
    e,
    by: new Array(Math.max(0, Number(n) || 0)).fill("?"),
  }));
}
async function messageOf(ctx: any, id: string): Promise<any | null> {
  const key = await ctx.db.normalizeId("messages", id as never);
  if (!key) return null;
  return (await ctx.db.get(key)) ?? null;
}

/** What a reply points at: one line, so the client can draw the stub. */
export const messageById = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const m = await messageOf(ctx, id);
    if (!m) return null;
    const member = await memberOf(ctx, m.user);
    return draw(m, member);
  },
});

/** Words a regular member may write. Everything outside the list is taken
 *  literally, which is the safest thing to do with markup from strangers. */
const BASIC_MD = ["**", "*", "__", "1."];

function cap(body: string): string {
  /* "about 1000 words" — 1200 keeps a margin so nobody is cut mid-sentence by
     a rounding, and the input says the cap */
  return body.slice(0, 7000);
}

export const send = mutation({
  args: {
    user: v.string(),
    name: v.string(),
    body: v.string(),
    owner: v.boolean(),
    tags: v.array(v.string()),
    machine: v.string(),
    thread: v.optional(v.string()),
    image: v.optional(v.string()),
    replyTo: v.optional(v.string()),
    /** a /vote line the client read out of the body. Only staff may send one,
     *  and the shape is checked here rather than trusted. */
    poll: v.optional(
      v.object({
        title: v.string(),
        options: v.array(v.object({ id: v.string(), text: v.string() })),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const slug = args.thread || GENERAL;

    /* bans first: a banned account or browser says nothing */
    const row = await memberOf(ctx, args.user);
    if (row?.banned) throw new Error(row.banReason || "This account is banned.");
    if (row?.machineBanned) throw new Error("This browser is banned.");
    const mb = await ctx.db.query("bans").withIndex("by_machine", (q: any) => q.eq("machine", args.machine)).first();
    if (mb) throw new Error("This browser is banned. No account from it can post.");

    const staff = await staffOf(ctx, args.user, args.owner);

    /* the gate: staff channels take staff words only */
    const fixed = CHANNELS.find((c) => c.slug === slug);
    if (fixed?.gate === "staff" && !staff) {
      throw new Error(`You do not have permission to post in #${slug}.`);
    }

    const said = screen(args.body, staff);
    /* a poll is content too: a vote under nothing but its own question is a
       thing staff do on purpose */
    const poll = voteOf(args.poll, staff);
    if (!said.clean.trim() && !args.image && !poll) throw new Error("say something first");

    /* a wall, not a door */
    const since = Date.now() - 4000;
    const mine = await ctx.db.query("messages").withIndex("by_at").order("desc").take(12);
    const onMe = mine.filter((m) => m.machine === args.machine && m.at > since).length;
    if (onMe >= 5) throw new Error("slow down a moment");

    const body = staff ? said.clean.slice(0, 7000) : cap(said.clean);
    if (!staff && args.body.trim().split(/\s+/).length > 1000) {
      throw new Error("Messages cap out at about 1000 words.");
    }

    /* mentions: @handle pings, and only staff may @everyone */
    const mentionWords = [...body.matchAll(/@([a-z0-9._-]{3,20})/gi)].map((m) => m[1].toLowerCase());
    const mentions = [...new Set(mentionWords)].slice(0, 12);
    const wantsEveryone = /@everyone\b/i.test(body);
    const everyone = wantsEveryone && staff;

    const at = Date.now();
    await ctx.db.insert("messages", {
      user: args.user.slice(0, 24),
      name: args.name.slice(0, 40),
      body,
      at,
      owner: args.owner,
      tag: args.tags[0] ?? null,
      tags: args.tags.slice(0, 2),
      machine: args.machine.slice(0, 40),
      thread: slug,
      image: args.image ? args.image.slice(0, 300_000) : undefined,
      replyTo: args.replyTo ?? undefined,
      poll: poll ?? undefined,
      reactions: {},
      reactedBy: [],
      reacts: [],
      mentions,
      everyone,
      md: staff ? "staff" : "basic",
    });

    /* Null Bot answers $commands in any room, still, because it is cheap */
    const cmd = said.clean.trim().match(/^\$([a-z0-9]+)\s*([\s\S]*)$/i);
    if (cmd) {
      try {
        const reply = await botReply(ctx, cmd[1].toLowerCase(), cmd[2].trim());
        if (reply) {
          await ctx.db.insert("messages", {
            user: "nullbot",
            name: "Null Bot",
            body: reply,
            at: at + 1,
            owner: false,
            tag: null,
            tags: [],
            machine: "nullbot",
            thread: slug,
            bot: true,
            md: "staff",
          });
        }
      } catch (e) {
        console.error("null bot could not answer", e);
      }
    }

    return { caught: said.caught.length ? said.caught : null, mentions, everyone };
  },
});

/* ---------- votes ---------- */

/** A vote attached to a message, or null.
 *
 *  Staff only: the check is here and not on the client, because the client is
 *  a claim. Everything else is a bound — a question that fits on a line, no
 *  more choices than a box can hold, and no titles made of markup, since the
 *  choices are drawn as text and never as HTML. */
function voteOf(
  sent: { title: string; options: { id: string; text: string }[] } | undefined,
  staff: boolean,
): { title: string; options: { id: string; text: string }[]; votes: { id: string; by: string[] }[] } | null {
  if (!sent || !staff) return null;
  const options = sent.options
    .map((o) => (o ? screen(String(o.text), staff).clean.trim() : ""))
    .filter(Boolean)
    .slice(0, 6)
    .map((text, i) => ({ id: `o${i + 1}`, text: text.slice(0, 80) }));
  /* two choices is the least a vote can be; one is a statement */
  if (options.length < 2) return null;
  const title = screen(String(sent.title ?? ""), staff).clean.trim().slice(0, 90) || "Vote";
  return { title, options, votes: options.map((o) => ({ id: o.id, by: [] })) };
}

/** One vote each, and a second tap takes it back. Clicking a different choice
 *  moves the vote rather than adding another: a tally that lets one person
 *  count twice is not a tally. */
export const vote = mutation({
  args: {
    id: v.string(),
    option: v.string(),
    by: v.string(),
    machine: v.string(),
    owner: v.boolean(),
  },
  handler: async (ctx, { id, option, by, machine }) => {
    const key = id ? await ctx.db.normalizeId("messages", id as never) : null;
    const m = key ? await ctx.db.get(key) : null;
    if (!key || !m || !m.poll) throw new Error("that vote is gone");

    const row = await memberOf(ctx, by);
    if (row?.banned) throw new Error("This account is banned.");
    const mb = await ctx.db.query("bans").withIndex("by_machine", (q: any) => q.eq("machine", machine)).first();
    if (mb) throw new Error("This browser is banned.");

    const me = by.trim().toLowerCase();
    if (!me) throw new Error("Sign in to vote.");

    const poll = {
      title: m.poll.title,
      options: m.poll.options,
      votes: (m.poll.votes ?? []).map((v: any) => ({ id: String(v.id), by: [...(v.by ?? [])] })),
    };
    /* a choice that is not on this poll is not a vote */
    if (!poll.options.some((o: any) => o.id === option)) throw new Error("that is not one of the choices");

    const before = poll.options.find((o: any) => (poll.votes.find((v: any) => v.id === o.id)?.by ?? []).includes(me));
    const same = before?.id === option;

    for (const v of poll.votes) v.by = v.by.filter((h: string) => h !== me);
    if (!same) {
      const hit = poll.votes.find((v: any) => v.id === option);
      if (!hit) poll.votes.push({ id: option, by: [me] });
      else hit.by.push(me);
    }

    await ctx.db.patch(key, { poll });
    return same ? null : option;
  },
});

/* ---------- reactions ---------- */

/** One tap adds your emoji, a second takes it back. Each emoji carries the
 *  list of who put it there, so a reaction is a set, not a number anyone can
 *  inflate by tapping twice. */
export const react = mutation({
  args: { id: v.string(), emoji: v.string(), by: v.string(), machine: v.string(), owner: v.boolean() },
  handler: async (ctx, { id, emoji, by, machine }) => {
    const key = id ? await ctx.db.normalizeId("messages", id as never) : null;
    const m = key ? await ctx.db.get(key) : null;
    if (!m || !key) throw new Error("that message is gone");

    const row = await memberOf(ctx, by);
    if (row?.banned) throw new Error("This account is banned.");
    const mb = await ctx.db.query("bans").withIndex("by_machine", (q: any) => q.eq("machine", machine)).first();
    if (mb) throw new Error("This browser is banned.");

    const glyph = [...emoji].slice(0, 8).join("");
    if (!glyph) return;

    const list = reactsOf(m);
    const me = by.trim().toLowerCase();
    const hit = list.find((r) => r.e === glyph);

    if (hit) {
      const at = hit.by.indexOf(me);
      if (at >= 0) hit.by.splice(at, 1); /* taking it back */
      else hit.by.push(me);
      if (!hit.by.length) list.splice(list.indexOf(hit), 1);
    } else {
      list.push({ e: glyph, by: [me] });
    }

    await ctx.db.patch(key, { reacts: list.slice(0, 24) });
  },
});

/* ---------- delete ---------- */

export const drop = mutation({
  args: { id: v.string(), by: v.string(), owner: v.boolean() },
  handler: async (ctx, { id, by, owner }) => {
    const key = id ? await ctx.db.normalizeId("messages", id as never) : null;
    const m = key ? await ctx.db.get(key) : null;
    if (!key || !m) return;
    const me = by.trim().toLowerCase();
    const staff = await staffOf(ctx, me, owner);
    /* your own words, or staff tidying the room */
    if (m.user.toLowerCase() !== me && !staff) throw new Error("that is not your message");
    await ctx.db.delete(key);
    return true;
  },
});

/* ---------- typing ---------- */

export const typing = mutation({
  args: { thread: v.string(), user: v.string(), name: v.string() },
  handler: async (ctx, { thread, user, name }) => {
    const key = user.trim().toLowerCase();
    if (!key) return;
    const old = await ctx.db
      .query("typing")
      .withIndex("by_thread", (q: any) => q.eq("thread", thread))
      .collect()
      .then((rows) => rows.find((r) => r.user === key));
    if (old) {
      await ctx.db.patch(old._id, { at: Date.now(), name: name.slice(0, 40) });
      return;
    }
    await ctx.db.insert("typing", { thread, user: key, name: name.slice(0, 40), at: Date.now() });
  },
});

export const stopTyping = mutation({
  args: { thread: v.string(), user: v.string() },
  handler: async (ctx, { thread, user }) => {
    const key = user.trim().toLowerCase();
    const old = await ctx.db
      .query("typing")
      .withIndex("by_thread", (q: any) => q.eq("thread", thread))
      .collect()
      .then((rows) => rows.find((r) => r.user === key));
    if (old) await ctx.db.delete(old._id);
  },
});

/** Who is typing, alive within the last six seconds. Stale rows are simply
 *  filtered: a cron that swept them would spend more than they are worth. */
export const typists = query({
  args: { thread: v.string(), exclude: v.optional(v.string()) },
  handler: async (ctx, { thread, exclude }) => {
    const rows = await ctx.db.query("typing").withIndex("by_thread", (q: any) => q.eq("thread", thread)).collect();
    const fresh = rows.filter((r: any) => Date.now() - r.at < 6000 && r.user !== (exclude ?? "").trim().toLowerCase());
    return fresh.map((r) => ({ user: r.user, name: r.name }));
  },
});

/** The room only needs a broom now and then. */
export const sweep = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("messages").withIndex("by_at").order("desc").collect();
    const old = rows.slice(600);
    for (const m of old) await ctx.db.delete(m._id);
    return old.length;
  },
});

/* ============================================================
   null bot
   ============================================================ */

const COMMANDS: [string, string][] = [
  ["$playerdata <name>", "everything NULL knows about a member"],
  ["$rich", "the five fattest coin purses"],
  ["$whois <name>", "when they joined and what they wrote"],
  ["$count", "how many members and how many messages"],
  ["$roll [faces]", "a die. default is a d20"],
  ["$8ball <question>", "an answer you did not ask for"],
  ["$help", "this list"],
];

const EIGHT = [
  "It is certain.", "Without a doubt.", "Yes — definitely.", "You may rely on it.",
  "Most likely.", "Reply hazy, try again.", "Ask again later.", "Cannot predict now.",
  "Do not count on it.", "My reply is no.", "My sources say no.", "Outlook not so good.",
];

const num = (n: number) => n.toLocaleString("en-US");

async function botReply(ctx: any, cmd: string, arg: string): Promise<string | null> {
  if (cmd === "help" || cmd === "commands") {
    return `I take ${COMMANDS.length} commands:\n${COMMANDS.map(([c, w]) => `${c} — ${w}`).join("\n")}`;
  }

  if (cmd === "ping") return "still here.";

  if (cmd === "roll") {
    const faces = Math.min(Math.max(parseInt(arg, 10) || 20, 2), 1000);
    return `🎲 d${faces} → **${1 + Math.floor(Math.random() * faces)}**`;
  }

  if (cmd === "8ball" || cmd === "eightball") {
    if (!arg) return "you have to ask me something.";
    return `🎱 ${EIGHT[Math.floor(Math.random() * EIGHT.length)]}`;
  }

  if (cmd === "count") {
    const members = await ctx.db.query("members").collect();
    const messages = await ctx.db.query("messages").collect();
    const threads = await ctx.db.query("threads").collect();
    return `**${num(members.length)}** members · **${num(messages.length)}** messages · **${threads.length + CHANNELS.length}** channels.`;
  }

  if (cmd === "rich" || cmd === "top") {
    const rows = await ctx.db.query("members").collect();
    const top = rows.sort((a: any, b: any) => b.coins - a.coins).slice(0, 5);
    if (!top.length) return "nobody has any coins yet. go and play something.";
    return `💠 the board:\n${top.map((m: any, i: number) => `${i + 1}. ${m.name} — ${num(m.coins)} coins`).join("\n")}`;
  }

  if (cmd === "whois" || cmd === "playerdata" || cmd === "player" || cmd === "stats") {
    if (!arg) {
      return cmd === "whois" ? "who? try `$whois mr blob`." : "whose data? try `$playerdata mr blob`.";
    }
    const key = arg.replace(/^@/, "").trim().toLowerCase();
    const row = await memberOf(ctx, key);
    if (!row) return `I have never seen anyone called *${key}* here.`;

    if (cmd === "whois") {
      const lines = [
        `**${row.name}** (@${row.user})`,
        `joined ${new Date(row.joined).toDateString()}`,
        `last seen ${ago(row.seen)}`,
      ];
      if (row.bio) lines.push(`“${row.bio.replace(/\n/g, " ")}”`);
      return lines.join("\n");
    }

    const wearsTag = (row.tags?.length ?? 0) > 0 || !!row.tag;
    const wearing = [
      row.avatar ? "a picture frame" : null,
      row.effect ? "a profile effect" : null,
      wearsTag ? "a name tag" : null,
    ].filter(Boolean);
    return [
      `📊 **${row.name}** (@${row.user})`,
      `coins ....... ${num(row.coins)}`,
      `joined ...... ${new Date(row.joined).toDateString()}`,
      `last seen ... ${ago(row.seen)}`,
      `wearing ..... ${wearing.length ? wearing.join(", ") : "nothing but defaults"}`,
      `owner ....... ${row.owner ? "yes" : "no"}`,
    ].join("\n");
  }

  return `I do not know \`$${cmd}\`. Try \`$help\`.`;
}

function ago(then: number): string {
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
