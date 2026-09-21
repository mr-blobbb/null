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
    /** staff roles as the owner grants them: admin, coowner, dev, beta,
     *  linker, partner — any number of them at once */
    roles: v.optional(v.array(v.string())),
    /** the circle beside the name. Not a permission, just a mark. */
    verified: v.optional(v.boolean()),
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
    /** what they signed in on, as the profile chip prints it */
    device: v.optional(v.string()),
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
    /** a message this line is quoting, kept as its own copy so a deleted
     *  original does not leave a hole in the conversation */
    quote: v.optional(
      v.object({ user: v.string(), name: v.string(), body: v.string(), at: v.number() }),
    ),
    /** a staff vote riding on the line: the question, the choices, and who
     *  picked what. Votes are a list of { id, by } for the same reason
     *  reactions are: an option id is ASCII, an emoji is not. */
    poll: v.optional(
      v.object({
        title: v.string(),
        options: v.array(v.object({ id: v.string(), text: v.string() })),
        votes: v.array(v.object({ id: v.string(), by: v.array(v.string()) })),
      }),
    ),
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

  giftCodes: defineTable({
    code: v.string(),
    gives: v.string(),
    amount: v.number(),
    createdBy: v.string(),
    usedBy: v.union(v.string(), v.null()),
    at: v.number(),
  }).index("by_code", ["code"]),

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

  /* ---------- voice ----------
     A room is not streamed: every browser holds one call to every other
     browser in it, and these two tables are only the introduction. `voice`
     is who is in the room and what their microphone is doing; `voiceSignals`
     is the offers, answers and addresses they hand each other on the way in.
     Nothing here carries audio. */
  voice: defineTable({
    thread: v.string(),
    user: v.string(),
    name: v.string(),
    /** bumped every few seconds, the same way presence is */
    at: v.number(),
    muted: v.boolean(),
    deaf: v.boolean(),
  })
    .index("by_thread", ["thread"])
    .index("by_thread_user", ["thread", "user"]),

  voiceInvites: defineTable({
    room: v.string(),
    from: v.string(),
    to: v.string(),
    kind: v.string(),
    at: v.number(),
    status: v.string(),
  })
    .index("by_to_status", ["to", "status"])
    .index("by_from", ["from"]),

  voiceSignals: defineTable({
    thread: v.string(),
    /** who wrote it */
    from: v.string(),
    /** who it is for */
    to: v.string(),
    /** "offer" | "answer" | "ice" | "bye" */
    kind: v.string(),
    /** the SDP or the candidate, as JSON */
    data: v.string(),
    at: v.number(),
  }).index("by_to_thread", ["to", "thread"]),

  /* ---------- what members keep ---------- */

  /** one game's save, per slot, on the account rather than the machine: the
   *  same progress at school and at home. `data` is whatever the game keeps,
   *  handed back exactly as it was given. */
  saves: defineTable({
    user: v.string(),
    game: v.string(),
    name: v.string(),
    slot: v.string(),
    data: v.string(),
    /** where it came from, for the label: this browser, or pasted in */
    from: v.string(),
    at: v.number(),
  })
    .index("by_user", ["user"])
    .index("by_user_game", ["user", "game"]),

  /* ---------- moderation, the other half ---------- */

  /** an appeal: the punished party's side of the story, and what staff said
   *  back. Filing one never unlocks anything on its own — a person decides. */
  appeals: defineTable({
    user: v.string(),
    /** "account" or "machine" — what they are appealing */
    kind: v.string(),
    body: v.string(),
    at: v.number(),
    /** "open" | "granted" | "denied" */
    status: v.string(),
    by: v.optional(v.string()),
    note: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
  })
    .index("by_user", ["user"])
    .index("by_status", ["status"]),

  /** every staff action worth being able to read back: who did what, to whom,
   *  and what they said it was for. Append-only, and nothing deletes it. */
  audit: defineTable({
    by: v.string(),
    /** "ban" | "unban" | "roles" | "verified" | "report" | "report-handled"
     *  | "appeal-decided" | "purge" — a string rather than a union so an
     *  action added later never fails to write */
    action: v.string(),
    user: v.string(),
    detail: v.string(),
    at: v.number(),
  })
    .index("by_at", ["at"])
    .index("by_user", ["user"]),

  /** who is typing, right now. Rows are cheap and die young. */
  typing: defineTable({
    thread: v.string(),
    user: v.string(),
    name: v.string(),
    at: v.number(),
  }).index("by_thread", ["thread"]),

  /* ---------- what members do for each other ---------- */

  /** one member handing another something: coins, or a piece off the shelf.
   *  `gives` is an item id or the literal "coins"; the receiving machine
   *  settles it against its own till, because that is where coins live. */
  gifts: defineTable({
    from: v.string(),
    to: v.string(),
    gives: v.string(),
    amount: v.number(),
    note: v.string(),
    at: v.number(),
    /** set when the receiver takes it — and never twice. On a trade it means
     *  accepted rather than paid: the two halves move separately. */
    claimedAt: v.optional(v.number()),
    /** set when they wave it away instead */
    declined: v.optional(v.boolean()),
    /* ---------- a trade ---------- */
    /** what the sender asks for in return, absent on a plain gift. Same shape
     *  as `gives`: an item id or the literal "coins" */
    wants: v.optional(v.string()),
    wantAmount: v.optional(v.number()),
    /** each half of a swap, marked by the side that parted with it. Neither
     *  half moves until the side that owes it has said so, which is what
     *  stops a trade from paying out twice or from paying out to nobody. */
    gave: v.optional(v.boolean()),
    got: v.optional(v.boolean()),
  })
    .index("by_to", ["to"])
    .index("by_from", ["from"])
    .index("by_to_at", ["to", "at"]),

  /** favourites and playlists, as the page stores them, so the same library
   *  is on every machine somebody signs in from */
  tunes: defineTable({
    user: v.string(),
    favorites: v.string(),
    playlists: v.string(),
    at: v.number(),
  }).index("by_user", ["user"]),

  /** a room listening together: the code to join, who is holding it, and the
   *  row the host last pushed */
  jams: defineTable({
    code: v.string(),
    host: v.string(),
    /** the Track as JSON, or absent when nothing has been played yet */
    track: v.optional(v.string()),
    playing: v.boolean(),
    /** where in the track the host was when they pushed it */
    at: v.number(),
    /** when they pushed it, which is how a guest knows how far to catch up */
    stamp: v.number(),
    open: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_host", ["host"]),
});
