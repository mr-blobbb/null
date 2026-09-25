/* NULL · Music.tsx
   The player. Every search asks all of the catalogues at once and draws one
   grid of the answers — big square sleeves, the name and the artist under
   each one, an E on the corner when the song is marked explicit.

   Every tile here is the whole song. The catalogues that could only offer a
   thirty-second slice were taken off the panel rather than labelled, so
   there is no badge to read: if it is on the grid, it plays to the end.

   Around the grid: the transport, what you kept, the queue, and the
   playlists, laid out so the transport is always within reach of the list
   you are reading. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Heart,
  ListMusic,
  Music as MusicIcon,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { Sheet } from "../components/Sheet";
import { JamButton } from "../components/JamBox";
import { useAccount } from "../lib/account";
import {
  addToPlaylist,
  clock,
  clearMusic,
  clearQueue,
  deletePlaylist,
  isFavorite,
  jumpTo,
  music,
  newPlaylist,
  play,
  renamePlaylist,
  removeFromPlaylist,
  search,
  seek,
  setKey,
  setRepeat,
  setShuffle,
  setVolume,
  SERVER_SOURCES,
  step,
  toggle,
  toggleFavorite,
  useMusic,
  type Playlist,
  type Track,
} from "../lib/music";

type Tab = "featured" | "search" | "library" | "queue";

/** The four shelves, in the order they are worth reading. */
const TABS: { id: Tab; name: string }[] = [
  { id: "featured", name: "Featured" },
  { id: "search", name: "Search" },
  { id: "library", name: "Your library" },
  { id: "queue", name: "Queue" },
];

/** Featured is a set of doors rather than a chart: NULL has no listen data to
 *  rank with, and a made-up chart is worse than a shelf of moods. Each one is
 *  a search the catalogues answer well, with the words already chosen. */
const STATIONS: { name: string; term: string; note: string }[] = [
  { name: "Late night", term: "lofi beats", note: "slow drums and a warm hiss" },
  { name: "Neon", term: "synthwave", note: "arpeggios, drum machines, one long drive" },
  { name: "Small hours jazz", term: "jazz quartet", note: "brushes, upright bass, a muted horn" },
  { name: "Rain on a window", term: "ambient rain", note: "nothing happens, pleasantly" },
  { name: "No words", term: "instrumental study", note: "for reading something else" },
  { name: "Loud", term: "garage rock", note: "guitars, and a lot of them" },
];

const FIRST_STATION = STATIONS[0];

