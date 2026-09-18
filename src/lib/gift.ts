/* NULL · gift.ts
   Handing something to somebody else.

   Two halves that have to agree. The coins are in the browser — that is where
   the clock that pays them runs — so sending a gift takes them here and tells
   the server a gift is owed. The server is the part both machines can see, so
   the person on the other end finds it waiting whichever device they open.

   Settling is one-way and once: the row is marked the moment it is opened, and
   the local till is credited only when the server said the claim went through.
   A gift that was already opened cannot be opened twice by two tabs. */

import { cloud } from "./cloud";
import { api } from "../../convex/_generated/api";
import { econ, itemOf } from "./econ";

export type Gift = {
  id: string;
  from: string;
  to: string;
  /** an item id, or the literal "coins" */
  gives: string;
  amount: number;
  note: string;
  at: number;
  /** true when this one was sent by the person reading the thread */
  mine: boolean;
  /** on a trade: they said yes. On a gift: it was taken. */
  claimed: boolean;
  declined: boolean;
  /** what the sender asked for, or null on a plain gift */
  wants: string | null;
  wantAmount: number;
  /** the two halves of a swap, marked by the side that parted with it */
  gave: boolean;
  got: boolean;
};

/** Is this an offer rather than a present? */
export function isTrade(g: { wants: string | null }): boolean {
  return !!g.wants;
}

/** A trade is finished when both halves have been handed over. */
export function swapDone(g: Gift): boolean {
  return isTrade(g) && g.gave && g.got;
}

/** What still has to happen, in words, for whoever is reading the card. */
export function tradeState(g: Gift): "offered" | "theirs" | "mine" | "done" | "off" {
  if (!isTrade(g)) return "done";
  if (g.declined) return "off";
  if (!g.claimed) return "offered";
  if (g.gave && g.got) return "done";
  /* whose half is missing: mine, or theirs */
  const myHalf = g.mine ? g.gave : g.got;
  return myHalf ? "theirs" : "mine";
}

export function clean(user: string): string {
  return user.trim().replace(/^@/, "").toLowerCase();
}

/** What a gift is worth in one line, for the card and for a notification. */
export function describeGift(g: { gives: string; amount: number }): string {
  if (g.gives === "coins") {
    return `${g.amount.toLocaleString()} coins`;
  }
  const item = itemOf(g.gives);
  return item ? item.name : "a piece off the shelf";
}

/** Hand it over. The coins are taken first — if the server refuses, they go
 *  back, so a failed send never quietly costs somebody their purse.
 *
 *  A trade is the same call with something asked for in return, and it takes
 *  nothing up front: neither side pays until the other has said yes. */
export async function sendGift(opts: {
  by: string;
  to: string;
  gives: string;
  amount: number;
  note?: string;
  /** an item id or "coins", when this is a trade rather than a gift */
  wants?: string;
  wantAmount?: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const from = clean(opts.by);
  const to = clean(opts.to);
  if (!from) return { ok: false, reason: "Sign in to send a gift." };
  if (!to) return { ok: false, reason: "Pick somebody to send it to." };
  if (from === to) return { ok: false, reason: "You cannot send yourself a gift." };

  const c = cloud();
  if (!c) return { ok: false, reason: "The shared side is offline, so a gift would go nowhere." };

  const trading = opts.wants !== undefined;
  const s = econ.get();
  const coins = opts.gives === "coins" ? Math.floor(opts.amount) : 0;
  if (opts.gives === "coins") {
    if (coins <= 0) return { ok: false, reason: "A gift of no coins is not a gift." };
    if (s.coins < coins) return { ok: false, reason: `You only have ${s.coins.toLocaleString()} coins.` };
    /* a trade is paid on acceptance, not now: an offer that is refused should
       never have cost anybody their purse */
    if (!trading) econ.set({ coins: s.coins - coins, spent: s.spent + coins });
  } else if (!s.owned.includes(opts.gives)) {
    return { ok: false, reason: "Buy it before you give it away." };
  }

  try {
    await c.mutation(api.social.sendGift, {
      by: from,
      to,
      gives: opts.gives,
      amount: coins,
      note: opts.note?.slice(0, 240) ?? "",
      wants: trading ? opts.wants : undefined,
      wantAmount: trading ? Math.floor(opts.wantAmount ?? 0) : undefined,
    });
    return { ok: true };
  } catch (e) {
    if (coins && !trading) {
      econ.set({ coins: econ.get().coins + coins, spent: Math.max(0, econ.get().spent - coins) });
    }
    return { ok: false, reason: (e as Error).message.replace(/^.*?Error: /, "") };
  }
}

/* ---------- trades ----------
   Two halves, and each browser only ever moves its own. What this side gives
   up, it takes out of its own shelf the moment it says it has; what the other
   side gives up, it adds the moment the server says they have. Doing it in
   that order is what makes a trade impossible to fumble: nothing arrives here
   before they have let go of it, and nothing leaves here until they have. */

/** Can this side part with `what`? Checked before anything is written, so a
 *  half that cannot be paid is refused rather than half-done. */
function canPart(what: string, amount: number): string | null {
  const s = econ.get();
  if (what === "coins") {
    if (s.coins < amount) return `You have ${s.coins.toLocaleString()} coins, not ${amount.toLocaleString()}.`;
    return null;
  }
  if (!s.owned.includes(what)) return `You no longer have ${describeGift({ gives: what, amount: 0 })}.`;
  return null;
}

/** Take `what` out of this browser's shelf. */
function partWith(what: string, amount: number) {
  const s = econ.get();
  if (what === "coins") econ.set({ coins: s.coins - amount, spent: s.spent + amount });
  else econ.set({ owned: s.owned.filter((id) => id !== what) });
}

/** Put `what` into this browser's shelf. */
function receive(what: string, amount: number) {
  const s = econ.get();
  if (what === "coins") econ.set({ coins: s.coins + amount, earned: s.earned + amount });
  else if (!s.owned.includes(what)) econ.set({ owned: [...s.owned, what] });
}

/** Say yes to an offer. Nothing changes hands yet. */
export async function acceptTrade(me: string, gift: Gift): Promise<{ ok: boolean; reason?: string }> {
  const c = cloud();
  if (!c) return { ok: false, reason: "The shared side is offline." };
  try {
    await c.mutation(api.social.acceptTrade, { me: clean(me), id: gift.id as never });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message.replace(/^.*?Error: /, "") };
  }
}

