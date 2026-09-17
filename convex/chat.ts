/* NULL · chat.ts
   The rooms, and the bot that lives in them.

   NULL has threads now rather than one wall: a general room that always
   exists, plus whatever the owner makes. Everything a message needs to draw
   itself is stored on the message — the name, the tag, whether the author
   owns the place — so a reader never has to join anything to see the room.

   Null Bot is deliberately not an AI: it is a lookup table of commands over
   data NULL already has (who is here, who is rich, what is on the shelf). It
   answers in the room, as a message, so everyone sees the answer. The AI
   assistant is a separate page, and separate on purpose — a bot that can be
   wrong is fine in a chat window and confusing in a leaderboard.

   The one honest hole: conversations here are not authenticated. A handle and
   a password live in the browser, so `owner` arrives as a claim. The server
   checks that claim against the member row when there is one, which stops an
   ordinary member from clearing rooms, and nothing stops somebody who knows
   how to edit a request. There is no account system on the server to do
   better with, and pretending otherwise would be the actual bug. */

import { v } from "convex/values";

import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { screen } from "./filter";

/** The room that exists whether or not anybody made one. */
const GENERAL = "general";

type Ctx = MutationCtx;

/* ---------- threads ---------- */

/** `general` plus every stored thread, oldest first. */
export const threads = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("threads").collect();
    const stored = rows
      .sort((a, b) => a.at - b.at)
      .map((t) => ({ slug: t.slug, name: t.name, topic: t.topic, at: t.at, general: false }));
    return [
      { slug: GENERAL, name: "general", topic: "everything that is not about anything in particular", at: 0, general: true },
      ...stored.filter((t) => t.slug !== GENERAL),
    ];
  },
});

/** Turn a name into the key threads, tabs and links all agree on. */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 24);
}

export const newThread = mutation({
  args: { name: v.string(), topic: v.optional(v.string()), user: v.string(), owner: v.boolean() },
  handler: async (ctx, args) => {
    await assertOwner(ctx, args.user, args.owner);
    const slug = slugify(args.name);
    if (!slug) throw new Error("that name has no letters in it");
    if (slug === GENERAL) throw new Error("general is always here");
    const had = await ctx.db.query("threads").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (had) throw new Error("there is already a thread called that");
    const count = (await ctx.db.query("threads").collect()).length;
    if (count >= 24) throw new Error("that is a lot of threads already");
    await ctx.db.insert("threads", {
      slug,
      name: slug,
      topic: (args.topic ?? "").slice(0, 120),
      at: Date.now(),
    });
    return slug;
  },
});

/** Clear the room without removing it: the thread stays, the scroll goes. */
export const clearThread = mutation({
  args: { slug: v.string(), user: v.string(), owner: v.boolean() },
  handler: async (ctx, args) => {
    await assertOwner(ctx, args.user, args.owner);
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_thread_at", (q) => q.eq("thread", args.slug))
      .collect();
    /* messages written before threads existed have no thread field at all, so
       only general has to go looking for them — and only general should pay
       for the full scan */
    const orphans =
      args.slug === GENERAL
        ? (await ctx.db.query("messages").collect()).filter((m) => !m.thread)
        : [];
    for (const m of [...rows, ...orphans]) await ctx.db.delete(m._id);
    return rows.length + orphans.length;
  },
});

/** Remove the room and everything said in it. `general` refuses. */
export const dropThread = mutation({
  args: { slug: v.string(), user: v.string(), owner: v.boolean() },
  handler: async (ctx, args) => {
    await assertOwner(ctx, args.user, args.owner);
    if (args.slug === GENERAL) throw new Error("general is not going anywhere");
    const hit = await ctx.db.query("threads").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first();
    if (!hit) throw new Error("no such thread");
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_thread_at", (q) => q.eq("thread", args.slug))
      .collect();
    for (const m of rows) await ctx.db.delete(m._id);
    await ctx.db.delete(hit._id);
    return rows.length;
  },
});

/** Owner, as far as the server can tell. See the note at the top of the file:
 *  a member row that exists can refuse the claim, and one that does not cannot
 *  confirm it. */
async function assertOwner(ctx: Ctx, user: string, claimed: boolean) {
  const key = user.trim().toLowerCase();
  const row = key
    ? await ctx.db.query("members").withIndex("by_user", (q) => q.eq("user", key)).first()
    : null;
  if (row) {
    if (!row.owner) throw new Error("only the owner can do that");
    return;
  }
  if (!claimed) throw new Error("only the owner can do that");
}

/* ---------- messages ---------- */

