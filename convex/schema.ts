/* NULL · schema.ts
   The two things NULL keeps in the cloud, and nothing else.

   A member card is the public half of an account: what the Members page and
   the leaderboard draw. It deliberately holds no password and no email —
   there is nothing here worth stealing, which is the only kind of account a
   site like this should keep.

   A message belongs to the room, not to a conversation: NULL has one room. */

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
    tag: v.union(v.string(), v.null()),
    coins: v.number(),
    owner: v.boolean(),
    /** the last time any machine saw them */
    seen: v.number(),
  }).index("by_user", ["user"]),

  messages: defineTable({
    user: v.string(),
    name: v.string(),
    body: v.string(),
    at: v.number(),
    owner: v.boolean(),
    /** a message can wear the name tag its author is wearing */
    tag: v.union(v.string(), v.null()),
    /** the browser that sent it, so a client can spot its own echoes */
    machine: v.string(),
  }).index("by_at", ["at"]),
});
