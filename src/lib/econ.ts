/* NULL · econ.ts
   Coins, and the shelf they buy from.

   Coins come from time on the site and nothing else: three a minute while
   the tab is visible and the visitor is moving, plus a thirty-coin milestone
   every fifteen minutes. Nothing accrues while the tab is hidden or while
   the keyboard and mouse have been still for a minute and a half, which is
   the whole of "should pause whilst the tab is idle".

   Everything below lives in localStorage. There is no server to lose it on. */

import { createStore, useStore } from "./store";
import { AVATAR_ASSETS, EFFECT_ASSETS } from "./shopAssets";

export const COINS_PER_MINUTE = 3;
export const MILESTONE_SECONDS = 15 * 60;
export const MILESTONE_COINS = 30;
export const IDLE_MS = 90_000;
export const GIFT_COINS = 100;

export type Shelf = "avatar" | "effect" | "tag";

export type ShopItem = {
  id: string;
  shelf: Shelf;
  name: string;
  desc: string;
  /** the list price: what the piece costs on an ordinary day, and the number a
   *  sale crosses out. What it goes for right now is `dealOf`. */
  price: number;
  /** never in the rotating sale. It is sold at its list price, and only a
   *  holiday takes anything off it. */
  noSale?: true;
  /** name tags carry their own colour */
  color?: string;
  /** a tag with a dark fill writes its name in light ink instead */
  ink?: string;
  /** a small symbol before the name, for tags that want one */
  glyph?: string;
  /** a finish for a tag, styled in shop.css. The first six move: the rest
   *  are the same idea standing still. */
  art?:
    | "glow"
    | "haunt"
    | "stripe"
    | "split"
    | "mono"
    | "cursed"
    | "jitter"
    | "doze"
    | "bob"
    | "sway"
    | "drip"
    | "cursor"
    | "beat";
};

export const SHELVES: { id: Shelf; name: string; note: string }[] = [
  {
    id: "avatar",
    name: "Avatar decorations",
    note: "A loop that runs around your picture.",
  },
  {
    id: "effect",
    name: "Profile effects",
    note: "A looping overlay across your whole card — picture, banner and all.",
  },
  {
    id: "tag",
    name: "Name tags",
    note: "A chip that sits next to your name. Some of them move.",
  },
];

/* The two picture shelves come straight from the asset list, so a
   decoration and the picture that draws it can never drift apart. */
const DECOS: ShopItem[] = [
  ...AVATAR_ASSETS.map((a): ShopItem => ({
    id: a.id,
    shelf: "avatar",
    name: a.name,
    desc: a.desc,
    price: a.price,
  })),
  ...EFFECT_ASSETS.map((a): ShopItem => ({
    id: a.id,
    shelf: "effect",
    name: a.name,
    desc: a.desc,
    price: a.price,
  })),
];

