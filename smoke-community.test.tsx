/* A render pass over what this round changed: the chat rooms, the assistant,
   the tour and the tiny mark-up renderer. Convex is stubbed, because a test
   that needs a server is a test that fails on a train. */

import { expect, mock, test } from "bun:test";

/* ---- the shims have to exist before anything is imported ---- */
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};

const BOT = {
  id: "b1",
  user: "nullbot",
  name: "Null Bot",
  body: "📊 **mr blob** (@mrblob)\ncoins ....... 120,000\nwearing ..... a name tag",
  at: Date.now() - 60_000,
  owner: false,
  tag: null,
  machine: "nullbot",
  bot: true,
};

const HUMAN = {
  id: "m1",
  user: "mrblob",
  name: "mr blob",
  body: "morning",
  at: Date.now() - 30_000,
  owner: true,
  tags: ["tstar", "tcursed"],
  avatar: "chroma",
  machine: "abc",
  bot: false,
};

/* a line answering another one, so the reply stub is exercised too */
const REPLY = {
  id: "m2",
  user: "quill",
  name: "quill",
  body: "answering that one",
  at: Date.now() - 10_000,
  owner: false,
  tags: [],
  machine: "xyz",
  bot: false,
  replyTo: "b1",
  reactions: [{ e: "🔥", by: ["mrblob", "quill"] }],
};

/* what the room asks the directory for: the faces of the people in it */
const PICS = [{ user: "mrblob", pfp: "data:image/png;base64,iVBORw0KGgo=", avatar: "chroma" }];

/* the server's fixed channel list, plus one room somebody made by hand. The
   list is reassigned once below, to put the owner in a room they made. */
let rooms: {
  slug: string;
  name: string;
  topic: string;
  kind: string;
  gate: string | null;
  fixed: boolean;
}[];

const ROOMS = [
  { slug: "rules", name: "rules", topic: "the rules", kind: "text", gate: "staff", fixed: true },
  { slug: "announcements", name: "announcements", topic: "what staff say", kind: "text", gate: "staff", fixed: true },
  { slug: "updates", name: "updates", topic: "what changed", kind: "text", gate: "staff", fixed: true },
  { slug: "links", name: "links", topic: "things worth clicking", kind: "text", gate: "staff", fixed: true },
  { slug: "staff-shitpost", name: "staff-shitpost", topic: "staff only", kind: "text", gate: "staff", fixed: true },
  { slug: "general", name: "general", topic: "everything at once", kind: "text", gate: null, fixed: true },
  { slug: "member-shitpost", name: "member-shitpost", topic: "the other kind", kind: "text", gate: null, fixed: true },
  { slug: "general-voice", name: "general-voice", topic: "the voice room", kind: "voice", gate: null, fixed: true },
  { slug: "high-scores", name: "high-scores", topic: "brag here", kind: "text", gate: null, fixed: false },
];
rooms = ROOMS;

/* the directory, as the rail asks for it: one owner, one mod, one plain
   member who has gone quiet */
const MEMBERS = [
  {
    user: "mrblob",
    name: "mr blob",
    bio: "" as string,
    pfp: null as string | null,
    nameStyle: "{}",
    online: true,
    owner: true,
    roles: [] as string[],
    wearing: { avatar: "chroma" as string | null, effect: null, tags: ["tstar"] },
  },
  {
    user: "quietmod",
    name: "quiet mod",
    bio: "",
    pfp: null as string | null,
    nameStyle: "{}",
    online: true,
    owner: false,
    roles: ["mod"] as string[],
    wearing: { avatar: null, effect: null, tags: [] as string[] },
  },
  {
    user: "gone",
    name: "gone",
    bio: "",
    pfp: null as string | null,
    nameStyle: "{}",
    online: false,
    owner: false,
    roles: [] as string[],
    wearing: { avatar: null, effect: null, tags: [] as string[] },
  },
];

const CARD = {
  user: "quietmod",
  name: "quiet mod",
  bio: "keeps the rooms civil",
  banner: "",
  pfp: null,
  joined: Date.now() - 86_400_000 * 30,
  nameStyle: "{}",
  wearing: { avatar: null, effect: null, tags: [] as string[] },
  coins: 1200,
  owner: false,
  roles: ["mod"],
  online: true,
  views: 3,
  banned: false,
};