export function Music() {
  const m = useMusic();
  const me = useAccount();
  const [q, setQ] = useState("");
  /** what the grid is showing, merged across the catalogues */
  const [results, setResults] = useState<Track[]>([]);
  const [pages, setPages] = useState(0);
  const [end, setEnd] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Playlist | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  /** the clear-all button asks twice, because a library is not a mis-click's to take */
  const [sureWipe, setSureWipe] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  /** the keyed sources join in once their key is here */
  const keyed = SERVER_SOURCES.some((s) => (m.keys[s.id] ?? "").trim());
  /* The player is four shelves rather than one long scroll: what NULL would
     put on for you, the box that asks every catalogue, the things you kept,
     and what is lined up next. The hero and the transport sit above all four,
     because a player that scrolls away from its own controls is a web page
     pretending to be one. */
  const [tab, setTab] = useState<Tab>("featured");
  /** the station the featured grid is showing, if any */
  const [station, setStation] = useState<string | null>(null);
  const primed = useRef(false);

  const ask = async (term: string, page: number) => {
    setBusy(true);
    try {
      const found = await search(term, page, keyed);
      setPages(page + 1);
      setEnd(found.tracks.length === 0);
      setNote(page === 0 ? found.note : null);
      setResults((prev) => {
        if (page === 0) return found.tracks;
        const keys = new Set(prev.map((t) => t.key));
        return [...prev, ...found.tracks.filter((t) => !keys.has(t.key))];
      });
    } catch (e) {
      setNote(`${(e as Error).message}.`);
      setEnd(true);
    }
    setBusy(false);
  };

  const run = (term: string) => {
    if (!term.trim()) return;
    setResults([]);
    setEnd(false);
    void ask(term, 0);
  };

  /* space plays and pauses, arrows move, as long as nobody is typing */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (typing) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "ArrowRight" && e.shiftKey) step(1);
      if (e.key === "ArrowLeft" && e.shiftKey) step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    field.current?.focus();
  }, []);

  /* Featured opens with a shelf already on it — an empty player with a search
     box is a player most visitors close. Once, and only until something is
     playing or the visitor picks a station of their own. */
  useEffect(() => {
    if (tab !== "featured" || primed.current) return;
    primed.current = true;
    setQ(FIRST_STATION.term);
    setStation(FIRST_STATION.name);
    void ask(FIRST_STATION.term, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (!sureWipe) return;
    const t = setTimeout(() => setSureWipe(false), 4000);
    return () => clearTimeout(t);
  }, [sureWipe]);

  const wipeAll = () => {
    if (!sureWipe) {
      setSureWipe(true);
      return;
    }
    clearMusic();
    setSureWipe(false);
    setResults([]);
    setEnd(false);
  };

  const kept = useMemo(() => m.favorites.length + m.playlists.reduce((n, p) => n + p.tracks.length, 0), [m]);

  return (
    <div className="page mu">
      <div className="lb-top">
        <h1 className="lb-title">Music</h1>
        <span className="lb-count tiny faint">
          {m.now ? m.now.title : "full songs only — no previews, ever"}
        </span>
        <span className="mu-top-right">
          <JamButton me={me.user} />
        </span>
      </div>

      {/* ---------- now playing ---------- */}
      <section className="mu-hero">
        <span className="mu-art">
          {m.now?.art ? <img src={m.now.art} alt="" /> : <MusicIcon />}
        </span>

        <div className="mu-hero-txt">
          <span className="mu-now">Now playing</span>
          <span className="mu-title">
            {m.now ? m.now.title : "Nothing yet"}
            {m.now?.explicit && <i className="mu-e" title="Explicit">E</i>}
          </span>
          <span className="mu-artist">{m.now ? m.now.artist : "Search below — every catalogue is asked at once"}</span>
          {m.now?.album && <span className="mu-album">{m.now.album}</span>}
          {m.problem && <span className="mu-problem">{m.problem}</span>}
        </div>

        <button
          className={`mu-heart${m.now && isFavorite(m.now.key) ? " is-on" : ""}`}
          disabled={!m.now}
          onClick={() => m.now && toggleFavorite(m.now)}
          aria-label="Favourite"
          title="Favourite"
        >
          <Heart />
        </button>
      </section>

      {/* ---------- transport ---------- */}
      <section className="mu-bar">
        <button
          className={`mu-btn${m.shuffle ? " is-on" : ""}`}
          onClick={() => setShuffle(!m.shuffle)}
          aria-label="Shuffle"
          title="Shuffle"
        >
          <Shuffle />
        </button>
        <button className="mu-btn" onClick={() => step(-1)} aria-label="Previous" title="Previous">
          <SkipBack />
        </button>
        <button className="mu-btn mu-btn--big" onClick={toggle} aria-label={m.playing ? "Pause" : "Play"}>
          {m.playing ? <Pause /> : <Play />}
        </button>
        <button className="mu-btn" onClick={() => step(1)} aria-label="Next" title="Next">
          <SkipForward />
        </button>
        <button
          className={`mu-btn${m.repeat !== "off" ? " is-on" : ""}`}
          onClick={() => setRepeat(m.repeat === "off" ? "all" : m.repeat === "all" ? "one" : "off")}
          aria-label="Repeat"
          title={`Repeat: ${m.repeat}`}
        >
          {m.repeat === "one" ? <Repeat1 /> : <Repeat />}
        </button>

        <span className="mu-time mono">{clock(m.at)}</span>
        <input
          className="mu-seek"
          type="range"
          min={0}
          max={Math.max(m.duration, 1)}
          step={1}
          value={Math.min(m.at, Math.max(m.duration, 1))}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          disabled={!m.now}
        />
        <span className="mu-time mono">{clock(m.duration)}</span>

        <button
          className="mu-btn"
          onClick={() => setVolume(m.volume > 0 ? 0 : 0.8)}
          aria-label="Mute"
          title="Mute"
        >
          {m.volume > 0 ? <Volume2 /> : <VolumeX />}
        </button>
        <input
          className="mu-vol"
          type="range"
          min={0}
          max={100}
          value={Math.round(m.volume * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          aria-label="Volume"
        />
      </section>

      {/* ---------- the four shelves ---------- */}
      <nav className="mu-tabs" aria-label="Music sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`mu-tab${tab === t.id ? " is-on" : ""}`}
            onClick={() => {
              setTab(t.id);
              if (t.id === "search") window.setTimeout(() => field.current?.focus(), 0);
            }}
          >
            {t.name}
            {t.id === "library" && kept > 0 && <b>{kept}</b>}
            {t.id === "queue" && m.queue.length > 0 && <b>{m.queue.length}</b>}
          </button>
        ))}
      </nav>

      {/* ---------- featured: doors, not a chart ---------- */}
      {tab === "featured" && (
        <>
          <div className="mu-stations">
            {STATIONS.map((s) => (
              <button
                key={s.term}
                className={`mu-station${station === s.name ? " is-on" : ""}`}
                onClick={() => {
                  setStation(s.name);
                  setQ(s.term);
                  run(s.term);
                }}
              >
                <b>{s.name}</b>
                <span>{s.note}</span>
              </button>
            ))}
          </div>

          {station && results.length > 0 && (
            <>
              <h2 className="mu-h">
                {station} <b>{results.length}</b>
              </h2>
              <Grid tracks={results} menuFor={menuFor} setMenuFor={setMenuFor} playList={results} />
              {!end && (
                <button className="btn lb-more" disabled={busy} onClick={() => void ask(q, pages)}>
                  {busy ? "Looking…" : "More from this shelf"}
                </button>
              )}
            </>
          )}

          {m.recent.length > 0 && (
            <>
              <h2 className="mu-h">Picked up where you left off</h2>
              <Grid
                tracks={m.recent.slice(0, 12)}
                menuFor={menuFor}
                setMenuFor={setMenuFor}
                playList={m.recent}
              />
            </>
          )}
        </>
      )}

      {/* ---------- search: one box, every catalogue ---------- */}
      {tab === "search" && (
        <>
      <form
        className="hm-search mu-find"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
      >
        <Search />
        <input
          ref={field}
          value={q}
          spellCheck={false}
          autoComplete="off"
          placeholder="Search every catalogue at once"
          aria-label="Search music"
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn btn--sm" type="submit" disabled={busy}>
          {busy ? "Looking…" : "Search"}
        </button>
      </form>
      <p className="tiny faint mu-note">
        Audius and the Internet Archive are always searched. SoundCloud and Qobuz join when their key is set
        below. Every result is the complete track.
      </p>

      {note && <p className="mu-notice">{note}</p>}

      {results.length > 0 && (
        <>
          <h2 className="mu-h">
            Results <b>{results.length}</b>
          </h2>
          <Grid tracks={results} menuFor={menuFor} setMenuFor={setMenuFor} playList={results} />
          {!end && (
            <button className="btn lb-more" disabled={busy} onClick={() => void ask(q, pages)}>
              {busy ? "Looking…" : `More — page ${pages + 1}`}
              <span className="tiny faint"> every catalogue is asked again</span>
            </button>
          )}
          {end && !busy && <p className="tiny faint mu-endnote">That is every match the catalogues had.</p>}
        </>
      )}
        </>
      )}

      {menuFor && <AddMenu trackKey={menuFor} results={results} onClose={() => setMenuFor(null)} />}

      {/* ---------- what you kept ---------- */}
      {tab === "library" && (
        <>
      {/* ---------- kept ---------- */}
      <h2 className="mu-h">
        Favourites <b>{m.favorites.length}</b>
      </h2>
      {m.favorites.length === 0 ? (
        <p className="mu-blank">Nothing kept yet — the heart on any tile saves it here.</p>
      ) : (
        <Grid tracks={m.favorites} menuFor={menuFor} setMenuFor={setMenuFor} playList={m.favorites} />
      )}

      <h2 className="mu-h">
        Playlists <b>{m.playlists.length}</b>
        <button
          className="btn btn--sm"
          onClick={() => {
            const id = newPlaylist(`Playlist ${m.playlists.length + 1}`);
            const made = music.get().playlists.find((p) => p.id === id);
            if (made) setSheet(made);
          }}
        >
          <Plus /> New
        </button>
      </h2>
      {m.playlists.length === 0 ? (
        <p className="mu-blank">No playlists yet. Make one, then use the + on any tile to fill it.</p>
      ) : (
        <div className="mu-plgrid">
          {m.playlists.map((p) => (
            <button key={p.id} className="mu-plcard" onClick={() => setSheet(p)}>
              <span className="mu-plart">
                {p.tracks[0]?.art ? <img src={p.tracks[0].art} alt="" /> : <ListMusic />}
              </span>
              <span className="mu-plname">{p.name}</span>
              <span className="mu-plcount tiny faint">
                {p.tracks.length} {p.tracks.length === 1 ? "track" : "tracks"}
              </span>
              <span className="mu-plplay">
                <Play />
              </span>
            </button>
          ))}
        </div>
      )}

        </>
      )}

      {/* ---------- queue and history ---------- */}
      {tab === "queue" && (
        <>
      <h2 className="mu-h">
        Queue <b>{m.queue.length}</b>
        {m.queue.length > 0 && (
          <button className="btn btn--sm" onClick={clearQueue}>
            <Trash2 /> Clear
          </button>
        )}
      </h2>
      {m.queue.length === 0 ? (
        <p className="mu-blank">The queue is empty. Playing anything fills it with that list.</p>
      ) : (
        <div className="mu-queue">
          {m.queue.map((t, i) => (
            <button
              key={`${t.key}-${i}`}
              data-track={t.key}
              className={`mu-qrow${i === m.index ? " is-on" : ""}`}
              onClick={() => jumpTo(i)}
              title={t.title}
            >
              <span className="mu-qn mono">{i + 1}</span>
              <span className="mu-qname">{t.title}</span>
              <span className="mu-qwho">{t.artist}</span>
              <span className="mu-qlen mono">{clock(t.seconds)}</span>
            </button>
          ))}
        </div>
      )}

      {m.recent.length > 0 && (
        <>
          <h2 className="mu-h">
            Recently played <b>{m.recent.length}</b>
          </h2>
          <Grid tracks={m.recent.slice(0, 18)} menuFor={menuFor} setMenuFor={setMenuFor} playList={m.recent} />
        </>
      )}

        </>
      )}

      {/* ---------- clearing the whole library ----------
          One button, asked twice: it takes the favourites, the playlists, the
          history and whatever is playing with it. It lives on the library
          shelf, next to the things it takes. */}
      {tab === "library" &&
        (m.favorites.length > 0 || m.recent.length > 0 || m.playlists.length > 0 || m.now) && (
        <div className="setrow setrow--actions">
          <button className="btn btn--bad" onClick={wipeAll}
            title={
              sureWipe
                ? "Press again — this clears favourites, playlists, history and the player"
                : "Clear everything: favourites, playlists, history and the player"
            }
          >
            <Trash2 /> {sureWipe ? "Sure? Clear everything" : "Clear all music"}
          </button>
          <span className="tiny faint">Favourites, playlists, history and what is playing — the catalogue keys stay.</span>
        </div>
      )}

      {/* ---------- the optional keys ---------- */}
      {tab === "search" && (
      <section className="card card--pad mu-keys">
        <h3 className="set-h">Widen the catalogue</h3>
        <p className="set-note">
          Audius and the Internet Archive need nothing and are always on. These two are asked through
          the backend once a key is here — {kept > 0 && `you have kept ${kept} ${kept === 1 ? "track" : "tracks"}.`}
        </p>
        <div className="mu-keygrid">
          {SERVER_SOURCES.map((s) => (
            <label className="form-row" key={s.id}>
              <span>
                {s.name} · {s.keyLabel}
              </span>
              <input
                className="fld"
                value={m.keys[s.id] ?? ""}
                spellCheck={false}
                placeholder={s.placeholder}
                onChange={(e) => setKey(s.id, e.target.value.trim())}
              />
            </label>
          ))}
        </div>
        <p className="tiny faint">
          Or set {SERVER_SOURCES.map((s) => s.env).join(" and ")} on the deployment and every visitor gets them.
        </p>
      </section>
      )}

      <Sheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        width={560}
        title={sheet?.name ?? "Playlist"}
        icon={<ListMusic />}
      >
        {sheet && <PlaylistSheet id={sheet.id} onGone={() => setSheet(null)} />}
      </Sheet>
    </div>
  );
}

