/* NULL · Library.tsx
   Games and Apps are the same page wearing a different word. One row at the
   top — the title, the search, the sort, Random and a count — then a filter
   row, then the shelf.

   A tile is a square, the artwork, and the name. No description, no tags on
   the card: the categories are still searchable, they are just not printed
   at you. Without artwork a tile falls back to a plain square and a glyph. */

import { useMemo, useState } from "react";
import {
  Dices,
  Gamepad2,
  Link2,
  Search as SearchIcon,
  Star,
} from "lucide-react";

import { browse, entries, SORTS, type Entry, type Kind, type SortId } from "../lib/catalog";
import { toggleFavorite, pushRecent, useAccount } from "../lib/account";
import { openTab } from "../lib/tabs";
import { trackPlay } from "../lib/econ";

const WORD: Record<Kind, { title: string; one: string; many: string; ph: string; icon: typeof Gamepad2 }> = {
  game: { title: "Games", one: "game", many: "games", ph: "Search Games", icon: Gamepad2 },
  app: { title: "Apps", one: "app", many: "apps", ph: "Search Apps", icon: Link2 },
  proxy: { title: "Proxies", one: "proxy", many: "proxies", ph: "Search Proxies", icon: SearchIcon },
};

export function Library({ kind }: { kind: Kind }) {
  const word = WORD[kind];
  const me = useAccount();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortId>("az");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [seed, setSeed] = useState(1);

  const all = entries(kind);
  const shown = useMemo(
    () =>
      browse(kind, {
        q,
        sort,
        seed,
        onlyIds: onlyFavs ? me.favorites : undefined,
      }),
    [kind, q, sort, seed, onlyFavs, me.favorites],
  );

  const favCount = me.favorites.filter((id) => all.some((e) => e.id === id)).length;

  const launch = (e: Entry) => {
    pushRecent(kind === "app" ? "app" : "game", e.id);
    trackPlay(e.id);
    openTab({ page: "player", arg: { kind, id: e.id, title: e.name } });
  };

  return (
    <div className="page">
      <div className="lb-top">
        <h1 className="lb-title">{word.title}</h1>

        <label className="lb-find">
          <SearchIcon />
          <input
            value={q}
            spellCheck={false}
            placeholder={word.ph}
            aria-label={word.ph}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>

        <select className="lb-sort" value={sort} aria-label="Sort" onChange={(e) => setSort(e.target.value as SortId)}>
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <button
          className="lb-random"
          onClick={() => {
            if (!all.length) return;
            if (sort === "random") {
              setSeed(Math.floor(Math.random() * 9999) + 1);
              return;
            }
            launch(all[Math.floor(Math.random() * all.length)]);
          }}
          disabled={!all.length}
        >
          <Dices /> Random
        </button>

        <span className="lb-count tiny faint">
          {shown.length} of {all.length} {word.many}
        </span>
      </div>

      <div className="lb-filters">
        <button className={`chip${!onlyFavs ? " is-on" : ""}`} onClick={() => setOnlyFavs(false)}>
          <word.icon />
          All
          <b>{all.length}</b>
        </button>
        <button className={`chip${onlyFavs ? " is-on" : ""}`} onClick={() => setOnlyFavs(true)}>
          <Star />
          Favorites
          <b>{favCount}</b>
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="lb-empty card card--pad">
          {onlyFavs && !q ? (
            <p>No favorites yet — star a {word.one} to save it here.</p>
          ) : q ? (
            <p>
              No {word.many} matching “{q}”.
            </p>
          ) : (
            <p>
              oops, we lost hold of the {word.many}. but we're already working on this!
            </p>
          )}
        </div>
      ) : (
        <div className="lb-grid">
          {shown.map((e) => (
            <Tile
              key={e.id}
              entry={e}
              icon={word.icon}
              fav={me.favorites.includes(e.id)}
              onOpen={() => launch(e)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({
  entry,
  icon: Icon,
  fav,
  onOpen,
}: {
  entry: Entry;
  icon: typeof Gamepad2;
  fav: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="tile">
      <button className="tile-btn" onClick={onOpen} title={entry.name}>
        {entry.thumb ? (
          <img src={entry.thumb} alt="" loading="lazy" />
        ) : (
          <span className="tile-blank">
            <Icon />
          </span>
        )}
      </button>
      <button
        className={`tile-star${fav ? " is-on" : ""}`}
        aria-label={fav ? "Remove from favorites" : "Add to favorites"}
        onClick={() => toggleFavorite(entry.id)}
      >
        <Star />
      </button>
      <span className="tile-name">{entry.name}</span>
    </div>
  );
}

