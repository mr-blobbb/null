/* NULL · schema.ts
   What NULL keeps in the cloud, and nothing else.

   A member card is the public half of an account: what the Members page and
   the leaderboard draw. It deliberately holds no password and no email —
   there is nothing here worth stealing, which is the only kind of account a
   site like this should keep.

   A thread is a room in the chat. `general` is not stored: it is the room
   that exists whether or not anybody made one, and the server adds it to
   every list it sends. */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  members: defineTable({
    /* lowercased handle, which is also the key a card is written under */
    user: v.string(),
    name: v.string(),
    bio: v.string(),
    banner: v.string(),
    pfp: v.union(v.string(), v.null()),
    joined: v.number(),
    /** the display-name styling, kept as the JSON the profile page stores */
    nameStyle: v.string(),
    /** what they are wearing, so other machines can draw the card */
    avatar: v.union(v.string(), v.null()),
    effect: v.union(v.string(), v.null()),
    /** the first tag ever worn here, kept so rows written before tags came
     *  in twos still read — `tags` is the list that matters */
    tag: v.union(v.string(), v.null()),
    tags: v.optional(v.array(v.string())),
    coins: v.number(),
    owner: v.boolean(),
    /** the last time any machine saw them */
    seen: v.number(),
    /* ---------- staff ---------- */
    /** staff roles as the owner grants them: "admin", "mod", or both */
    roles: v.optional(v.array(v.string())),
    /* ---------- presence ---------- */
    /** what this person is doing right now: { kind, name, detail } as JSON */
    activity: v.optional(v.string()),
    /** who may see it: everyone, friends, or nobody */
    activityVisible: v.optional(v.string()),
    /* ---------- profile counters ---------- */
    views: v.optional(v.number()),
    /* ---------- moderation ---------- */
    /** set by staff; a banned handle may not post, chat or DM */
    banned: v.optional(v.boolean()),
    banReason: v.optional(v.string()),
    /** every address that has ever signed this account in */
    machines: v.optional(v.array(v.string())),
    /** set when staff decide the browser itself should not come back */
    machineBanned: v.optional(v.boolean()),
  })
    .index("by_user", ["user"])
    .index("by_role", ["roles"]),

  threads: defineTable({
    /** url-safe, lowercased, and unique — the key everything else uses */
    slug: v.string(),
    /** what the sidebar calls it, with the # left off */
    name: v.string(),
    /** one line under the thread name, Discord-style */
    topic: v.string(),
    /** one of "text" or "voice" */
    kind: v.optional(v.string()),
    /** null = everyone, "staff" = staff only */
    gate: v.optional(v.string()),
    at: v.number(),
  }).index("by_slug", ["slug"]),

  messages: defineTable({
    user: v.string(),
    name: v.string(),
    body: v.string(),
    at: v.number(),
    owner: v.boolean(),
    /** a message wears the name tags its author was wearing, as a list; the
     *  single `tag` is the same field as a string, for rows written first */
    tag: v.union(v.string(), v.null()),
    tags: v.optional(v.array(v.string())),
    /** the browser that sent it, so a client can spot its own echoes */
    machine: v.string(),
    /** which room, absent on anything written before threads existed */
    thread: v.optional(v.string()),
    /** true for Null Bot, so the client can draw it as the site talking */
    bot: v.optional(v.boolean()),
    /* ---------- the new pieces ---------- */
    /** a data URL, capped hard: chat pictures are never worth a megabyte */
    image: v.optional(v.union(v.string(), v.null())),
    /** the message id this one answers, when it is a reply */
    replyTo: v.optional(v.union(v.string(), v.null())),
    /** { emoji: count } for everything anyone has thrown on this line */
    reactions: v.optional(v.any()),
    /** who typed each emoji, so a second tap takes a reaction back */
    reactedBy: v.optional(v.array(v.string())),
    /** the reactions as a list: the emoji as a value, never as a field name,
     *  because Convex only allows ASCII in those and an emoji is not ASCII */
    reacts: v.optional(v.array(v.object({ e: v.string(), by: v.array(v.string()) }))),
    /** handles the line @mentions, which is what the bell is for */
    mentions: v.optional(v.array(v.string())),
    /** true when the author pinged everyone and was allowed to */
    everyone: v.optional(v.boolean()),
    /** the kind of markdown the author was allowed: "staff" or "basic" */
    md: v.optional(v.string()),
  })
    .index("by_at", ["at"])
    .index("by_thread_at", ["thread", "at"]),

  /* ---------- moderation ---------- */

  bans: defineTable({
    /** the handle that was banned */
    user: v.string(),
    /** "account" or "machine" — the second never lets the browser back */
    kind: v.string(),
    reason: v.string(),
    by: v.string(),
    at: v.number(),
    /** machine bans key on the machine id, not the handle */
    machine: v.optional(v.string()),
  })
    .index("by_user", ["user"])
    .index("by_machine", ["machine"]),

  reports: defineTable({
    /** who was reported */
    user: v.string(),
    by: v.string(),
    reason: v.string(),
    /** the message id when the report came from a line in chat */
    message: v.optional(v.string()),
    at: v.number(),
    handled: v.optional(v.boolean()),
  }).index("by_user", ["user"]),

  /* ---------- people ---------- */

  /** one row per edge; `a` is always the earlier handle alphabetically, so a
   *  pair can only ever have one row and mutuals are two rows */
  follows: defineTable({
    a: v.string(),
    b: v.string(),
    at: v.number(),
  })
    .index("by_a", ["a"])
    .index("by_b", ["b"])
    .index("by_pair", ["a", "b"]),

  /** direct messages: one thread per ordered pair, same trick as follows */
  dms: defineTable({
    a: v.string(),
    b: v.string(),
    body: v.string(),
    image: v.optional(v.union(v.string(), v.null())),
    at: v.number(),
    from: v.string(),
  })
    .index("by_pair_at", ["a", "b", "at"])
    .index("by_a", ["a"])
    .index("by_b", ["b"]),

  /** who is typing, right now. Rows are cheap and die young. */
  typing: defineTable({
    thread: v.string(),
    user: v.string(),
    name: v.string(),
    at: v.number(),
  }).index("by_thread", ["thread"]),
});