/* ============================================================
   the grid: big squares, name and artist underneath
   ============================================================ */
function Grid({
  tracks,
  menuFor,
  setMenuFor,
  playList,
}: {
  tracks: Track[];
  menuFor: string | null;
  setMenuFor: (k: string | null) => void;
  playList: Track[];
}) {
  return (
    <div className="mu-grid">
      {tracks.map((t) => (
        <div className="mu-tile" key={t.key} data-track={t.key}>
          <button className="mu-tile-btn" onClick={() => play(t, playList)} title={`Play ${t.title}`}>
            {t.art ? (
              <img src={t.art} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="mu-tile-none">
                <MusicIcon />
              </span>
            )}
            {t.explicit && (
              <i className="mu-e mu-tile-e" title="Explicit">
                E
              </i>
            )}
            <span className="mu-tile-play">
              <Play />
            </span>
          </button>
          <button
            className={`mu-tile-add${menuFor === t.key ? " is-on" : ""}`}
            onClick={() => setMenuFor(menuFor === t.key ? null : t.key)}
            aria-label="Add to playlist"
            title="Add to playlist"
          >
            <Plus />
          </button>
          <span className="mu-tile-name" title={t.title}>
            {t.title}
          </span>
          <span className="mu-tile-artist" title={t.artist}>
            {t.artist}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The little menu of playlists a tile's + opens. The tile that opened it
 *  may only exist in the last search, so the results list is carried in too
 *  — a track that was never played is still addable. */
function AddMenu({ trackKey, results, onClose }: { trackKey: string; results: Track[]; onClose: () => void }) {
  const m = useMusic();
  const track =
    [...m.favorites, ...m.recent, ...m.queue, ...results].find((t) => t.key === trackKey) ?? null;
  const [name, setName] = useState("");

  return (
    <div className="mu-add">
      <div className="mu-add-head">
        <b>Add to a playlist</b>
        <button className="sheet-x" onClick={onClose} aria-label="Close">
          <X />
        </button>
      </div>
      {m.playlists.length === 0 && <p className="tiny faint">No playlists yet.</p>}
      <div className="mu-add-list">
        {m.playlists.map((p) => (
          <button
            key={p.id}
            className="mu-add-row"
            onClick={() => {
              if (track) addToPlaylist(p.id, track);
              onClose();
            }}
          >
            <ListMusic />
            {p.name}
            <em className="tiny faint">· {p.tracks.length}</em>
          </button>
        ))}
      </div>
      <div className="mu-add-new">
        <input
          className="fld"
          value={name}
          placeholder="New playlist"
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="btn btn--sm btn--fill"
          onClick={() => {
            if (!name.trim()) return;
            const id = newPlaylist(name);
            if (track) addToPlaylist(id, track);
            onClose();
          }}
        >
          Make it
        </button>
      </div>
      <button
        className="btn btn--sm"
        onClick={() => {
          if (track) toggleFavorite(track);
          onClose();
        }}
      >
        <Heart /> {track && isFavorite(track.key) ? "Unfavourite" : "Favourite it"}
      </button>
    </div>
  );
}

function PlaylistSheet({ id, onGone }: { id: string; onGone: () => void }) {
  const m = useMusic();
  const list = m.playlists.find((p) => p.id === id);
  const [name, setName] = useState(list?.name ?? "");

  if (!list) return null;

  return (
    <div className="mu-plsheet">
      <div className="mu-plrow">
        <input
          className="fld"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => renamePlaylist(id, name)}
          aria-label="Playlist name"
        />
        <button
          className="btn btn--sm btn--fill"
          onClick={() => play(list.tracks[0], list.tracks)}
          disabled={!list.tracks.length}
        >
          <Play /> Play
        </button>
        <button className="btn btn--sm" onClick={() => setShuffle(true)} title="Play this shuffled">
          <Shuffle />
        </button>
        <button
          className="btn btn--sm btn--bad"
          onClick={() => {
            deletePlaylist(id);
            onGone();
          }}
        >
          <Trash2 /> Delete
        </button>
      </div>

      {list.tracks.length === 0 ? (
        <p className="mu-blank">Empty so far. Use the + on any tile to drop a track in.</p>
      ) : (
        <div className="mu-grid mu-grid--sheet">
          {list.tracks.map((t) => (
            <div className="mu-tile" key={t.key} data-track={t.key}>
              <button className="mu-tile-btn" onClick={() => play(t, list.tracks)} title={`Play ${t.title}`}>
                {t.art ? <img src={t.art} alt="" /> : <MusicIcon />}
                {t.explicit && <i className="mu-e mu-tile-e">E</i>}
              </button>
              <button
                className="mu-tile-add"
                onClick={() => removeFromPlaylist(id, t.key)}
                aria-label="Remove from this playlist"
                title="Remove"
              >
                <X />
              </button>
              <span className="mu-tile-name">{t.title}</span>
              <span className="mu-tile-artist">{t.artist}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