const TAGS: ShopItem[] = [
  /* name tags */
  {
    id: "tstar",
    shelf: "tag",
    name: "STAR",
    desc: "effortlessly",
    price: 720,
    color: "#f0c85a",
  },
  {
    id: "tcool",
    shelf: "tag",
    name: "COOL",
    desc: "effortlessly",
    price: 760,
    color: "#6cc7ff",
  },
  {
    id: "ttuff",
    shelf: "tag",
    name: "TUFF",
    desc: "Certified tuff",
    price: 820,
    color: "#e2686a",
  },
  {
    id: "tspecial",
    shelf: "tag",
    name: "SPECIAL",
    desc: "One of a kind",
    price: 900,
    color: "#c08bff",
  },
  {
    id: "taura",
    shelf: "tag",
    name: "AURA",
    desc: "+1000 aura",
    price: 960,
    color: "#58c98e",
  },
  {
    id: "tname",
    shelf: "tag",
    name: "NAME",
    desc: "It just says NAME",
    price: 720,
    color: "#b9b9c0",
  },
  {
    id: "tlarp",
    shelf: "tag",
    name: "LARP",
    desc: "None of it was real",
    price: 1040,
    color: "#ff8a5c",
  },
  {
    id: "tgoat",
    shelf: "tag",
    name: "GOAT",
    desc: "Greatest of all time",
    price: 1600,
    color: "#f2c14e",
    glyph: "★",
    art: "glow",
  },
  {
    id: "tclutch",
    shelf: "tag",
    name: "CLUTCH",
    desc: "Down to the last second",
    price: 940,
    color: "#ffe066",
    art: "beat",
  },
  {
    id: "tnpc",
    shelf: "tag",
    name: "NPC",
    desc: "Dialogue not included",
    price: 720,
    color: "#a9a9b2",
    art: "cursor",
  },
  {
    id: "tsigma",
    shelf: "tag",
    name: "SIGMA",
    desc: "Self-employed",
    price: 980,
    color: "#8fb8e8",
  },
  {
    id: "tmenace",
    shelf: "tag",
    name: "MENACE",
    desc: "A certified problem",
    price: 1120,
    color: "#ff5d5d",
    art: "stripe",
  },
  {
    id: "tdelulu",
    shelf: "tag",
    name: "DELULU",
    desc: "It is real to me",
    price: 880,
    color: "#f0a6c8",
    art: "sway",
  },
  {
    id: "thaunted",
    shelf: "tag",
    name: "HAUNTED",
    desc: "Presence noted",
    price: 1240,
    color: "#2b2b34",
    ink: "#e9e9f0",
    art: "haunt",
  },
  {
    id: "tglitch",
    shelf: "tag",
    name: "GLITCH",
    desc: "Not a bug, a feature",
    price: 1360,
    color: "#5ce1c4",
    art: "split",
  },
  {
    id: "tchef",
    shelf: "tag",
    name: "CHEF",
    desc: "Let him cook",
    price: 860,
    color: "#ffb86b",
  },
  {
    id: "tpixel",
    shelf: "tag",
    name: "PIXEL",
    desc: "Drawn by hand",
    price: 900,
    color: "#9ae6a0",
    art: "mono",
  },
  {
    id: "tsleepy",
    shelf: "tag",
    name: "SLEEPY",
    desc: "Five more minutes",
    price: 780,
    color: "#b6bede",
    art: "doze",
  },
  {
    id: "tcooked",
    shelf: "tag",
    name: "COOKED",
    desc: "It is so over",
    price: 1060,
    color: "#ff7a45",
    art: "jitter",
  },
  {
    id: "tunemployed",
    shelf: "tag",
    name: "UNEMPLOYED",
    desc: "But working on it",
    price: 700,
    color: "#cfd6c4",
    art: "bob",
  },
  {
    id: "tceo",
    shelf: "tag",
    name: "CEO",
    desc: "Of absolutely nothing",
    price: 1180,
    color: "#e8d8a8",
  },
  {
    id: "tlocal",
    shelf: "tag",
    name: "LOCAL",
    desc: "Gatekeeper, actually",
    price: 760,
    color: "#c6c6d0",
  },
  {
    id: "tmoist",
    shelf: "tag",
    name: "MOIST",
    desc: "Why would you buy this",
    price: 980,
    color: "#79c9d6",
    art: "drip",
  },
  /* the one that is genuinely wrong to wear: sold at full price, and the
     only piece whose finish moves on its own */
  {
    id: "tcursed",
    shelf: "tag",
    name: "CURSED",
    desc: "Do not wear this",
    price: 4200,
    noSale: true,
    color: "#17171f",
    ink: "#e8e8f0",
    art: "cursed",
  },
];

export const SHOP: ShopItem[] = [...DECOS, ...TAGS];

export type Gift = {
  code: string;
  /** an item id, or the literal "coins" */
  gives: string;
  amount: number;
  at: number;
  used: boolean;
};

/** How many name tags a player can wear at once. Two, because one tag is a
 *  label and two is a look, and three is a pile. */
export const MAX_TAGS = 2;

