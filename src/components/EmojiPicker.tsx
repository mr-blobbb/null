/* NULL · EmojiPicker.tsx
   The whole pad: recent, then a tab per group, then the custom packs, then a
   search box for the case where somebody knows the name and not the shelf.

   It is one component because three places wanted the same thing — the
   composer's smiley button, the "and anything else" button on a reaction,
   and the pad in a DM — and they had better agree about what an emoji is.
   The caller decides what a pick means; this only hands back a glyph or a
   `:name:` token. The `plain` prop trims the custom packs off for the one
   caller that cannot wear them (a reaction stores a character, not a token). */

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { GROUPS, nameOf, noteEmoji, suggest, useRecentEmoji } from "../lib/emoji";
import { CUSTOM, packName, STICKERS } from "../lib/packs";

export function EmojiPicker({ onPick, plain = false }: { onPick: (emoji: string) => void; plain?: boolean }) {
  const recent = useRecentEmoji();
  const [q, setQ] = useState("");
  /* opens on what was used last, because that is nearly always the answer */
  const [tab, setTab] = useState("recent");

  const found = useMemo(() => (q.trim() ? suggest(q, 64).map((s) => s.e) : null), [q]);
  const active = GROUPS.find((g) => g.id === tab);
  const raw = found ?? (tab === "recent" ? recent : (active?.list ?? []));
  const list = [...new Set(raw)];

  const pick = (e: string) => {
    noteEmoji(e);
    onPick(e);
  };

  const tabs: { id: string; glyph: string; title: string }[] = [
    { id: "recent", glyph: "🕘", title: "Recently used" },
    ...GROUPS.map((g) => ({ id: g.id, glyph: g.glyph, title: g.name })),
    ...(plain
      ? []
      : [
          { id: "packs", glyph: "🗂️", title: "Custom emoji — the same picture on every screen" },
          { id: "stickers", glyph: "🖼️", title: "Stickers" },
        ]),
  ];

  /* what a pick leaves in the box: the token that renders as the picture,
     or the character itself when it has no name */
  const packPick = (char: string) => pick(packName(char) ? `:${packName(char)}:` : char);
  const stickerPick = (name: string) => pick(`:st-${name}:`);

  return (
    <div className="emopick">
      <label className="emopick-find">
        <Search />
        <input
          value={q}
          spellCheck={false}
          autoComplete="off"
          placeholder="Search emoji — fire, sob, thumbsup…"
          aria-label="Search emoji"
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button className="emopick-x" onClick={() => setQ("")} aria-label="Clear search">
            <X />
          </button>
        )}
      </label>

      <div className="emopick-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`emopick-tab${tab === t.id && !found ? " is-on" : ""}`}
            title={t.title}
            onClick={() => {
              setQ("");
              setTab(t.id);
            }}
          >
            {t.glyph}
          </button>
        ))}
      </div>

      {tab === "packs" && !found ? (
        <div className="emopick-body">
          {CUSTOM.map((e, i) => (
            <button
              key={`${e}-${i}`}
              className="ch-emojibtn"
              title={packName(e) ? `:${packName(e)}:` : undefined}
              onClick={() => packPick(e)}
            >
              {e}
            </button>
          ))}
        </div>
      ) : tab === "stickers" && !found ? (
        <div className="emopick-body emopick-body--stickers">
          {STICKERS.map((s) => (
            <button key={s.id} className="emopick-sticker" title={`:st-${s.name}:`} onClick={() => stickerPick(s.name)}>
              <img src={s.url} alt={s.name} loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="emopick-none tiny faint">
          {found
            ? `Nothing is named “${q.trim()}”.`
            : "Nothing here yet — pick one and it will wait here next time."}
        </p>
      ) : (
        <div className="emopick-body">
          {list.map((e, i) => (
            <button
              key={`${e}-${i}`}
              className="ch-emojibtn"
              title={nameOf(e) ? `:${nameOf(e)}:` : undefined}
              onClick={() => pick(e)}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
