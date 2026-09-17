/* NULL · SettingsSheet.tsx
   Settings is not a page. It opens over whatever is already on screen, so
   changing a theme never loses your place. Three tabs down the side:
   Appearance, Data, and the paperwork. */

import { useState } from "react";
import {
  Check,
  Database,
  FileText,
  Palette,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";

import { Sheet } from "./Sheet";
import { DEFAULT_CUSTOM, PALETTES, prefs, usePalette, type PaletteId } from "../lib/themes";
import { allKeys, removeKey, useStore } from "../lib/store";
import { econ, resetEcon } from "../lib/econ";
import { account } from "../lib/account";

type Tab = "appearance" | "data" | "legal";

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
                  <em>The “Page: N ms” line in the bottom corner.</em>
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
            </>
          )}

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
