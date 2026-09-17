/* NULL · schema.ts
   What NULL keeps in the cloud, and nothing else.

   A member card is the public half of an account: what the Members page and
   the leaderboard draw. It deliberately holds no password and no email —
   there is nothing here worth stealing, which is the only kind of account a
   site like this should keep.

   A thread is a room in the chat. `general` is not stored: it is the room
   that exists whether or not anybody made one, and the server adds it to
   every list it sends.

   A message belongs to a thread. `thread` is optional because messages were
   written before threads existed, and a row that cannot be read is worse than
   a row with a default — the reader treats a missing thread as `general`. */

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
  }).index("by_user", ["user"]),

  threads: defineTable({
    /** url-safe, lowercased, and unique — the key everything else uses */
    slug: v.string(),
    /** what the sidebar calls it, with the # left off */
    name: v.string(),
    /** one line under the thread name, Discord-style */
    topic: v.string(),
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
  })
    .index("by_at", ["at"])
    .index("by_thread_at", ["thread", "at"]),
});
