/* NULL · EmojiPicker.tsx
   The whole pad: recent, then a tab per group, then a search box for the case
   where somebody knows the name and not the shelf.

   It is one component because two places wanted the same thing — the
   composer's smiley button and the "and anything else" button on a reaction —
   and they had better agree about what an emoji is. The caller decides what a
   pick means; this only hands back a glyph. */

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { GROUPS, nameOf, noteEmoji, suggest, useRecentEmoji } from "../lib/emoji";

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
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
        <button
          className={`emopick-tab${tab === "recent" && !found ? " is-on" : ""}`}
          title="Recently used"
          onClick={() => {
            setQ("");
            setTab("recent");
          }}
        >
          🕘
        </button>
        {GROUPS.map((g) => (
          <button
            key={g.id}
            className={`emopick-tab${tab === g.id && !found ? " is-on" : ""}`}
            title={g.name}
            onClick={() => {
              setQ("");
              setTab(g.id);
            }}
          >
            {g.glyph}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
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
