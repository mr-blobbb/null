/* NULL · econ.ts
   Coins, and the shelf they buy from.

   Coins come from time on the site and nothing else: three a minute while
   the tab is visible and the visitor is moving, plus a thirty-coin milestone
   every fifteen minutes. Nothing accrues while the tab is hidden or while
   the keyboard and mouse have been still for a minute and a half, which is
   the whole of "should pause whilst the tab is idle".

   Everything below lives in localStorage. There is no server to lose it on. */

import { createStore, useStore } from "./store";

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
  price: number;
  /** the crossed-out price, so a number reads like a price, not a placeholder */
  was: number;
  /** name tags carry their own colour */
  color?: string;
  /** a tag with a dark fill writes its name in light ink instead */
  ink?: string;
  /** a small symbol before the name, for tags that want one */
  glyph?: string;
  /** a special finish for a tag, styled in shop.css */
  art?: "glow" | "stripe" | "split" | "mono";
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
    note: "A looping background for your whole card, behind everything it says.",
  },
  { id: "tag", name: "Name tags", note: "A chip that sits next to your name." },
];

export const SHOP: ShopItem[] = [
  /* avatar decorations */
  {
    id: "orbit",
    shelf: "avatar",
    name: "Orbit",
    desc: "A ring of light circling your picture.",
    price: 780,
    was: 920,
  },
  {
    id: "halo",
    shelf: "avatar",
    name: "Halo",
    desc: "A soft ring that never quite touches.",
    price: 960,
    was: 1140,
  },
  {
    id: "eclipse",
    shelf: "avatar",
    name: "Eclipse",
    desc: "A dark disc sliding across your edge.",
    price: 1040,
    was: 1240,
  },
  {
    id: "stardust",
    shelf: "avatar",
    name: "Stardust",
    desc: "Slow sparkles drifting off the frame.",
    price: 1180,
    was: 1400,
  },
  {
    id: "prism",
    shelf: "avatar",
    name: "Prism",
    desc: "A rotating band of colour round the rim.",
    price: 1240,
    was: 1460,
  },
  {
    id: "signal",
    shelf: "avatar",
    name: "Signal",
    desc: "Scanlines rolling up your picture.",
    price: 1320,
    was: 1560,
  },
  {
    id: "solar",
    shelf: "avatar",
    name: "Solar flare",
    desc: "A hot arc that laps you, once a loop.",
    price: 1480,
    was: 1720,
  },
  {
    id: "rift",
    shelf: "avatar",
    name: "Rift",
    desc: "Two rings spinning opposite ways.",
    price: 1600,
    was: 1880,
  },
  /* the two that are real footage: a light that runs round the rim, and
     violet fire that climbs the face. Both screen onto the picture, so the
     black they were shot on never shows. */
  {
    id: "chroma",
    shelf: "avatar",
    name: "Chroma",
    desc: "A soft light that circles your picture and never stops.",
    price: 1380,
    was: 1620,
  },
  {
    id: "ember",
    shelf: "avatar",
    name: "Ember",
    desc: "Violet fire, climbing the edge of your face.",
    price: 1540,
    was: 1780,
  },

  /* profile effects: whole-card backgrounds, looping and silent */
  {
    id: "rainy",
    shelf: "effect",
    name: "Pixel Art",
    desc: "A pixel image: rain and a cat.",
    price: 1180,
    was: 1400,
  },
  {
    id: "blocks",
    shelf: "effect",
    name: "Calm Forest",
    desc: "Minecraft landscape!",
    price: 1320,
    was: 1560,
  },
  {
    id: "hex",
    shelf: "effect",
    name: "Hexagon",
    desc: "Moving hexagons moving in and out of a plane.",
    price: 1080,
    was: 1280,
  },
  {
    id: "galaxy",
    shelf: "effect",
    name: "Galaxy",
    desc: "A ringed disk and a sky that never holds still.",
    price: 1520,
    was: 1780,
  },

  /* name tags */
  {
    id: "tstar",
    shelf: "tag",
    name: "STAR",
    desc: "effortlessly",
    price: 720,
    was: 880,
    color: "#f0c85a",
  },
  {
    id: "tcool",
    shelf: "tag",
    name: "COOL",
    desc: "effortlessly",
    price: 760,
    was: 900,
    color: "#6cc7ff",
  },
  {
    id: "ttuff",
    shelf: "tag",
    name: "TUFF",
    desc: "Certified tuff",
    price: 820,
    was: 980,
    color: "#e2686a",
  },
  {
    id: "tspecial",
    shelf: "tag",
    name: "SPECIAL",
    desc: "One of a kind",
    price: 900,
    was: 1080,
    color: "#c08bff",
  },
  {
    id: "taura",
    shelf: "tag",
    name: "AURA",
    desc: "+1000 aura",
    price: 960,
    was: 1140,
    color: "#58c98e",
  },
  {
    id: "tname",
    shelf: "tag",
    name: "NAME",
    desc: "It just says NAME",
    price: 720,
    was: 860,
    color: "#b9b9c0",
  },
  {
    id: "tlarp",
    shelf: "tag",
    name: "LARP",
    desc: "None of it was real",
    price: 1040,
    was: 1240,
    color: "#ff8a5c",
  },
  {
    id: "tgoat",
    shelf: "tag",
    name: "GOAT",
    desc: "Greatest of all time",
    price: 1600,
    was: 1880,
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
    was: 1120,
    color: "#ffe066",
  },
  {
    id: "tnpc",
    shelf: "tag",
    name: "NPC",
    desc: "Dialogue not included",
    price: 720,
    was: 860,
    color: "#a9a9b2",
  },
  {
    id: "tsigma",
    shelf: "tag",
    name: "SIGMA",
    desc: "Self-employed",
    price: 980,
    was: 1160,
    color: "#8fb8e8",
  },
  {
    id: "tmenace",
    shelf: "tag",
    name: "MENACE",
    desc: "A certified problem",
    price: 1120,
    was: 1340,
    color: "#ff5d5d",
    art: "stripe",
  },
  {
    id: "tdelulu",
    shelf: "tag",
    name: "DELULU",
    desc: "It is real to me",
    price: 880,
    was: 1060,
    color: "#f0a6c8",
  },
  {
    id: "thaunted",
    shelf: "tag",
    name: "HAUNTED",
    desc: "Presence noted",
    price: 1240,
    was: 1480,
    color: "#2b2b34",
    ink: "#e9e9f0",
    art: "glow",
  },
  {
    id: "tglitch",
    shelf: "tag",
    name: "GLITCH",
    desc: "Not a bug, a feature",
    price: 1360,
    was: 1580,
    color: "#5ce1c4",
    art: "split",
  },
  {
    id: "tchef",
    shelf: "tag",
    name: "CHEF",
    desc: "Let him cook",
    price: 860,
    was: 1020,
    color: "#ffb86b",
  },
  {
    id: "tpixel",
    shelf: "tag",
    name: "PIXEL",
    desc: "Drawn by hand",
    price: 900,
    was: 1080,
    color: "#9ae6a0",
    art: "mono",
  },
  {
    id: "tsleepy",
    shelf: "tag",
    name: "SLEEPY",
    desc: "Five more minutes",
    price: 780,
    was: 940,
    color: "#b6bede",
  },
];

