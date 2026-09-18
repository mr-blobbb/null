/* NULL · Library.tsx
   Games and Apps are the same page wearing a different word. One row at the
   top — the title, the search, the sort, Random and a count — then a filter
   row, then the shelf.

   A tile is a square, the artwork, and the name. No description, no tags on
   the card: the categories are still searchable, they are just not printed
   at you. Without artwork a tile falls back to a plain square and a glyph.

   The shelf is thousands of games now, and a few thousand tiles is a few
   thousand images: the page draws the first screenful and the rest arrive
   when they are asked for. Narrowing the search resets that, so a filtered
   shelf is never a shelf you have to ask twice for. */

import { useEffect, useMemo, useState } from "react";
import {
  Dices,
  Gamepad2,
  Link2,
  Search as SearchIcon,
  Star,
} from "lucide-react";

import { browse, entries, sources, SORTS, type Entry, type Kind, type SortId } from "../lib/catalog";
import { Cover } from "../components/Cover";
import { toggleFavorite, pushRecent, useAccount } from "../lib/account";
import { openTab } from "../lib/tabs";
import { trackPlay } from "../lib/econ";

/** How many tiles are drawn before the rest wait to be asked for. */
const SCREEN = 120;

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
  const [source, setSource] = useState("");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [seed, setSeed] = useState(1);
  const [drawn, setDrawn] = useState(SCREEN);

  const all = entries(kind);
  const from = useMemo(() => sources(kind), [kind]);
  const shown = useMemo(
    () =>
      browse(kind, {
        q,
        sort,
        seed,
        source: source || undefined,
        onlyIds: onlyFavs ? me.favorites : undefined,
      }),
    [kind, q, sort, seed, source, onlyFavs, me.favorites],
  );

  /* anything that changes what is on the shelf puts the shelf back to one
     screenful */
  useEffect(() => setDrawn(SCREEN), [kind, q, sort, source, onlyFavs, seed]);

  const page = shown.slice(0, drawn);
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

        {/* the shelf is assembled from several stashes, so it can be read one
            stash at a time */}
        {from.length > 1 && (
          <select
            className="lb-sort"
            value={source}
            aria-label="Source"
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">Every source</option>
            {from.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} ({s.count})
              </option>
            ))}
          </select>
        )}

        <button
          className="lb-random"
          onClick={() => {
            /* Random picks from what is on screen: a surprise out of another
               stash than the one being looked at is not a surprise */
            if (!shown.length) return;
            if (sort === "random") {
              setSeed(Math.floor(Math.random() * 9999) + 1);
              return;
            }
            launch(shown[Math.floor(Math.random() * shown.length)]);
          }}
          disabled={!shown.length}
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
          ) : source ? (
            <p>
              Nothing from {source} here yet.
            </p>
          ) : (
            <p>
              oops, we lost hold of the {word.many}. but we're already working on this!
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="lb-grid">
            {page.map((e) => (
              <Tile
                key={e.id}
                entry={e}
                icon={word.icon}
                fav={me.favorites.includes(e.id)}
                onOpen={() => launch(e)}
              />
            ))}
          </div>
          {shown.length > page.length && (
            <button className="btn lb-more" onClick={() => setDrawn((n) => n + SCREEN)}>
              Show {Math.min(SCREEN, shown.length - page.length)} more
              <span className="tiny faint"> {shown.length - page.length} still waiting</span>
            </button>
          )}
        </>
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
        {/* artwork from someone else's stash, at every host that serves it, and
            a square drawn out of the name when none of them answer */}
        <Cover entry={entry} icon={Icon} />
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