/* The stub answers by query, not by guessing from the arguments: a rail that
   is handed the room list renders nonsense, and nonsense that renders is a
   test that says everything is fine.

   A reference cannot be compared with `===`, because `api` is Convex's proxy
   and every read of a property mints a new one. The name it carries is the
   stable thing, so that is what the stub switches on. */
const NAME = Symbol.for("functionName");
const nameOf = (q: unknown) => (q as Record<symbol, string>)?.[NAME] ?? "";

mock.module("convex/react", () => ({
  useQuery: (q: unknown) => {
    switch (nameOf(q)) {
      case "members:pictures":
        return PICS;
      case "members:list":
        return MEMBERS;
      case "members:card":
        return CARD;
      case "members:graph":
        return { following: [], followers: [], friends: [] };
      case "members:reports":
        return { open: 0, total: 0, reasons: [] };
      case "chat:recent":
        return [BOT, HUMAN, REPLY];
      case "chat:messageById":
        return BOT;
      case "chat:threads":
        return rooms;
      case "chat:typists":
        return [];
      default:
        return undefined;
    }
  },
  useMutation: () => async () => null,
  useAction: () => async () => ({ ok: true, text: "hi" }),
  useConvex: () => ({ mutation: async () => "high-scores" }),
  ConvexProvider: ({ children }: { children: unknown }) => children,
  ConvexReactClient: class {
    mutation = async () => "high-scores";
  },
}));

const { renderToStaticMarkup } = await import("react-dom/server");
const { Chat } = await import("./src/pages/Chat");
const { Ai } = await import("./src/pages/Ai");
const { Tour } = await import("./src/components/Tour");
const { Rich, parse } = await import("./src/lib/rich");
const { Markdown } = await import("./src/lib/md");
const { RAIL_TOP, ALL_PAGES, PAGES } = await import("./src/lib/nav");
const { RELAYS } = await import("./src/lib/browser");
const { account } = await import("./src/lib/account");
const { OWNER } = await import("./src/lib/owner");

const checks: [string, boolean][] = [];
const ok = (what: string, fine: boolean) => checks.push([what, fine]);

/* ---------- the rooms, read-only ---------- */
const chatOut = renderToStaticMarkup(<Chat /> as never);
ok("chat draws a Channels sidebar", chatOut.includes("ch-side") && chatOut.includes("Channels"));
ok("chat lists the stored threads", chatOut.includes("high-scores") && chatOut.includes("general"));
ok("chat draws the feed", chatOut.includes("ch-feed"));
ok("a signed-out visitor gets a locked box, not an input", chatOut.includes("ch-locked") && !chatOut.includes("ch-input"));
ok("signed out, the owner tools stay away", !chatOut.includes("ch-tool"));
ok("the bot line is marked as the bot", chatOut.includes("is-bot") && chatOut.includes("say-badge"));
ok("the bot's markup became real tags", chatOut.includes("<b>mr blob</b>") && chatOut.includes("md-p"));
ok("the owner badge and shop tag both render", chatOut.includes("tagchip--owner") && chatOut.includes("tagchip"));
/* one chip for who they are, one for what they wear: the pile of tags that
   used to sit in the header pushed the names out of the way */
ok("a line wears one tag, not a pile", !chatOut.includes("say-more"));
ok("a reply draws the line it answers", chatOut.includes("say-reply") && chatOut.includes("coins ......."));
ok("a reaction is drawn with its count", chatOut.includes("say-react") && chatOut.includes("🔥"));
ok("the author's picture is in the room", chatOut.includes('<img src="data:image/png;base64,iVBORw0KGgo='));
ok("and the decoration they wear is drawn over it", chatOut.includes("art art--clip"));
ok("only the person with a picture gets one", (chatOut.match(/<img /g) ?? []).length === 1);
ok("the room header is there", chatOut.includes("ch-hash") && chatOut.includes("everything at once"));

/* ---------- ignoring somebody ----------
   Blocking is local and it is honest about that, so what gets tested is the
   part that is real: this browser stops drawing their lines, and says how
   many it is not showing instead of going quiet. */
