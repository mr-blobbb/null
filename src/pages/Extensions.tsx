/* NULL · Extensions.tsx
   The header is the puzzle piece, the name, and a quiet note that this is
   experimental. Under it, what is installed and what can be.

   An extension declares where it draws: `nav` puts it in the top bar,
   `page` gives it a page, `overlay` floats it. The access list is printed
   on every card, because an add-on that can read your coins should say so. */

import { useState } from "react";
import { Check, Download, Puzzle, Search, Trash2 } from "lucide-react";

import {
  EXTENSIONS,
  extStore,
  install,
  setOn,
  uninstall,
  useExt,
  type Extension,
} from "../lib/extensions";
import { Sheet } from "../components/Sheet";

export function Extensions() {
  const me = useExt();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Extension | null>(null);

  const filtered = EXTENSIONS.filter(
    (e) => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.desc.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="page">
      <header className="ex-head">
        <span className="ex-mark">
          <Puzzle />
        </span>
        <div>
          <h1 className="lb-title">
            Extensions
            <span className="ex-tag tiny">null · experimental</span>
          </h1>
          <p className="lede">
            Add-ons that draw inside NULL: a chip in the top bar, a page of their own, or a
            layer over whatever is on screen.
          </p>
        </div>
      </header>

      <label className="lb-find ex-find">
        <Search />
        <input
          value={q}
          spellCheck={false}
          placeholder="Search installed and available extensions"
          aria-label="Search extensions"
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      <div className="ex-grid">
        {filtered.map((e) => {
          const has = me.installed.includes(e.id);
          const on = has && me.on[e.id] !== false;
          return (
            <article className={`card ex-card${on ? " is-on" : ""}`} key={e.id}>
              <div className="ex-card-top">
                <span className="ex-card-icon">
                  <Puzzle />
                </span>
                <div>
                  <b>{e.name}</b>
                  <span className="tiny faint">
                    {e.author} · v{e.version}
                  </span>
                </div>
                <span className={`ex-surface ex-surface--${e.surface}`}>{e.surface}</span>
              </div>
              <p className="ex-desc">{e.desc}</p>
              <div className="ex-access">
                {e.access.map((a) => (
                  <span className="pill" key={a}>
                    {a}
                  </span>
                ))}
              </div>
              <div className="ex-actions">
                <button className="btn btn--sm" onClick={() => setOpen(e)}>
                  Details
                </button>
                {has ? (
                  <>
                    <button
                      className={`btn btn--sm${on ? " btn--fill" : ""}`}
                      onClick={() => setOn(e.id, !on)}
                    >
                      {on ? <Check /> : null}
                      {on ? "On" : "Off"}
                    </button>
                    <button className="btn btn--sm btn--icon" onClick={() => uninstall(e.id)} title="Remove">
                      <Trash2 />
                    </button>
                  </>
                ) : (
                  <button className="btn btn--sm btn--fill" onClick={() => install(e.id)}>
                    <Download /> Install
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <p className="faint">Nothing matches “{q}”.</p>
        )}
      </div>

      {me.installed.includes("notes") && me.on.notes !== false && <Scratchpad />}

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name} icon={<Puzzle />} width={520}>
        {open && (
          <div className="ex-detail">
            <p className="muted">{open.desc}</p>
            <ul className="ex-detail-list">
              <li>
                <b>Author</b> <span>{open.author}</span>
              </li>
              <li>
                <b>Version</b> <span>{open.version}</span>
              </li>
              <li>
                <b>Draws in</b> <span>{open.surface}</span>
              </li>
              <li>
                <b>Access</b> <span>{open.access.join(", ")}</span>
              </li>
            </ul>
            <p className="tiny faint">
              Extensions run in the page, with the page's own permissions. Nothing is
              sandboxed from NULL itself, so read the access list before you install one.
            </p>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** The Scratchpad extension's page, drawn inside the Extensions page when it
 *  is on: a demonstration of what "a page of its own" looks like. */
function Scratchpad() {
  const me = useExt();
  const value = me.notes.scratch ?? "";
  return (
    <section className="card card--pad ex-page">
      <h2 className="set-h">Scratchpad</h2>
      <p className="set-note tiny">
        This box belongs to the Scratchpad extension, not to NULL. It is drawn here because
        the extension asked for a page, and it keeps what you type in the same storage
        everything else uses.
      </p>
      <textarea
        className="fld fld--area ex-page-area"
        value={value}
        placeholder="Nothing yet. Type here — it survives a reload."
        onChange={(e) => extStore.set({ notes: { ...me.notes, scratch: e.target.value } })}
      />
    </section>
  );
}