/** Hand this side's half over, and take the other side's in return. */
export async function handOver(me: string, gift: Gift): Promise<{ ok: boolean; reason?: string }> {
  const c = cloud();
  if (!c) return { ok: false, reason: "The shared side is offline." };
  const side = gift.mine ? "from" : "to";
  /* what this side gives up, and what it gets: the sender's half is `gives`,
     the receiver's is `wants`, and each of them reads the other's as income */
  const out = gift.mine ? { gives: gift.gives, amount: gift.amount } : { gives: gift.wants as string, amount: gift.wantAmount };
  const income = gift.mine ? { gives: gift.wants as string, amount: gift.wantAmount } : { gives: gift.gives, amount: gift.amount };

  const cannot = canPart(out.gives, out.amount);
  if (cannot) {
    /* tell the server the whole thing is off, so the other side stops
       waiting rather than standing there with their half in their hand */
    await c
      .mutation(api.social.handOver, { me: clean(me), id: gift.id as never, side, ok: false })
      .catch(() => undefined);
    return { ok: false, reason: cannot };
  }

  try {
    await c.mutation(api.social.handOver, { me: clean(me), id: gift.id as never, side, ok: true });
  } catch (e) {
    return { ok: false, reason: (e as Error).message.replace(/^.*?Error: /, "") };
  }
  partWith(out.gives, out.amount);
  receive(income.gives, income.amount);
  return { ok: true };
}

/** Every trade of mine that is waiting on my half. The shell runs these when
 *  the page opens, so an offer accepted while you were away is settled the
 *  next time you are here rather than never. */
export function myHalfPending(me: string, rows: Gift[] | undefined): Gift[] {
  const who = clean(me);
  return (rows ?? []).filter((g) => {
    if (!isTrade(g) || g.declined || !g.claimed) return false;
    if (g.gave && g.got) return false;
    const myHalf = g.from === who ? g.gave : g.got;
    return !myHalf;
  });
}

/** Open it. The row is settled on the server first; only then does this
 *  machine actually get the coins or the piece. */
export async function takeGift(
  me: string,
  gift: Gift,
): Promise<{ ok: boolean; reason?: string }> {
  const who = clean(me);
  const c = cloud();
  if (!c) return { ok: false, reason: "The shared side is offline." };
  if (gift.mine) return { ok: false, reason: "That one is yours already." };

  try {
    await c.mutation(api.social.settleGift, { me: who, id: gift.id as never, take: true });
  } catch (e) {
    return { ok: false, reason: (e as Error).message.replace(/^.*?Error: /, "") };
  }

  const s = econ.get();
  if (gift.gives === "coins") {
    econ.set({ coins: s.coins + gift.amount, earned: s.earned + gift.amount });
  } else if (!s.owned.includes(gift.gives)) {
    econ.set({ owned: [...s.owned, gift.gives] });
  }
  return { ok: true };
}

/** Take one back, while it is still shut. The coins go back into this
 *  browser's purse, since they were taken out of it. */
export async function unsendGift(me: string, gift: Gift): Promise<{ ok: boolean; reason?: string }> {
  const c = cloud();
  if (!c) return { ok: false, reason: "The shared side is offline." };
  try {
    await c.mutation(api.social.unsendGift, { by: clean(me), id: gift.id as never });
  } catch (e) {
    return { ok: false, reason: (e as Error).message.replace(/^.*?Error: /, "") };
  }
  if (gift.gives === "coins") {
    const s = econ.get();
    econ.set({ coins: s.coins + gift.amount, spent: Math.max(0, s.spent - gift.amount) });
  }
  return { ok: true };
}

/** Wave it away. Nothing changes hands, and the sender sees that it was
 *  refused rather than left hanging. */
export async function declineGift(me: string, gift: Gift): Promise<{ ok: boolean; reason?: string }> {
  const c = cloud();
  if (!c) return { ok: false, reason: "The shared side is offline." };
  try {
    await c.mutation(api.social.settleGift, { me: clean(me), id: gift.id as never, take: false });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message.replace(/^.*?Error: /, "") };
  }
}

/** What a gift is to the person it arrived for: still to be opened, and not
 *  waved away. The badge count, the pop-up and the rail all ask this. */
export function pending(gifts: Gift[] | undefined): Gift[] {
  return (gifts ?? []).filter((g) => !g.mine && !g.claimed && !g.declined);
}

/** Was this gift put in front of somebody already? The pop-up shows itself
 *  once per gift per tab rather than every time a thread is reopened. */
const seen = new Set<string>();

export function freshPending(gifts: Gift[] | undefined): Gift | null {
  const first = pending(gifts).find((g) => !seen.has(g.id));
  return first ?? null;
}

export function markSeen(id: string) {
  seen.add(id);
}