/** The newest slice of one room, oldest first so it reads like a log. */
export const recent = query({
  args: { thread: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const slug = args.thread || GENERAL;
    let rows: Doc<"messages">[];
    if (slug === GENERAL) {
      /* general covers the rows written before threads existed too */
      const all = await ctx.db.query("messages").withIndex("by_at").order("desc").take(110);
      rows = all.filter((m) => !m.thread || m.thread === GENERAL).slice(0, 80);
    } else {
      rows = await ctx.db
        .query("messages")
        .withIndex("by_thread_at", (q) => q.eq("thread", slug))
        .order("desc")
        .take(80);
    }

    /* A name is not nailed to the wall. A message stores who said it and the
       name they were using at the time, and the directory is asked for the
       name they use now — one lookup per distinct author — so renaming
       yourself renames everything you have ever said here. Anyone the
       directory does not know (the bot, an account that is gone) keeps the
       name the message was written with, because there is nothing better to
       show and a blank is worse than an old name. */
    const authors = [...new Set(rows.map((m) => m.user.trim().toLowerCase()))].slice(0, 60);
    const known = new Map(
      await Promise.all(
        authors.map(async (u) => {
          const row = u
            ? await ctx.db.query("members").withIndex("by_user", (q) => q.eq("user", u)).first()
            : null;
          return [u, row] as const;
        }),
      ),
    );

    return rows.reverse().map((m) => draw(m, known.get(m.user.trim().toLowerCase()) ?? null));
  },
});

/** One message, as a reader sees it. `member` is the author's row in the
 *  directory when there is one, and it is what the name and the tags come
 *  from: the current ones, not the ones the message was written with. */
function draw(m: Doc<"messages">, member: Doc<"members"> | null = null) {
  return {
    id: m._id,
    user: m.user,
    name: member && member.name.trim() ? member.name : m.name,
    body: m.body,
    at: m.at,
    owner: m.owner || member?.owner === true,
    /* the decoration is an id, so it costs nothing to carry here; the picture
       itself is a data URL and is asked for separately, by handle */
    avatar: member ? member.avatar : null,
    /* a row written before tags came in twos holds one under `tag` */
    tags: member
      ? (member.tags ?? (member.tag ? [member.tag] : []))
      : (m.tags ?? (m.tag ? [m.tag] : [])),
    machine: m.machine,
    bot: m.bot === true,
  };
}

export const send = mutation({
  args: {
    user: v.string(),
    name: v.string(),
    body: v.string(),
    owner: v.boolean(),
    /** the author's tags, in the order they put them on */
    tags: v.array(v.string()),
    machine: v.string(),
    thread: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slug = args.thread || GENERAL;
    const said = screen(args.body);
    if (!said.clean.trim()) throw new Error("say something first");

    /* a wall, not a door: anywhere between four and six a second is a human
       typing fast, and anything beyond it is a script filling the room */
    const since = Date.now() - 4000;
    const mine = await ctx.db.query("messages").withIndex("by_at").order("desc").take(12);
    const onMe = mine.filter((m) => m.machine === args.machine && m.at > since).length;
    if (onMe >= 5) throw new Error("slow down a moment");

    /* a thread the owner made goes away and comes back on its own; anything
       else has to be a room that exists */
    if (slug !== GENERAL) {
      const room = await ctx.db.query("threads").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
      if (!room) throw new Error("that thread is gone — pick another");
    }

    const at = Date.now();
    await ctx.db.insert("messages", {
      user: args.user.slice(0, 24),
      name: args.name.slice(0, 40),
      body: said.clean.trim(),
      at,
      owner: args.owner,
      tag: args.tags[0] ?? null,
      tags: args.tags.slice(0, 2),
      machine: args.machine.slice(0, 40),
      thread: slug,
    });

    /* The bot answers in the room, so everybody sees it — one message per
       command, and only the first command on a line.

       Wrapped, because a mutation is one transaction: if the bot threw, the
       message that asked the question would roll back with it, and a person
       would watch their own sentence fail because of the robot's. A bot that
       cannot answer is a bot that says nothing. */
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
          });
        }
      } catch (e) {
        console.error("null bot could not answer", e);
      }
    }

    return said.caught.length ? { caught: said.caught } : null;
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
  "It is certain.",
  "Without a doubt.",
  "Yes — definitely.",
  "You may rely on it.",
  "Most likely.",
  "Reply hazy, try again.",
  "Ask again later.",
  "Cannot predict now.",
  "Do not count on it.",
  "My reply is no.",
  "My sources say no.",
  "Outlook not so good.",
];

const num = (n: number) => n.toLocaleString("en-US");

async function botReply(ctx: Ctx, cmd: string, arg: string): Promise<string | null> {
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
    return `**${num(members.length)}** members · **${num(messages.length)}** messages · **${threads.length + 1}** threads.`;
  }

  if (cmd === "rich" || cmd === "top") {
    const rows = await ctx.db.query("members").collect();
    const top = rows.sort((a, b) => b.coins - a.coins).slice(0, 5);
    if (!top.length) return "nobody has any coins yet. go and play something.";
    return `💠 the board:\n${top.map((m, i) => `${i + 1}. ${m.name} — ${num(m.coins)} coins`).join("\n")}`;
  }

  if (cmd === "whois" || cmd === "playerdata" || cmd === "player" || cmd === "stats") {
    if (!arg) {
      return cmd === "whois"
        ? "who? try `$whois mr blob`."
        : "whose data? try `$playerdata mr blob`.";
    }
    const key = arg.replace(/^@/, "").trim().toLowerCase();
    const row = await ctx.db.query("members").withIndex("by_user", (q) => q.eq("user", key)).first();
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

/** Plain words for "when", because "1758043200000" helps nobody. */
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
