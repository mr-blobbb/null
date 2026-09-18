/* NULL · GiftBox.tsx
   Handing something to somebody, and swapping with them.

   A gift has one half: the sender pays when they press send, the receiver
   takes it when they open it. A trade has two, and neither side pays until
   the other has said yes — then each half is handed over by the person who
   owes it, and each side only ever moves its own shelf. That is the whole
   reason a trade can be trusted here: the coins are in the browsers, so the
   browser that promised something is the one that lets go of it.

   Three components and one watcher. `GiftButton` sits on a profile card and
   opens the composer, which is a gift or a trade depending on whether anything
   is asked for in return. `GiftCard` draws one exchange in the thread it
   happened in. `GiftPop` puts an unopened one in front of the person it
   arrived for. `useTradeSettle` is the shell's: an offer accepted while you
   were away is settled the next time you are here, and not before. */

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Gift as GiftIcon, HandCoins, Package, Send, X } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { Sheet } from "./Sheet";
import { SHOP, useEcon, type ShopItem } from "../lib/econ";
import {
  acceptTrade,
  clean,
  declineGift,
  describeGift,
  handOver,
  isTrade,
  myHalfPending,
  sendGift,
  takeGift,
  tradeState,
  unsendGift,
  type Gift as GiftRow,
} from "../lib/gift";

function shelfName(id: string): string {
  const item = SHOP.find((i) => i.id === id);
  return item ? item.name : id;
}

/* ---------- sending ---------- */

