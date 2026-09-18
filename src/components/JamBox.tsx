/* NULL · JamBox.tsx
   The double-silhouette button: listen together.

   One panel, three states. Nothing running: start one, or type a code. Hosting:
   the code, in mono and spaced out so it can be read across a room. Listening:
   who holds the room and what is playing, and one button to walk out. */

import { useState } from "react";
import { Copy, LogOut, Users, X } from "lucide-react";

import { Sheet } from "./Sheet";
import { joinJam, leaveJam, startJam, stopJam, useJam, useJamRow } from "../lib/jam";
import { useMusic } from "../lib/music";

export function JamButton({
  me,
  className = "mu-btn",
  label,
}: {
  /** the host's handle, or null when signed out */
  me: string | null;
  className?: string;
  label?: string;
}) {
  const live = useJam();
  const [open, setOpen] = useState(false);
  const row = useJamRow(live.code);
  const m = useMusic();

  return (
    <>
      <button
        className={`${className} mu-jam`}
        onClick={() => setOpen(true)}
        title={live.code ? `In a jam · ${live.code}` : "Listen together"}
        aria-label="Listen together"
      >
        <Users />
        {label}
        {live.code && <span className="jm-pip" />}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        width={440}
        title="Listen together"
        icon={<Users />}
      >
        <JamPanel me={me} row={row} now={m.now?.title ?? null} />
      </Sheet>
    </>
  );
}

function JamPanel({
  me,
  row,
  now,
}: {
  me: string | null;
  row: { code: string; host: string; track: string | null; playing: boolean; at: number; stamp: number } | null | undefined;
  now: string | null;
}) {
  const live = useJam();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!me) {
    return <p className="jm-say">Sign in to start a jam — the code has to belong to somebody.</p>;
  }

  /* ---------- hosting ---------- */
  if (live.role === "host") {
    return (
      <div className="jm">
        <p className="jm-say">
          Everyone who joins hears what you hear: change the track, pause it, skip — the room follows.
        </p>
        <div className="jm-head">
          <span className="jm-code">{live.code}</span>
          <button
            className="btn btn--sm"
            onClick={() => {
              void navigator.clipboard?.writeText(live.code ?? "");
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }}
          >
            <Copy /> {copied ? "Copied" : "Copy code"}
          </button>
        </div>
        <div className="jm-live">
          <span className={`jm-dot${row ? " is-on" : ""}`} />
          <span className="jm-track">{now ? `playing ${now}` : "nothing playing yet"}</span>
        </div>
        <button className="btn" onClick={() => void stopJam(me)}>
          <X /> Close the jam
        </button>
      </div>
    );
  }

  /* ---------- listening ---------- */
  if (live.role === "guest" && live.code) {
    const theirs = row?.track ? (JSON.parse(row.track) as { title?: string; artist?: string }) : null;
    return (
      <div className="jm">
        <div className="jm-head">
          <span className="jm-code">{live.code}</span>
          <span className={`jm-dot${row ? " is-on" : ""}`} />
        </div>
        {row ? (
          <div className="jm-live">
            <div>
              <div className="jm-who">@{row.host} holds this room</div>
              <div className="jm-track">
                {theirs ? `${theirs.title ?? "Untitled"} — ${theirs.artist ?? "unknown"}` : "nothing playing yet"}
                {row.playing ? "" : " (paused)"}
              </div>
            </div>
          </div>
        ) : (
          <p className="jm-say">Waiting for the host. If nothing appears, the code has a typo or the jam has closed.</p>
        )}
        <button className="btn" onClick={leaveJam}>
          <LogOut /> Leave the jam
        </button>
      </div>
    );
  }

  /* ---------- nothing yet ---------- */
  return (
    <div className="jm">
      <p className="jm-say">
        A jam is one player and everybody else listening to it. Start one and pass the code around, or type
        somebody else's code to walk into their room.
      </p>
      <button
        className="btn btn--go"
        onClick={async () => {
          const out = await startJam(me);
          if (!out.ok) setErr(out.reason ?? "That did not work.");
        }}
      >
        <Users /> Start a jam
      </button>
      <div className="jm-join">
        <input
          className="fld"
          value={code}
          maxLength={4}
          placeholder="CODE"
          spellCheck={false}
          onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4))}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const out = joinJam(code, me);
            if (!out.ok) setErr(out.reason ?? null);
          }}
        />
        <button
          className="btn"
          onClick={() => {
            const out = joinJam(code, me);
            if (!out.ok) setErr(out.reason ?? null);
          }}
        >
          Join
        </button>
      </div>
      {err && <p className="form-err tiny">{err}</p>}
    </div>
  );
}