const { toggleBlock, isBlocked } = await import("./src/lib/members");
ok("a handle is remembered as blocked, whatever case it wears", (() => {
  toggleBlock("MrBlob");
  const yes = isBlocked("@mrblob") && isBlocked("MRBLOB");
  return yes;
})());
const blockedOut = renderToStaticMarkup(<Chat /> as never);
ok("a blocked author's line is not drawn", !blockedOut.includes("morning"));
ok("and the room says so rather than going quiet", blockedOut.includes("ch-blockednote"));
ok("the rail marks them", blockedOut.includes("ch-member-blocked"));
ok("unblocking forgets, and the line comes back", (() => {
  const off = !toggleBlock("mrblob") && !isBlocked("mrblob");
  return off && renderToStaticMarkup(<Chat /> as never).includes("morning");
})());

/* ---------- the rooms, as the owner ---------- */
account.set({ user: OWNER, name: OWNER, joined: Date.now() });
const ownerOut = renderToStaticMarkup(<Chat /> as never);
ok("signed in, the message box appears", ownerOut.includes("ch-input") && ownerOut.includes("ch-tool"));
/* the owner's clear button belongs to a room somebody made; the fixed ones are
   not clearable, and the server refuses even if the interface were wrong */
ok("a fixed channel is never offered for clearing", !ownerOut.includes("Clear this room"));
ok("a made room is listed apart from the shelves", chatOut.includes("Rooms"));

/* the owner, standing in the one room somebody made by hand: the address does
   not match, so the room they land in is it, and the clear button appears */
rooms = [{ slug: "chill", name: "chill", topic: "made by hand", kind: "text", gate: null, fixed: false }];
const madeOut = renderToStaticMarkup(<Chat /> as never);
ok("the owner gets a Clear button on a made room", madeOut.includes("Clear this room"));
rooms = ROOMS;
account.set({ user: null });

/* ---------- the shape of the rooms ---------- */
for (const [what, fine] of [
  ["the channels are shelved, not flat", chatOut.includes("ch-shelf-head") && chatOut.includes("Info") && chatOut.includes("Social")],
  ["the search box is a real field", chatOut.includes("ch-find") && chatOut.includes("Search messages")],
  ["the rail groups the room", chatOut.includes("ch-member") && chatOut.includes("OWNER") && chatOut.includes("STAFF")],
  ["and separates who is here from who is not", chatOut.includes("ONLINE") && chatOut.includes("OFFLINE")],
  ["every face carries a presence dot", chatOut.includes("ch-dot")],
  ["a name keeps its own styling in the rail", chatOut.includes("ch-member-name")],
  ["a line carries a bar over it", chatOut.includes("ch-bar")],
  ["the bar offers a reaction, a reply and a report", chatOut.includes('title="Add a reaction"') && chatOut.includes('title="Reply"') && chatOut.includes('title="Report"')],
  ["someone else's line is never deletable by you", !chatOut.includes("Delete message")],
  ["the composer's tools exist once you can post", ownerOut.includes("ch-tools") && ownerOut.includes("ch-tool")],
] as [string, boolean][]) ok(what, fine);

/* ---------- the assistant ---------- */
const ai = renderToStaticMarkup(<Ai /> as never);
ok("the assistant draws a window", ai.includes("ai-window") && ai.includes("ai-feed"));
ok("the assistant offers ideas", ai.includes("ai-idea") && ai.includes("write a haiku about mondays"));
ok("the assistant is a chatbot, not a site guide", ai.includes("Ask me anything") && !ai.includes("Ask me about null"));
ok("the assistant has a box", ai.includes("ai-box") && ai.includes("ch-send"));
ok("with no key known yet, the box waits", ai.includes("Waiting for a key"));
ok("and it says it is checking", ai.includes("checking…"));

/* ---------- the tour ---------- */
const tour = renderToStaticMarkup(<Tour onDone={() => {}} /> as never);
ok("the tour dims the page", tour.includes("tour-dim"));
ok("the tour has no spotlight any more", !tour.includes("tour-hole"));
ok("the tour card is a step through five", tour.includes("tour-kicker") && tour.includes("1 / 5"));
ok("the tour still offers Skip", tour.includes(">Skip<"));

