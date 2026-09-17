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

/* what the room asks the directory for: the faces of the people in it */
const PICS = [{ user: "mrblob", pfp: "data:image/png;base64,iVBORw0KGgo=", avatar: "chroma" }];

const ROOMS = [
  { slug: "general", name: "general", topic: "everything at once", at: 0, general: true },
  { slug: "high-scores", name: "high-scores", topic: "brag here", at: 1, general: false },
];

/* the real useQuery is told which query it is running, so the stub can be
   too: anything with a `thread` argument is messages, everything else is the
   thread list */
mock.module("convex/react", () => ({
  useQuery: (_q: unknown, args?: Record<string, unknown>) => {
    if (args && "users" in args) return PICS;
    return args && "thread" in args ? [BOT, HUMAN] : ROOMS;
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
const { RAIL_TOP, ALL_PAGES, PAGES } = await import("./src/lib/nav");
const { RELAYS } = await import("./src/lib/browser");
const { account } = await import("./src/lib/account");
const { OWNER } = await import("./src/lib/owner");

const checks: [string, boolean][] = [];
const ok = (what: string, fine: boolean) => checks.push([what, fine]);

/* ---------- the rooms, read-only ---------- */
const chatOut = renderToStaticMarkup(<Chat /> as never);
ok("chat draws a Rooms sidebar", chatOut.includes("ch-side") && chatOut.includes(">Rooms<"));
ok("chat lists the stored threads", chatOut.includes("high-scores") && chatOut.includes("general"));
ok("chat draws the feed", chatOut.includes("ch-feed"));
ok("a signed-out visitor gets a locked box, not an input", chatOut.includes("ch-locked") && !chatOut.includes("ch-input"));
ok("signed out, the owner tools stay away", !chatOut.includes("ch-tools"));
ok("the bot line is marked as the bot", chatOut.includes("is-bot") && chatOut.includes("say-badge"));
ok("the bot's markup became real tags", chatOut.includes("<b>mr blob</b>") && chatOut.includes("<br/>"));
ok("the owner badge and shop tag both render", chatOut.includes("tagchip--owner") && chatOut.includes("tagchip"));
ok("the author's picture is in the room", chatOut.includes('<img src="data:image/png;base64,iVBORw0KGgo='));
ok("and the decoration they wear is drawn over it", chatOut.includes("art art--clip"));
ok("only the person with a picture gets one", (chatOut.match(/<img /g) ?? []).length === 1);
ok("the room header is there", chatOut.includes("ch-hash") && chatOut.includes("everything at once"));

/* ---------- the rooms, as the owner ---------- */
account.set({ user: OWNER, name: OWNER, joined: Date.now() });
const ownerOut = renderToStaticMarkup(<Chat /> as never);
ok("signed in, the message box appears", ownerOut.includes("ch-input") && ownerOut.includes("ch-send"));
ok("the owner gets a Clear button", ownerOut.includes("ch-tools") && ownerOut.includes("Clear this room"));
ok("general cannot be deleted from the interface", !ownerOut.includes("Delete this thread"));
account.set({ user: null });

/* ---------- the assistant ---------- */
const ai = renderToStaticMarkup(<Ai /> as never);
ok("the assistant draws a window", ai.includes("ai-window") && ai.includes("ai-feed"));
ok("the assistant offers ideas", ai.includes("ai-idea") && ai.includes("what is null?"));
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