export function GiftButton({
  user,
  me,
  className = "btn btn--sm",
  label = "Gift",
}: {
  /** who it is going to, with or without the @ */
  user: string;
  /** the sender's handle, or null when signed out */
  me: string | null;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [trading, setTrading] = useState(false);
  const [which, setWhich] = useState<string>("coins");
  const [coins, setCoins] = useState(100);
  const [wants, setWants] = useState<string>("coins");
  const [wantCoins, setWantCoins] = useState(500);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const s = useEcon();

  if (!me || clean(me) === clean(user)) return null;

  const mine = s.owned.map((id) => SHOP.find((i) => i.id === id)).filter((i): i is ShopItem => !!i);
  /* what you may ask for is the shelf, not your own bag: you are asking for
     something you do not have */
  const askable = SHOP.filter((i) => i.id !== which);

  const send = async () => {
    setBusy(true);
    setErr(null);
    const out = await sendGift({
      by: me,
      to: user,
      gives: which,
      amount: coins,
      note,
      wants: trading ? wants : undefined,
      wantAmount: trading && wants === "coins" ? wantCoins : 0,
    });
    setBusy(false);
    if (!out.ok) {
      setErr(out.reason ?? "That did not go through.");
      return;
    }
    setNote("");
    setOpen(false);
  };

  return (
    <>
      <button className={className} onClick={() => setOpen(true)} title={`Send @${clean(user)} a gift`}>
        <GiftIcon /> {label}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        width={480}
        title={trading ? `Trade with @${clean(user)}` : `Gift to @${clean(user)}`}
        icon={trading ? <ArrowLeftRight /> : <GiftIcon />}
      >
        <div className="gf-mode">
          <button className={`gf-tab${trading ? "" : " is-on"}`} onClick={() => setTrading(false)}>
            <GiftIcon /> Gift
          </button>
          <button className={`gf-tab${trading ? " is-on" : ""}`} onClick={() => setTrading(true)}>
            <ArrowLeftRight /> Trade
          </button>
        </div>

        <p className="gf-say">
          {trading
            ? "A trade waits for them to say yes, and then each of you hands over your own half. Nobody pays for an offer that gets refused."
            : "Whatever you send is theirs the moment they open it in their messages. Coins come out of your purse now; an item stays on your shelf as well."}
        </p>

        <span className="gf-label tiny faint">{trading ? "You give" : "You send"}</span>
        <div className="gf-picks">
          <button className={`gf-pick${which === "coins" ? " is-on" : ""}`} onClick={() => setWhich("coins")}>
            <HandCoins />
            <b>Coins</b>
            <i className="tiny faint">You hold {s.coins.toLocaleString()}</i>
          </button>

          {mine.map((i) => (
            <button
              key={i.id}
              className={`gf-pick${which === i.id ? " is-on" : ""}`}
              onClick={() => setWhich(i.id)}
            >
              <Package />
              <b>{i.name}</b>
              <i className="tiny faint">{shelfNote(i)}</i>
            </button>
          ))}
        </div>

        {which === "coins" && (
          <div className="gf-amount">
            <label className="form-row">
              <span>How many</span>
              <input
                className="fld"
                type="number"
                min={1}
                max={100000}
                value={coins}
                onChange={(e) => setCoins(Math.max(1, Math.min(100000, Number(e.target.value) || 0)))}
              />
            </label>
            <div className="gf-quick">
              {[50, 100, 500, 1000].map((n) => (
                <button key={n} className="btn btn--sm" onClick={() => setCoins(n)}>
                  {n.toLocaleString()}
                </button>
              ))}
              <button className="btn btn--sm" onClick={() => setCoins(Math.floor(s.coins / 10) || 1)}>
                a tenth
              </button>
            </div>
          </div>
        )}

        {trading && (
          <>
            <span className="gf-label tiny faint">You want</span>
            <div className="gf-picks">
              <button className={`gf-pick${wants === "coins" ? " is-on" : ""}`} onClick={() => setWants("coins")}>
                <HandCoins />
                <b>Coins</b>
              </button>
              {askable.map((i) => (
                <button
                  key={i.id}
                  className={`gf-pick${wants === i.id ? " is-on" : ""}`}
                  onClick={() => setWants(i.id)}
                >
                  <Package />
                  <b>{i.name}</b>
                  <i className="tiny faint">{shelfNote(i)}</i>
                </button>
              ))}
            </div>
            {wants === "coins" && (
              <div className="gf-amount">
                <label className="form-row">
                  <span>How many</span>
                  <input
                    className="fld"
                    type="number"
                    min={1}
                    max={100000}
                    value={wantCoins}
                    onChange={(e) => setWantCoins(Math.max(1, Math.min(100000, Number(e.target.value) || 0)))}
                  />
                </label>
              </div>
            )}
          </>
        )}

        <label className="form-row">
          <span>Note (optional)</span>
          <input
            className="fld"
            value={note}
            maxLength={240}
            placeholder={trading ? "fair deal" : "because you asked for it"}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {err && <p className="form-err tiny">{err}</p>}

        <div className="gf-foot">
          <button className="btn" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--go" onClick={() => void send()} disabled={busy}>
            <Send /> {busy ? "Sending…" : trading ? "Offer the trade" : "Send gift"}
          </button>
        </div>
      </Sheet>
    </>
  );
}

function shelfNote(i: ShopItem): string {
  return i.shelf === "tag" ? "name tag" : i.shelf === "effect" ? "profile effect" : "avatar decoration";
}

/* ---------- the exchange, drawn ---------- */

export function GiftCard({ gift, me, compact = false }: { gift: GiftRow; me: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trade = isTrade(gift);
  const state = trade ? tradeState(gift) : "done";
  const waiting = !gift.mine && !gift.claimed && !gift.declined;

  const run = async (work: () => Promise<{ ok: boolean; reason?: string }>) => {
    setBusy(true);
    const out = await work();
    setBusy(false);
    if (!out.ok) setErr(out.reason ?? "That did not go through.");
  };

  return (
    <div className={`gf-card${waiting ? " is-waiting" : ""}${compact ? " gf-card--flat" : ""}`}>
      <span className="gf-icon">{trade ? <ArrowLeftRight /> : <GiftIcon />}</span>
      <div className="gf-body">
        <b className="gf-what">
          {trade ? (
            <>
              {describeGift(gift)} <i className="gf-for">for</i> {describeGift({ gives: gift.wants as string, amount: gift.wantAmount })}
            </>
          ) : (
            describeGift(gift)
          )}
        </b>
        <span className="gf-who tiny faint">
          {gift.mine ? `to @${gift.to}` : `from @${gift.from}`} ·{" "}
          {new Date(gift.at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        {gift.note && <p className="gf-note">{gift.note}</p>}
        {err && <p className="form-err tiny">{err}</p>}

        {trade ? (
          <TradeWords gift={gift} state={state} />
        ) : (
          <>
            {gift.mine && !gift.claimed && !gift.declined && (
              <span className="gf-state tiny faint">
                waiting for @{gift.to} to open it
                <button className="linkish" disabled={busy} onClick={() => void run(() => unsendGift(me, gift))}>
                  take it back
                </button>
              </span>
            )}
            {gift.mine && gift.claimed && <span className="gf-state tiny faint">opened</span>}
            {gift.mine && gift.declined && <span className="gf-state tiny faint">they waved it away</span>}
            {!gift.mine && gift.claimed && <span className="gf-state tiny faint">yours — opened</span>}
            {!gift.mine && gift.declined && <span className="gf-state tiny faint">waved away</span>}
          </>
        )}
      </div>

      <div className="gf-take">
        {waiting && (
          <>
            <button
              className="btn btn--sm btn--go"
              disabled={busy}
              onClick={() => void run(() => (trade ? acceptTrade(me, gift) : takeGift(me, gift)))}
            >
              {trade ? "Accept" : "Open"}
            </button>
            <button className="btn btn--sm" disabled={busy} onClick={() => void run(() => declineGift(me, gift))} title="No thanks">
              <X />
            </button>
          </>
        )}

        {/* a trade that has been accepted, with this side's half still owed.
            The receiver's button waits for the sender's half to land first */}
        {trade && state === "mine" && (gift.mine || gift.gave) && (
          <button className="btn btn--sm btn--go" disabled={busy} onClick={() => void run(() => handOver(me, gift))}>
            Hand over
          </button>
        )}

        {/* and one that is only waiting on them */}
        {trade && state === "theirs" && <span className="gf-state tiny faint">waiting on them</span>}

        {trade && gift.mine && state === "offered" && (
          <button className="btn btn--sm" disabled={busy} onClick={() => void run(() => unsendGift(me, gift))}>
            Take back
          </button>
        )}
      </div>
    </div>
  );
}

/** What a trade is waiting on, in one line, for whichever side is reading.
 *
 *  The sender moves first — they made the offer, and the receiver is not asked
 *  to let go of anything on the promise of a half that has not been handed
 *  over — so "your half is next" only ever appears for the sender. */
function TradeWords({ gift, state }: { gift: GiftRow; state: ReturnType<typeof tradeState> }) {
  const with_ = gift.mine ? gift.to : gift.from;
  /** what this side owes: the sender's half, or the half that was asked for */
  const mine = gift.mine
    ? { gives: gift.gives, amount: gift.amount }
    : { gives: gift.wants as string, amount: gift.wantAmount };

  if (state === "offered") {
    return (
      <span className="gf-state tiny faint">
        {gift.mine ? `waiting for @${with_} to say yes` : "an offer — accept and you both hand over"}
      </span>
    );
  }
  if (state === "off") {
    return <span className="gf-state tiny faint">called off — nothing changed hands</span>;
  }
  if (state === "done") {
    return (
      <span className="gf-state tiny faint">
        swapped · with @{with_}
      </span>
    );
  }
  if (state === "theirs") {
    return (
      <span className="gf-state tiny faint">
        you have handed yours over · waiting on @{with_}
      </span>
    );
  }
  /* the sender hands over next; the receiver waits to be told it has landed */
  if (gift.mine) {
    return (
      <span className="gf-state tiny faint">
        accepted — your half is next: {describeGift(mine)}
      </span>
    );
  }
  return (
    <span className="gf-state tiny faint">
      accepted — they hand theirs over first, then yours goes out
    </span>
  );
}

/* ---------- what is waiting on you ---------- */

/** The little pop-up from the gifter to the giftee: it names both of them, and
 *  taking it is the same click as taking it in the thread. A trade is offered
 *  the same way, and accepting it there is the same as accepting it here. */
export function GiftPop({
  gift,
  me,
  other,
  onClose,
}: {
  gift: GiftRow;
  me: string;
  /** whose thread this is, so the card can say "sent in your messages with" */
  other: string;
  onClose: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const trade = isTrade(gift);

  const run = async (work: () => Promise<{ ok: boolean; reason?: string }>) => {
    setBusy(true);
    const out = await work();
    setBusy(false);
    if (!out.ok) {
      setErr(out.reason ?? "That did not go through.");
      return;
    }
    setDone(true);
    window.setTimeout(onClose, 1100);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      width={440}
      title={trade ? "A trade offer" : "A gift arrived"}
      icon={trade ? <ArrowLeftRight /> : <GiftIcon />}
    >
      <div className="gf-pop">
        <span className="gf-pop-from tiny faint">
          @{gift.from} {trade ? "offers" : "sent you"}
        </span>
        <b className="gf-pop-what">
          {describeGift(gift)}
          {trade && <> <i className="gf-for">for</i> {describeGift({ gives: gift.wants as string, amount: gift.wantAmount })}</>}
        </b>
        {gift.note && <p className="gf-note">{gift.note}</p>}
        <span className="gf-state tiny faint">in your messages with @{clean(other)}</span>
        {err && <p className="form-err tiny">{err}</p>}
        <div className="gf-foot">
          <button className="btn" onClick={onClose} disabled={busy}>
            {trade ? "Think about it" : "Later"}
          </button>
          <button className="btn btn--go" disabled={busy || done} onClick={() => void run(() => (trade ? acceptTrade(me, gift) : takeGift(me, gift)))}>
            {done ? (trade ? "Accepted" : "Added") : busy ? "…" : trade ? "Accept the trade" : "Take it"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** The list, live. A gift sent while the page is open arrives on its own — the
 *  same subscription shape the chat uses. */
export function useGiftRows(me: string | null): GiftRow[] | undefined {
  const handle = me ? clean(me) : "";
  const rows = useQuery(api.social.giftsFor, handle ? { me: handle } : "skip");
  return rows as GiftRow[] | undefined;
}

/** The shell's half of a trade: if a half of a swap is owed by this browser —
 *  because the offer was accepted while you were away, or while you were on
 *  another page — it is handed over the moment this side can see that the
 *  other side is ready for it. Nothing here pays out on an offer the other
 *  side has not moved on. */
export function useTradeSettle(me: string | null) {
  const rows = useGiftRows(me);
  const tried = useRef(new Set<string>());

  useEffect(() => {
    if (!me) return;
    for (const g of myHalfPending(me, rows)) {
      if (tried.current.has(g.id)) continue;
      /* the receiver only hands over once the sender's half has landed */
      if (!g.mine && !g.gave) continue;
      tried.current.add(g.id);
      void handOver(me, g);
    }
  }, [rows, me]);
}


