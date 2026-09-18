/* NULL · CloudSaves.tsx
   The save slots, drawn the same way in the player and on a profile.

   Two kinds of game, two ways in, and the panel says which one it is looking
   at rather than pretending they are the same:

   · A game NULL copied into a frame runs as a document this page can reach,
     so its storage can be read straight out of it. One click, no typing.
   · A game on somebody else's origin cannot be read — that is what an origin
     is for — so those cards take the save the honest way: paste it, or drop
     in the file the game exported.

   Either way what ends up on the account is text NULL never looks inside,
   which is why it works for a game nobody has heard of yet. */

import { useRef, useState, type RefObject } from "react";
import { CloudDownload, CloudUpload, HardDrive, Trash2, TriangleAlert } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { cloud } from "../lib/cloud";
import { useAccount } from "../lib/account";
import {
  capture,
  download,
  dropSave,
  restore,
  saveSlot,
  sizeOf,
  useSaves,
  type SaveRow,
} from "../lib/saves";

type Props = {
  /** the catalog id a slot is filed under. Left out on a profile, where the
   *  list is every save the account has */
  game?: string;
  /** what the card calls it */
  name?: string;
  /** the live frame, when there is one: this is what makes one-click saving
   *  possible at all */
  frame?: RefObject<HTMLIFrameElement | null>;
  /** called after a save is put back, so the player can reload the game */
  onRestored?: () => void;
  /** the profile draws the list without the controls that need a game open */
  embedded?: boolean;
};

export function CloudSaves({ game, name, frame, onRestored, embedded }: Props) {
  const me = useAccount();
  const rows = useSaves(me.user, game);
  const [slot, setSlot] = useState("");
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pasting, setPasting] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  const signedIn = !!me.user;
  const label = name || game || "a game";

  /** Save whatever the game is keeping right now. */
  const snapshot = async () => {
    setNote(null);
    setBusy(true);
    const data = frame ? capture(frame.current) : null;
    if (!data) {
      setBusy(false);
      setNote(
        frame
          ? "NULL cannot read inside this game's own origin, so it cannot take the save by itself. Paste it below, or use the game's own export."
          : "Open a game to save one, or paste a save below.",
      );
      setPasting(true);
      box.current?.focus();
      return;
    }
    const out = await saveSlot({
      user: me.user,
      game: game ?? "unknown",
      label: `${label} — ${stamp()}`,
      slot: slot.trim() || stamp(),
      data,
      from: "read from the game",
    });
    setBusy(false);
    setNote(out.ok ? "Saved. It will be on any machine you sign in on." : out.why);
  };

  /** Save something typed or copied in. */
  const savePasted = async () => {
    if (!paste.trim()) return;
    setBusy(true);
    const out = await saveSlot({
      user: me.user,
      game: game ?? "unknown",
      label: `${label} — pasted ${stamp()}`,
      slot: slot.trim() || stamp(),
      data: paste,
      from: "pasted in",
    });
    setBusy(false);
    setPaste("");
    setNote(out.ok ? "Kept." : out.why);
  };

  const load = async (row: SaveRow) => {
    setNote(null);
    const data = await fetchData(row);
    if (!data) {
      setNote("That save could not be read back.");
      return;
    }
    if (!frame) {
      setNote("Open the game to put this back.");
      return;
    }
    const out = restore(frame.current, data);
    if (!out.ok) {
      setNote(out.why ?? "The game refused the save.");
      return;
    }
    setNote(`Put back ${out.keys} keys. Reloading the game…`);
    onRestored?.();
  };

  return (
    <div className={`cs${embedded ? " cs--flat" : ""}`}>
      <header className="cs-head">
        <HardDrive />
        <b>Cloud saves</b>
        <span className="tiny faint">
          {signedIn
            ? `kept on @${me.user}'s account`
            : "kept in this browser only — sign in to carry them"}
        </span>
      </header>

      {!embedded && (
        <div className="cs-actions">
          <input
            className="fld cs-slot"
            value={slot}
            spellCheck={false}
            placeholder="slot name, or leave it to the date"
            onChange={(e) => setSlot(e.target.value)}
          />
          <button className="btn btn--fill btn--sm" disabled={busy} onClick={() => void snapshot()}>
            <CloudUpload /> Save {name ? "this game" : "it"}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="tiny faint cs-empty">
          No saves yet.{embedded ? "" : " Take one and it will follow you to any machine."}
        </p>
      ) : (
        <ul className="cs-list">
          {rows.map((r) => (
            <li key={r.id} className="cs-row">
              <span className="cs-row-txt">
                <b>{r.slot}</b>
                <em className="tiny faint">
                  {r.name || r.game} · {sizeOf(r.size ?? r.data.length)} · {r.from} · {when(r.at)}
                </em>
              </span>
              {!embedded && (
                <button className="ch-tool" title="Load it into the game" onClick={() => void load(r)}>
                  <CloudDownload />
                </button>
              )}
              <button
                className="ch-tool"
                title="Download as a file"
                onClick={() => void withData(r, (data) => download(r.name || r.game, r.slot, data))}
              >
                <HardDrive />
              </button>
              <button
                className="ch-tool"
                title="Delete this save"
                onClick={() => void dropSave(me.user, r.id)}
              >
                <Trash2 />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!embedded && (
        <div className="cs-paste">
          <button className="cs-paste-head tiny faint" onClick={() => setPasting(!pasting)}>
            <CloudUpload /> Paste a save instead
          </button>
          {pasting && (
            <>
              <textarea
                ref={box}
                className="cs-box"
                value={paste}
                spellCheck={false}
                placeholder="Games keep their saves as text, usually JSON in localStorage. Paste it here and NULL will keep it exactly as it is."
                onChange={(e) => setPaste(e.target.value)}
              />
              <button className="btn btn--sm" disabled={busy || !paste.trim()} onClick={() => void savePasted()}>
                Keep this
              </button>
            </>
          )}
        </div>
      )}

      {note && (
        <p className="cs-note tiny faint">
          <TriangleAlert /> {note}
        </p>
      )}

      {frame && (
        <p className="cs-hint tiny faint">
          A game NULL copied into a frame can be saved in one click. A game on its own site cannot —
          its origin is not NULL's to read — so those take a paste.
        </p>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

async function fetchData(row: SaveRow): Promise<string | null> {
  if (row.id.startsWith("local:")) return row.data || null;
  const c = cloud();
  if (!c) return null;
  try {
    const got = (await c.query(api.saves.read, { id: row.id })) as { data: string } | null;
    return got?.data ?? null;
  } catch {
    return null;
  }
}

async function withData(row: SaveRow, fn: (data: string) => void) {
  const data = await fetchData(row);
  if (data) fn(data);
}

/** A slot name nobody has to think of. */
function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function when(at: number): string {
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(at).toLocaleDateString();
}