export type Econ = {
  coins: number;
  earned: number;
  spent: number;
  owned: string[];
  equipped: { avatar: string | null; effect: string | null; tags: string[] };
  /** seconds spent on the site, and of those, seconds in a game */
  seconds: number;
  playSeconds: number;
  /** whole milestones already paid out */
  milestones: number;
  gifts: Gift[];
  plays: number;
  seen: string[];
};

const EMPTY: Econ = {
  coins: 0,
  earned: 0,
  spent: 0,
  owned: [],
  equipped: { avatar: null, effect: null, tags: [] },
  seconds: 0,
  playSeconds: 0,
  milestones: 0,
  gifts: [],
  plays: 0,
  seen: [],
};

export const econ = createStore<Econ>("econ", EMPTY);

export function useEcon(): Econ {
  return useStore(econ);
}

/* The shelf once sold one tag, so an older browser holds `equipped.tag`
   instead of `equipped.tags`. Bring that shape forward once, on the way in,
   rather than leaving every page to defend against it. */
function settle() {
  const eq = econ.get().equipped as Partial<Econ["equipped"]> & { tag?: string | null };
  if (Array.isArray(eq.tags)) return;
  econ.set({
    equipped: {
      avatar: eq.avatar ?? null,
      effect: eq.effect ?? null,
      tags: typeof eq.tag === "string" ? [eq.tag] : [],
    },
  });
}
settle();

export function itemOf(id: string | null | undefined): ShopItem | undefined {
  if (!id) return undefined;
  return SHOP.find((i) => i.id === id);
}

/** A worn list, in order, skipping anything the shelf no longer sells. A
 *  missing list is an empty one, because a page holding a row from before
 *  tags came in twos should draw nothing, not fall over. */
export function itemsOf(ids: string[] | null | undefined): ShopItem[] {
  if (!ids) return [];
  return ids
    .map((id) => SHOP.find((i) => i.id === id))
    .filter((i): i is ShopItem => i !== undefined);
}

/* ---------- sales ----------
   Prices are not fixed any more. Once a month the shelves are re-marked:
   about a third of what is on them goes on sale, each piece at its own
   percentage, so the crossing-out moves around the shop instead of living on
   the same three cards forever. The new prices arrive at midnight on the
   first and stay put until the next month starts.

   Nothing is stored and nothing is random per render. A piece's roll is a hash
   of its id and the month it is in, so a reload shows the same prices, two
   tabs agree, and the only thing that changes anything is the calendar.

   And on a holiday everything is half price, always. The days live in the
   table below, so the next one is a line of data rather than a deploy. */

const SALE_CHANCE = 0.34;
const SALE_STEPS = [10, 15, 20, 25, 30, 35, 40];
const HOLIDAY_OFF = 50;

/** The days NULL celebrates, and how far back the celebration reaches. */
const HOLIDAYS: { name: string; month: number; day: number; span?: number }[] = [
  { name: "New Year", month: 1, day: 1 },
  { name: "Valentine's Day", month: 2, day: 14 },
  { name: "St Patrick's Day", month: 3, day: 17 },
  { name: "April Fools", month: 4, day: 1 },
  { name: "Halloween", month: 10, day: 31, span: 1 },
  { name: "Christmas", month: 12, day: 25, span: 1 },
  { name: "New Year's Eve", month: 12, day: 31 },
];

/** The fourth Thursday in November: the one holiday that moves. */
function thanksgiving(year: number): number {
  const first = new Date(year, 10, 1).getDay();
  return 1 + ((4 - first + 7) % 7) + 21;
}

/** The holiday this day is, if it is one. */
export function holidayOf(when = new Date()): string | null {
  const month = when.getMonth() + 1;
  const day = when.getDate();
  if (month === 11 && day === thanksgiving(when.getFullYear())) return "Thanksgiving";
  for (const h of HOLIDAYS) {
    if (h.month !== month) continue;
    if (day <= h.day && day >= h.day - (h.span ?? 0)) return h.name;
  }
  return null;
}

