/* NULL · SettingsSheet.tsx
   Settings is not a page. It opens over whatever is already on screen, so
   changing a theme never loses your place. Four tabs down the side:
   Appearance, Cloak, Data, and the paperwork. */

import { useState } from "react";
import {
  Check,
  Database,
  EyeOff,
  FileText,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";

import { Sheet } from "./Sheet";
import { DEFAULT_CUSTOM, PALETTES, prefs, usePalette, type PaletteId } from "../lib/themes";
import { allKeys, removeKey, useStore } from "../lib/store";
import { CLOAKS, pick, SMART_ID } from "../lib/cloak";
import { replayTour } from "./Tour";
import { econ, resetEcon } from "../lib/econ";
import { account } from "../lib/account";

type Tab = "appearance" | "cloak" | "data" | "legal";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("appearance");
  const palette = usePalette();
  const p = useStore(prefs);

  return (
    <Sheet open={open} onClose={onClose} title="Settings" width={720}>
      <div className="setwrap">
        <nav className="setnav">
          <button className={`setnav-btn${tab === "appearance" ? " is-on" : ""}`} onClick={() => setTab("appearance")}>
            <Palette /> Appearance
          </button>
          <button className={`setnav-btn${tab === "cloak" ? " is-on" : ""}`} onClick={() => setTab("cloak")}>
            <EyeOff /> Tab cloak
          </button>
          <button className={`setnav-btn${tab === "data" ? " is-on" : ""}`} onClick={() => setTab("data")}>
            <Database /> Data
          </button>
          <button className={`setnav-btn${tab === "legal" ? " is-on" : ""}`} onClick={() => setTab("legal")}>
            <FileText /> Privacy &amp; ToS
          </button>
        </nav>

        <div className="setpane">
          {tab === "appearance" && (
            <>
              <h3 className="set-h">Appearance</h3>
              <p className="set-sub">Theme</p>
              <div className="palgrid">
                {PALETTES.map((pal) => (
                  <button
                    key={pal.id}
                    className={`palcard${pal.id === palette.id ? " is-on" : ""}`}
                    onClick={() => {
                      prefs.set({ palette: pal.id as PaletteId });
                    }}
                  >
                    <span className="palswatch" style={{ background: pal.bg }}>
                      <i style={{ background: pal.ink }} />
                    </span>
                    <span className="palname">
                      {pal.id === palette.id && <Check />}
                      {pal.name}
                    </span>
                  </button>
                ))}
              </div>

              {palette.id === "custom" && <CustomPalette />}

              <div className="hair set-hair" />
              <h3 className="set-h">Performance</h3>
              <label className="setrow">
                <span>
                  <b>Performance mode</b>
                  <em>Stops the drifting background art and the effects.</em>
                </span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={!!p.perf}
                  onChange={(e) => {
                    prefs.set({ perf: e.target.checked ? "1" : "" });
                  }}
                />
              </label>
              <label className="setrow">
                <span>
                  <b>Reduce motion</b>
                  <em>No animation anywhere: nothing slides, nothing loops.</em>
                </span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={p.reduceMotion}
                  onChange={(e) => prefs.set({ reduceMotion: e.target.checked })}
                />
              </label>
              <label className="setrow">
                <span>
                  <b>Page timer readout</b>
                  <em>The “Page: N ms” line in the corner of the home page.</em>
                </span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={p.showMeta}
                  onChange={(e) => prefs.set({ showMeta: e.target.checked })}
                />
              </label>

              <div className="hair set-hair" />
              <h3 className="set-h">Navigation</h3>
              <p className="set-note">
                The rail on the left is the only navigation. It stays thin and never
                opens, which is what keeps it out of the way.
              </p>
              <label className="setrow">
                <span>
                  <b>The tour</b>
                  <em>Watch the five-step introduction to the front door again.</em>
                </span>
                <button
                  className="btn btn--sm"
                  onClick={() => {
                    replayTour();
                    onClose();
                  }}
                >
                  Play it
                </button>
              </label>
            </>
          )}

          {tab === "cloak" && <CloakPane />}

          {tab === "data" && (
            <>
              <h3 className="set-h">Data</h3>
              <p className="set-note">
                Everything NULL knows lives in this browser. Restoring a backup merges
                the files back in; clearing removes the keys below.
              </p>
              <div className="scroller keylist">
                {allKeys().map((k) => (
                  <div className="keyrow" key={k}>
                    <span className="mono">null:{k}</span>
                    <button
                      className="btn btn--sm"
                      onClick={() => {
                        removeKey(k);
                        location.reload();
                      }}
                    >
                      <Trash2 />
                    </button>
                  </div>
                ))}
                {allKeys().length === 0 && <p className="faint">Nothing saved yet.</p>}
              </div>
              <div className="setrow setrow--actions">
                <button className="btn" onClick={() => account.set({ lastBackup: Date.now() })}>
                  Back up now
                </button>
                <button
                  className="btn btn--bad"
                  onClick={() => {
                    resetEcon();
                    econ.set({ coins: 250 });
                  }}
                >
                  <RotateCcw /> Reset coins
                </button>
              </div>
            </>
          )}

          {tab === "legal" && (
            <>
              <h3 className="set-h">Privacy</h3>
              <p className="set-note">
                NULL has no server and no account database. Your profile, your coins and
                your notes are stored in this browser's local storage and are sent
                nowhere. The only request NULL makes that you did not ask for is the
                proxy window: when you open a site through it, that site is fetched by
                the relay you chose and shown to you rewritten. Nothing about you goes
                with it.
              </p>
              <div className="hair set-hair" />
              <h3 className="set-h">Terms</h3>
              <p className="set-note">
                NULL is a window, not a publisher. Games, apps and sites you open through
                it belong to whoever made them, and their terms apply while you are
                there. Coins and cosmetics have no cash value and exist in one browser
                only: clearing your data clears them. Do not use the proxy to break a
                law you are subject to.
              </p>
              <div className="hair set-hair" />
              <h3 className="set-h">Cookies</h3>
              <p className="set-note">
                No cookies. NULL uses localStorage, which the browser keeps on this
                device and never attaches to a request, so there is nothing to consent
                to and nothing to withdraw.
              </p>
              <div className="hair set-hair" />
              <p className="set-note row">
                <ShieldCheck /> <span>ISC licensed. The source is the documentation.</span>
              </p>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- the cloak pane ----------
   A cloak is a title and an icon on the tab. Picking one changes both; the
   panic key flips it on the spot. */
function CloakPane() {
  const p = useStore(prefs);
  const [showKey, setShowKey] = useState(false);
  const chosen = p.cloak === SMART_ID ? pick("google") : pick(p.cloak);

  return (
    <>
      <h3 className="set-h">Tab cloak</h3>
      <p className="set-note">
        What the tab calls itself: a title and an icon, nothing else. It does not hide
        anything from a network, and saying so is the honest version.
      </p>
      <p className="tiny faint">
        Right now the tab reads <b>{document.title}</b>.
      </p>

      <div className="cloakgrid">
        <button
          className={`cloakcard cloaker--smart${p.cloak === SMART_ID ? " is-on" : ""}`}
          onClick={() => prefs.set({ cloak: SMART_ID })}
        >
          <span className="cloakpic">
            <Sparkles />
          </span>
          <span className="cloakname">
            {p.cloak === SMART_ID && <Check />}
            Smart Cloak
          </span>
          <span className="cloaknote">Picks for you, by the hour and the weekday.</span>
        </button>

        {CLOAKS.map((c) => (
          <button
            key={c.id}
            className={`cloakcard${p.cloak === c.id ? " is-on" : ""}`}
            onClick={() => prefs.set({ cloak: c.id })}
            title={c.title}
          >
            <span className="cloakpic">
              <img src={c.icon} alt="" />
            </span>
            <span className="cloakname">
              {p.cloak === c.id && <Check />}
              {c.name}
            </span>
          </button>
        ))}
      </div>

      <div className="hair set-hair" />
      <h3 className="set-h">Panic key</h3>
      <p className="set-note">
        Press it anywhere and the tab puts the disguise on; press it again and the tab
        goes back to what it was. Smart Cloak draws a fresh one each time, which is what
        makes it worth having.
      </p>
      <label className="setrow">
        <span>
          <b>The key</b>
          <em>One character. Backtick by default, which nothing else uses.</em>
        </span>
        {showKey ? (
          <input
            className="fld panicfld"
            value={p.panicKey}
            maxLength={1}
            autoFocus
            spellCheck={false}
            onBlur={() => setShowKey(false)}
            onChange={(e) => prefs.set({ panicKey: e.target.value })}
          />
        ) : (
          <button className="btn btn--sm mono" onClick={() => setShowKey(true)}>
            {p.panicKey || "none"}
          </button>
        )}
      </label>
      <p className="tiny faint">
        {p.cloak === "off"
          ? "The cloak is off, so the panic key is what turns it on in a hurry."
          : `A press would give you “${chosen.title}”.`}
      </p>
    </>
  );
}

function CustomPalette() {
  const c = prefs.get().custom;
  const fields: [keyof typeof c, string][] = [
    ["bg", "Background"],
    ["bg2", "Surface"],
    ["text", "Text"],
    ["line", "Lines"],
    ["ink", "Accent"],
  ];
  return (
    <div className="setrow setrow--col">
      {fields.map(([k, label]) => (
        <label className="colorfield" key={k}>
          <input
            type="color"
            value={c[k]}
            onChange={(e) => prefs.set({ custom: { ...c, [k]: e.target.value } })}
          />
          <span>{label}</span>
        </label>
      ))}
      <button className="btn btn--sm" onClick={() => prefs.set({ custom: DEFAULT_CUSTOM })}>
        <Zap /> Auto
      </button>
    </div>
  );
}
