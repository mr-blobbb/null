/* NULL · Music.tsx
   The player. A shop is never loaded: NULL asks a catalogue for tracks and
   plays the stream it hands back, which is why nothing on this page is an
   embed.

   Four columns of the same thing, really — what is playing, what you looked
   for, what you kept, and what is queued — laid out so the transport is
   always within reach of the list you are reading. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Coins,
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

import { NullFace } from "../lib/brand";
import { Sheet } from "../components/Sheet";
import {
  addToPlaylist,
  clock,
  clearQueue,
  deletePlaylist,
  enqueue,
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
  setSource,
  setVolume,
  SOURCES,
  step,
  toggle,
  toggleFavorite,
  useMusic,
  type Playlist,
  type SourceId,
  type Track,
} from "../lib/music";

export function Music() {
  const m = useMusic();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Playlist | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  const source = SOURCES.find((s) => s.id === m.source) ?? SOURCES[0];

  const run = async (term: string) => {
    if (!term.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const found = await search(term, m.source);
      setResults(found.tracks);
      setNote(found.note);
    } catch (e) {
      setResults([]);
      setNote(`${(e as Error).message}.`);
    }
    setBusy(false);
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

  const kept = useMemo(() => m.favorites.length + m.playlists.reduce((n, p) => n + p.tracks.length, 0), [m]);

  return (
    <div className="page mu">
      <div className="lb-top">
        <h1 className="lb-title">Music</h1>
        <span className="lb-count tiny faint">
          {m.now ? `playing from ${SOURCES.find((s) => s.id === m.now?.source)?.name}` : "nothing playing"}
        </span>
      </div>

      {/* ---------- now playing ---------- */}
      <section className="mu-hero">
        <span className="mu-art">
          {m.now?.art ? <img src={m.now.art} alt="" /> : <NullFace />}
        </span>

        <div className="mu-hero-txt">
          <span className="mu-now">Now playing</span>
          <span className="mu-title">
            {m.now ? m.now.title : "Nothing yet"}
            {m.now?.explicit && <i className="mu-e" title="Explicit">E</i>}
          </span>
          <span className="mu-artist">{m.now ? m.now.artist : "Search for something below"}</span>
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

      {/* ---------- the sources ---------- */}
      <div className="mu-sources">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            className={`mu-source${s.id === m.source ? " is-on" : ""}`}
            onClick={() => setSource(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <p className="tiny faint mu-note">{source.note}</p>

      {/* ---------- search ---------- */}
      <form
        className="hm-search mu-find"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void run(q);
        }}
      >
        <Search />
        <input
          ref={field}
          value={q}
          spellCheck={false}
          autoComplete="off"
          placeholder={`Search ${source.name}`}
          aria-label={`Search ${source.name}`}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn btn--sm" type="submit" disabled={busy}>
          {busy ? "Looking…" : "Search"}
        </button>
      </form>

      {note && <p className="mu-notice">{note}</p>}

      {results.length > 0 && (
        <>
          <h2 className="mu-h">
            Results <b>{results.length}</b>
          </h2>
          <List tracks={results} menuFor={menuFor} setMenuFor={setMenuFor} playList={results} />
        </>
      )}

      {menuFor && <AddMenu trackKey={menuFor} onClose={() => setMenuFor(null)} />}

      {/* ---------- kept ---------- */}
      <h2 className="mu-h">
        Favourites <b>{m.favorites.length}</b>
      </h2>
      {m.favorites.length === 0 ? (
        <p className="mu-blank">Nothing kept yet — the heart on any row saves it here.</p>
      ) : (
        <List tracks={m.favorites} menuFor={menuFor} setMenuFor={setMenuFor} playList={m.favorites} />
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
        <p className="mu-blank">
          No playlists yet. Make one, then use the + on any row to fill it.
        </p>
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

      {/* ---------- queue and history ---------- */}
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
          <List tracks={m.recent.slice(0, 12)} menuFor={menuFor} setMenuFor={setMenuFor} playList={m.recent} />
        </>
      )}

      {/* ---------- the keys ---------- */}
      <section className="card card--pad mu-keys">
        <h3 className="set-h">Where the music comes from</h3>
        <p className="set-note">
          Keyless results play here and now. The other three are asked first once their key
          is set — a browser cannot call them directly, so the key goes to the backend, which
          makes the call. {kept > 0 && `You have kept ${kept} ${kept === 1 ? "track" : "tracks"}.`}
        </p>
        <div className="mu-keygrid">
          {SOURCES.filter((s) => s.keyLabel).map((s) => (
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
      </section>

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
   a list of tracks
   ============================================================ */
function List({
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
    <div className="mu-list">
      {tracks.map((t) => (
        <div className="mu-row" key={t.key}>
          <button className="mu-row-main" onClick={() => play(t, playList)} title={`Play ${t.title}`}>
            <span className="mu-art sm">{t.art ? <img src={t.art} alt="" /> : <MusicIcon />}</span>
            <span className="mu-row-txt">
              <span className="mu-row-title">
                {t.title}
                {t.explicit && <i className="mu-e" title="Explicit">E</i>}
              </span>
              <span className="mu-row-sub">
                {t.artist}
                {t.album ? ` · ${t.album}` : ""}
              </span>
            </span>
            <span className="mu-row-len mono">{clock(t.seconds)}</span>
          </button>

          <button
            className={`mu-icon${isFavorite(t.key) ? " is-on" : ""}`}
            onClick={() => toggleFavorite(t)}
            aria-label="Favourite"
            title="Favourite"
          >
            <Heart />
          </button>
          <button
            className="mu-icon"
            onClick={() => setMenuFor(menuFor === t.key ? null : t.key)}
            aria-label="Add to playlist"
            title="Add to playlist"
          >
            <Plus />
          </button>
          <button className="mu-icon" onClick={() => enqueue(t)} aria-label="Queue" title="Add to queue">
            <ListMusic />
          </button>
        </div>
      ))}
    </div>
  );
}

/** The little menu of playlists a row's + opens. */
function AddMenu({ trackKey, onClose }: { trackKey: string; onClose: () => void }) {
  const m = useMusic();
  const track =
    [...m.favorites, ...m.recent, ...m.queue].find((t) => t.key === trackKey) ?? null;
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
        <p className="mu-blank">Empty so far. Use the + on any row to drop a track in.</p>
      ) : (
        <div className="mu-list">
          {list.tracks.map((t) => (
            <div className="mu-row" key={t.key}>
              <button className="mu-row-main" onClick={() => play(t, list.tracks)}>
                <span className="mu-art sm">{t.art ? <img src={t.art} alt="" /> : <MusicIcon />}</span>
                <span className="mu-row-txt">
                  <span className="mu-row-title">
                    {t.title}
                    {t.explicit && <i className="mu-e">E</i>}
                  </span>
                  <span className="mu-row-sub">{t.artist}</span>
                </span>
                <span className="mu-row-len mono">{clock(t.seconds)}</span>
              </button>
              <button
                className="mu-icon"
                onClick={() => removeFromPlaylist(id, t.key)}
                aria-label="Remove from this playlist"
                title="Remove"
              >
                <X />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="tiny faint">
        <BadgeCheck /> Kept in this browser, like everything else on NULL.{" "}
        <Coins /> {list.tracks.length} tracks.
      </p>
    </div>
  );
}