export type Deal = {
  /** what it costs right now */
  price: number;
  /** the list price, crossed out next to it */
  was: number;
  /** how much is off, as a percentage */
  off: number;
  /** true when this is the holiday half-price, not the rotation */
  holiday: boolean;
};

/** The month a moment falls in, as a key. The shelf is re-marked when this
 *  changes, which happens once, at midnight on the first. */
function monthKey(when: Date): string {
  return `${when.getFullYear()}-${when.getMonth() + 1}`;
}

/** A stable fraction for a seed. The same seed always rolls the same number,
 *  which is the whole reason the shelf holds still between renders. */
function roll(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100_000) / 100_000;
}

/** Prices read like prices: they land on a five. */
function onFive(n: number): number {
  return Math.round(n / 5) * 5;
}

/** What this piece is going for right now, or null when it is at its list
 *  price and there is nothing to cross out. */
export function dealOf(item: ShopItem, now = Date.now()): Deal | null {
  const when = new Date(now);
  const holiday = holidayOf(when);
  if (holiday) {
    return { price: onFive(item.price / 2), was: item.price, off: HOLIDAY_OFF, holiday: true };
  }
  if (item.noSale) return null;
  const month = monthKey(when);
  if (roll(`${item.id}:${month}`) >= SALE_CHANCE) return null;
  const step = Math.floor(roll(`${item.id}:${month}:off`) * SALE_STEPS.length) % SALE_STEPS.length;
  const off = SALE_STEPS[step];
  return { price: onFive(item.price * (1 - off / 100)), was: item.price, off, holiday: false };
}

/** What a piece costs right now: the deal if it has one, the list if not. */
export function priceNow(item: ShopItem, now = Date.now()): number {
  return dealOf(item, now)?.price ?? item.price;
}

/** Does this browser own the item? `owner` is the account that owns the site,
 *  which gets the whole shelf without paying for any of it. */
export function owns(id: string, owner = false): boolean {
  return owner || econ.get().owned.includes(id);
}

export function buy(id: string, now = Date.now()): { ok: boolean; reason?: string } {
  const item = itemOf(id);
  if (!item) return { ok: false, reason: "That item is not on the shelf." };
  const s = econ.get();
  if (s.owned.includes(id)) return { ok: false, reason: "You already own it." };
  /* The till charges what the tag says, which on a sale day is not the list.
     `now` comes from the page, so the price on the card and the price charged
     are the same reading of the clock even if the window turns over in
     between. */
  const cost = priceNow(item, now);
  if (s.coins < cost) return { ok: false, reason: "Not enough coins yet." };
  econ.set({
    coins: s.coins - cost,
    spent: s.spent + cost,
    owned: [...s.owned, id],
  });
  return { ok: true };
}

export function equip(shelf: Shelf, id: string | null) {
  const s = econ.get();
  if (shelf === "tag") {
    econ.set({ equipped: { ...s.equipped, tags: id ? [id] : [] } });
    return;
  }
  econ.set({ equipped: { ...s.equipped, [shelf]: id } });
}

/** Is this piece on right now? */
export function wearing(shelf: Shelf, id: string): boolean {
  const eq = econ.get().equipped;
  return shelf === "tag" ? eq.tags.includes(id) : eq[shelf] === id;
}

/** Put a piece on, or take it off. Tags are two at a time: a third tap drops
 *  the one that has been on the longest, so the shelf never refuses a click. */
export function toggleEquip(shelf: Shelf, id: string) {
  const s = econ.get();
  if (shelf === "tag") {
    const worn = s.equipped.tags;
    const tags = worn.includes(id) ? worn.filter((t) => t !== id) : [...worn, id].slice(-MAX_TAGS);
    econ.set({ equipped: { ...s.equipped, tags } });
    return;
  }
  const next = s.equipped[shelf] === id ? null : id;
  econ.set({ equipped: { ...s.equipped, [shelf]: next } });
}