/* ---------- the mark-up renderer ---------- */
ok("bold is parsed", parse("**hi**").some((p) => p.kind === "bold" && p.text === "hi"));
ok("code is parsed", parse("try `$help`").some((p) => p.kind === "code" && p.text === "$help"));
ok("newlines become breaks", parse("a\nb").filter((p) => p.kind === "br").length === 1);
ok("a stray asterisk stays literal", parse("5 * 3").every((p) => p.kind === "text"));
const rich = renderToStaticMarkup(<Rich body={"**a** and `b`"} /> as never);
ok("Rich renders both", rich.includes("<b>a</b>") && rich.includes("<code>b</code>"));

/* ---------- the markdown the assistant answers in ----------
   The model is told to use headings, fences and tables, so all three have to
expected arrive as elements rather than as the syntax that asked for them. */
const md = renderToStaticMarkup(
  (
    <Markdown
      staff
      body={
        "## Head\n\npapers\n\n- one\n- two\n\n```js\nconst a = 1;\n```\n\n| a | b |\n| --- | --- |\n| 1 | 2 |"
      }
    />
  ) as never,
);
ok("a heading arrives as a heading", md.includes("md-h2") && md.includes("Head") && !md.includes("##"));
ok("a fence arrives as one code block", md.includes("md-pre") && md.includes("const a = 1;") && !md.includes("```"));
ok("a language on the fence is kept", md.includes("md-pre--lang"));
ok("a list arrives as a list", md.includes("md-li--ul") && md.includes("one") && !md.includes("- one"));
ok(
  "a table arrives as a table",
  md.includes("md-table") && md.includes("<th><span>a</span></th>") && md.includes("<td><span>1</span></td>"),
);
ok("and its header rule is not printed at anyone", !md.includes("---"));

/* ---------- the stylesheets ----------
   A declaration that sits outside any rule is a typo that does nothing at all,
   and it is invisible: braces still balance and the file still parses. This is
   exactly how a decoration's absolute layer got attached to the page instead
   of the avatar — a comment ended with its terminator followed by a closing
   brace, which shut the rule early, so the `position: relative` it needed was
   dropped. So: strip the comments, walk the braces, and insist every
   declaration is inside something. */
const fs = await import("node:fs");
const strays: string[] = [];
for (const name of fs.readdirSync("src/styles").filter((f) => f.endsWith(".css"))) {
  /* comments blanked, newlines kept, so line numbers stay honest */
  const css = fs
    .readFileSync(`src/styles/${name}`, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  let depth = 0;
  css.split("\n").forEach((line, i) => {
    if (depth === 0 && /^\s*[a-z-]+\s*:[^;]*;/.test(line)) strays.push(`${name}:${i + 1} ${line.trim()}`);
    for (const ch of line) {
      if (ch === "{") depth += 1;
      else if (ch === "}") depth = Math.max(0, depth - 1);
    }
  });
}
ok("every stylesheet declares inside a rule", strays.length === 0);
if (strays.length) console.log(strays.join("\n"));

const community = fs.readFileSync("src/styles/community.css", "utf8");
ok(
  "the chat avatar is what a decoration is positioned against",
  /\.say-pic \{[\s\S]*?position: relative;/m.test(community) && /\.say-pic \{[\s\S]*?isolation: isolate;/m.test(community),
);

/* ---------- the rail and the relay list ---------- */
ok("the assistant sits below Apps in the rail", RAIL_TOP.indexOf("ai") === RAIL_TOP.indexOf("apps") + 1);
ok("the assistant is listed in All Apps", ALL_PAGES.includes("ai") && !!PAGES.ai);
ok("the assistant has an internal address", PAGES.ai.address === "null://ai");
ok("every relay is a websocket", RELAYS.every((r) => r.url.startsWith("wss://")));
ok("a live relay is tried first", RELAYS[0].url === "wss://anura.pro/");

let bad = 0;
for (const [what, fine] of checks) {
  if (!fine) bad++;
  console.log(`${fine ? "ok  " : "FAIL"}  ${what}`);
}
console.log(`\n${checks.length - bad}/${checks.length} passed`);
if (bad) throw new Error(`${bad} check(s) failed`);
test("render pass", () => expect(bad).toBe(0));