export type Gift = {
  code: string;
  /** an item id, or the literal "coins" */
  gives: string;
  amount: number;
  at: number;
  used: boolean;
};

export type Econ = {
  coins: number;
  earned: number;
  spent: number;
  owned: string[];
  equipped: { avatar: string | null; effect: string | null; tag: string | null };
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
  equipped: { avatar: null, effect: null, tag: null },
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

export function itemOf(id: string | null | undefined): ShopItem | undefined {
  if (!id) return undefined;
  return SHOP.find((i) => i.id === id);
}

/** Does this browser own the item? `owner` is the account that owns the site,
 *  which gets the whole shelf without paying for any of it. */
export function owns(id: string, owner = false): boolean {
  return owner || econ.get().owned.includes(id);
}

export function buy(id: string): { ok: boolean; reason?: string } {
  const item = itemOf(id);
  if (!item) return { ok: false, reason: "That item is not on the shelf." };
  const s = econ.get();
  if (s.owned.includes(id)) return { ok: false, reason: "You already own it." };
  if (s.coins < item.price) return { ok: false, reason: "Not enough coins yet." };
  econ.set({
    coins: s.coins - item.price,
    spent: s.spent + item.price,
    owned: [...s.owned, id],
  });
  return { ok: true };
}

export function equip(shelf: Shelf, id: string | null) {
  const s = econ.get();
  econ.set({ equipped: { ...s.equipped, [shelf]: id } });
}

export function toggleEquip(shelf: Shelf, id: string) {
  const s = econ.get();
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