export function giveCoins(n: number): number {
  const s = econ.get();
  econ.set({ coins: s.coins + n, earned: s.earned + n });
  return s.coins + n;
}

/* ---------- the clock ----------
   `tick` is called once a second by the shell. Everything about pausing
   lives here, so nothing else has to think about it. */
export function tick(): number {
  const s = econ.get();
  if (s.seconds >= (s.milestones + 1) * MILESTONE_SECONDS) {
    econ.set({
      seconds: s.seconds + 1,
      milestones: s.milestones + 1,
      coins: s.coins + MILESTONE_COINS,
      earned: s.earned + MILESTONE_COINS,
    });
    return MILESTONE_COINS;
  }
  /* three a minute: banked in whole coins so the number never shows a
     fraction, and so a reload cannot round in the visitor's favour */
  const before = Math.floor((s.seconds * COINS_PER_MINUTE) / 60);
  const seconds = s.seconds + 1;
  const after = Math.floor((seconds * COINS_PER_MINUTE) / 60);
  const gained = after - before;
  econ.set({
    seconds,
    coins: s.coins + gained,
    earned: s.earned + gained,
  });
  return gained;
}

export function trackPlay(id: string) {
  const s = econ.get();
  if (s.seen.includes(id)) {
    econ.set({ plays: s.plays + 1 });
    return;
  }
  econ.set({ plays: s.plays + 1, seen: [...s.seen, id] });
}

/** Seconds until the next milestone, for the shop's progress line. */
export function nextMilestone(seconds: number): number {
  const reached = Math.floor(seconds / MILESTONE_SECONDS) * MILESTONE_SECONDS;
  return reached + MILESTONE_SECONDS - seconds;
}

/* ---------- gifts ---------- */
function makeCode(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () =>
    Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
  return `NULL-${part()}-${part()}`;
}

export function mintCoinsGift(): { ok: boolean; code?: string; reason?: string } {
  const s = econ.get();
  if (s.coins < GIFT_COINS) {
    return { ok: false, reason: `You need ${GIFT_COINS} coins to give ${GIFT_COINS} away.` };
  }
  const code = makeCode();
  econ.set({
    coins: s.coins - GIFT_COINS,
    gifts: [...s.gifts, { code, gives: "coins", amount: GIFT_COINS, at: Date.now(), used: false }],
  });
  return { ok: true, code };
}

export function mintItemGift(id: string, owner = false): { ok: boolean; code?: string; reason?: string } {
  const item = itemOf(id);
  if (!item) return { ok: false, reason: "That item is not on the shelf." };
  const s = econ.get();
  if (!owner && !s.owned.includes(id)) return { ok: false, reason: "Buy it before you give it away." };
  const code = makeCode();
  econ.set({
    gifts: [...s.gifts, { code, gives: id, amount: 0, at: Date.now(), used: false }],
  });
  return { ok: true, code };
}

export function applyRedeemedGift(gives: string, amount: number): void {
  const s = econ.get();
  if (gives === "coins") econ.set({ coins: s.coins + amount, earned: s.earned + amount });
  else if (!s.owned.includes(gives)) econ.set({ owned: [...s.owned, gives] });
}

export function redeem(code: string): { ok: boolean; reason?: string } {
  const s = econ.get();
  const clean = code.trim().toUpperCase();
  const gift = s.gifts.find((g) => g.code === clean);
  if (!gift) return { ok: false, reason: "That code is not one of yours." };
  if (gift.used) return { ok: false, reason: "That code has already been used." };

  const gifts = s.gifts.map((g) => (g.code === clean ? { ...g, used: true } : g));
  if (gift.gives === "coins") {
    econ.set({ gifts, coins: s.coins + gift.amount, earned: s.earned + gift.amount });
    return { ok: true };
  }
  econ.set({ gifts, owned: s.owned.includes(gift.gives) ? s.owned : [...s.owned, gift.gives] });
  return { ok: true };
}

export function resetEcon() {
  econ.reset();
}
