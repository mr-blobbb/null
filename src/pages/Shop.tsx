/* NULL · Shop.tsx
   Three shelves, priced in coins earned by being here. A card shows the
   thing moving, what it is, what it costs, what it used to cost, and two
   buttons: gift it, or lock it in.

   Coins: three a minute while the tab is open and you are moving, plus thirty
   every fifteen minutes. The rate is in src/lib/econ.ts. */

import { useState } from "react";
import {
  Check,
  Coins,
  Gift,
  Lock,
  LockOpen,
  Sparkles,
  Star,
  Tag,
} from "lucide-react";

import { PreviewArt } from "../lib/art";
import {
  buy,
  mintCoinsGift,
  mintItemGift,
  owns,
  redeem,
  SHOP,
  SHELVES,
  toggleEquip,
  useEcon,
  type ShopItem,
} from "../lib/econ";
import { isOwner } from "../lib/owner";
import { Sheet } from "../components/Sheet";
import { useAccount } from "../lib/account";

const SHELF_ICON = { avatar: Sparkles, effect: Star, tag: Tag } as const;

export function Shop({ onOpenSettings }: { onOpenSettings: () => void }) {
  const me = useEcon();
  const account = useAccount();
  /* the account that owns the site takes the whole shelf, on the house */
  const owner = isOwner(account.user);
  const [gift, setGift] = useState<{ code: string; what: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const say = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(null), 2600);
  };

  return (
    <div className="page">
      <div className="sh-head">
        <div>
          <h1 className="lb-title">Shop</h1>
          <p className="lede">
            Earn coins by playing, hitting achievements, and hanging around. Spend them on
            the fun stuff.
          </p>
        </div>
        <div className="sh-wallet">
          <span className="wallet-box" title="Your coins">
            <Coins />
            <b>{me.coins.toLocaleString()}</b>
            <em>coins</em>
          </span>
          <button
            className="wallet-box wallet-box--btn"
            onClick={() => {
              const r = mintCoinsGift();
              if (!r.ok) return say(r.reason ?? "Could not make a code.");
              setGift({ code: r.code as string, what: "100 coins" });
            }}
          >
            <Gift />
            <b>Gift coins</b>
          </button>
        </div>
      </div>

      <p className="sh-meter tiny faint">
        +3 coins a minute while you are here · next bonus in{" "}
        {Math.max(0, 15 - Math.floor((me.seconds % 900) / 60))} min · {me.plays} launches so far
      </p>

      {owner && <p className="sh-owner tiny">Owner · everything on the shelf is already yours.</p>}

      {SHELVES.map((shelf) => {
        const Icon = SHELF_ICON[shelf.id];
        const items = SHOP.filter((i) => i.shelf === shelf.id);
        return (
          <section className="sh-shelf" key={shelf.id}>
            <header className="sh-shelf-head">
              <Icon />
              <h2>{shelf.name}</h2>
              <span className="sh-shelf-note faint tiny">{shelf.note}</span>
            </header>
            <div className="sh-grid">
              {items.map((item) => (
                <Card
                  key={item.id}
                  item={item}
                  owned={owns(item.id, owner)}
                  on={me.equipped[shelf.id] === item.id}
                  coins={me.coins}
                  onBuy={() => {
                    const r = buy(item.id);
                    if (!r.ok) return say(r.reason ?? "No.");
                    say(`${item.name} is yours.`);
                  }}
                  onEquip={() => toggleEquip(shelf.id, item.id)}
                  onGift={() => {
                    const r = mintItemGift(item.id, owner);

                    if (!r.ok) return say(r.reason ?? "Could not make a code.");
                    setGift({ code: r.code as string, what: item.name });
                  }}
                />
              ))}
            </div>
          </section>
        );
      })}

      <div className="sh-foot card card--pad">
        <h3 className="set-h">Gift codes</h3>
        <p className="set-note">
          A gift code works once, for whoever you send it to. Redeem one here, or share the
          code you just made. Codes live in this browser, like everything else.
        </p>
        <Redeem onDone={(msg) => say(msg)} />
        <p className="tiny faint">
          Wearing something? Your tag, decoration and effect show on your card in the
          Profile page.
        </p>
      </div>

      <Sheet open={!!gift} onClose={() => setGift(null)} title="Your gift code" width={420}>
        <div className="gift">
          <p className="muted">
            Send this to a friend. It gives <b>{gift?.what}</b> and only works once.
          </p>
          <div className="gift-code mono">{gift?.code}</div>
          <button
            className="btn btn--fill"
            onClick={() => {
              navigator.clipboard?.writeText(gift?.code ?? "");
              say("Copied.");
            }}
          >
            Copy code
          </button>
        </div>
      </Sheet>

      {note && <div className="toast">{note}</div>}
      {account.user === null && (
        <p className="tiny faint">
          Tip: your decorations live on your profile card, and a profile is one{" "}
          <button className="linkish" onClick={onOpenSettings}>
            palette change
          </button>{" "}
          away from looking good.
        </p>
      )}
    </div>
  );
}

function Card({
  item,
  owned,
  on,
  coins,
  onBuy,
  onEquip,
  onGift,
}: {
  item: ShopItem;
  owned: boolean;
  on: boolean;
  coins: number;
  onBuy: () => void;
  onEquip: () => void;
  onGift: () => void;
}) {
  const afford = coins >= item.price;
  return (
    <article className={`shop-card${owned ? " is-owned" : ""}${on ? " is-on" : ""}`}>
      <div className="shop-art">
        <PreviewArt item={item} />
      </div>
      <h3 className="shop-name">{item.name}</h3>
      <p className="shop-desc">{item.desc}</p>
      <div className="shop-price">
        <Coins />
        <b>{item.price.toLocaleString()}</b>
        <s>{item.was.toLocaleString()}</s>
      </div>
      <div className="shop-actions">
        {/* an unlocked item may be passed on, which is how the owner can
            hand out something nobody paid for */}
        <button className="btn btn--sm btn--icon" onClick={onGift} disabled={!owned} title="Gift this">
          <Gift />
        </button>
        {owned ? (
          <button className={`btn btn--sm${on ? " btn--fill" : ""}`} onClick={onEquip}>
            {on ? <Check /> : <LockOpen />}
            {on ? "Wearing" : "Unlocked"}
          </button>
        ) : (
          <button className="btn btn--sm" onClick={onBuy} disabled={!afford} title={afford ? "Buy" : "Not enough coins"}>
            <Lock />
            Locked
          </button>
        )}
      </div>
    </article>
  );
}

function Redeem({ onDone }: { onDone: (msg: string) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="gift-redeem">
      <input
        className="fld mono"
        value={code}
        placeholder="NULL-XXXX-XXXX"
        spellCheck={false}
        onChange={(e) => {
          setCode(e.target.value.toUpperCase());
          setError(null);
        }}
      />
      <button
        className="btn"
        onClick={() => {
          const r = redeem(code);
          if (!r.ok) {
            setError(r.reason ?? "That did not work.");
            return;
          }
          setCode("");
          onDone("Redeemed.");
        }}
      >
        Redeem
      </button>
      {error && <span className="form-err">{error}</span>}
    </div>
  );
}
