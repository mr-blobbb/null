/* NULL · App.tsx
   The shell. It owns the three things that must happen once and only once:
   painting the palette, running the coin clock, and deciding which page the
   active tab is showing.

   The clock pauses whenever the tab is hidden or the keyboard and mouse have
   been still for ninety seconds, which is what "should pause whilst the tab
   is idle" means in practice. */

import { useEffect, useMemo, useRef, useState } from "react";

import { Chrome } from "./components/Chrome";
import { Rail } from "./components/Rail";
import { SettingsSheet } from "./components/SettingsSheet";
import { NotFound } from "./pages/NotFound";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { Proxies } from "./pages/Proxies";
import { Shop } from "./pages/Shop";
import { Profile } from "./pages/Profile";
import { Changelog } from "./pages/Changelog";
import { Extensions } from "./pages/Extensions";
import { Player } from "./pages/Player";

import { applyPalette, applyPerf, prefs, usePalette } from "./lib/themes";
import { useStore } from "./lib/store";
import { IDLE_MS, tick, useEcon } from "./lib/econ";
import { activeTab, go, openTab, targetFromHash, useTabs } from "./lib/tabs";
import { useExt } from "./lib/extensions";

const VERSION = "1.0.0";
const BUILT = "20260917";

export function App() {
  const palette = usePalette();
  const state = useTabs();
  const tab = activeTab(state);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ms, setMs] = useState(0);
  const [milestone, setMilestone] = useState<string | null>(null);

  const startedAt = useRef(performance.now());

  /* palette, then the performance switches, on every change */
  useEffect(() => {
    applyPalette(palette.id);
  }, [palette.id]);

  const perf = useStore(prefs).perf;
  const reduceMotion = useStore(prefs).reduceMotion;
  useEffect(() => {
    applyPerf();
  }, [perf, reduceMotion]);

  /* the coin clock */
  useEffect(() => {
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    ["mousemove", "mousedown", "keydown", "wheel", "touchstart"].forEach((ev) =>
      window.addEventListener(ev, touch, { passive: true }),
    );
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last > IDLE_MS) return;
      const gained = tick();
      if (gained >= 30) setMilestone(`${gained} coins for fifteen minutes on null`);
    }, 1000);
    return () => {
      window.clearInterval(id);
      ["mousemove", "mousedown", "keydown", "wheel", "touchstart"].forEach((ev) =>
        window.removeEventListener(ev, touch),
      );
    };
  }, []);

  useEffect(() => {
    if (!milestone) return;
    const id = window.setTimeout(() => setMilestone(null), 4200);
    return () => window.clearTimeout(id);
  }, [milestone]);

  /* how long this page took to paint, for the readout in the corner */
  useEffect(() => {
    const t = performance.now() - startedAt.current;
    setMs(Math.round(t));
    startedAt.current = performance.now();
  }, [tab.id, tab.nonce]);

  /* the hash a visitor arrived on. An unknown one goes to the 404 rather
     than quietly showing the homepage, which is the whole point of having a
     404 at all. */
  const [lost, setLost] = useState(false);

  useEffect(() => {
    let first = true;
    const apply = () => {
      const raw = location.hash.replace(/^#/, "");
      const t = targetFromHash(location.hash);
      /* An address that means nothing shows the 404. Landing on the homepage
         anyway is the bug this page exists to stop. */
      if (!t) {
        if (raw) setLost(true);
        return;
      }
      setLost(false);
      if (first) {
        first = false;
        if (t.page !== "home") {
          if (t.page === "settings") setSettingsOpen(true);
          else if (t.page === "player" || (t.page === "proxies" && t.arg)) openTab(t);
          else go(t, { replace: true });
        }
        return;
      }
      if (t.page === "settings") setSettingsOpen(true);
      else go(t);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  /* Settings is a sheet, not a page: a tab that somehow ends up on it shows
     the home screen with the sheet over it */
  useEffect(() => {
    if (tab.now.page === "settings") setSettingsOpen(true);
  }, [tab.now.page]);

  const body = useMemo(() => {
    const t = tab.now;
    if (lost) return <NotFound />;
    switch (t.page) {
      case "home":
      case "settings":
        return <Home />;
      case "games":
        return <Library kind="game" />;
      case "apps":
        return <Library kind="app" />;
      case "proxies":
        return <Proxies url={t.arg?.url} />;
      case "shop":
        return <Shop onOpenSettings={() => setSettingsOpen(true)} />;
      case "profile":
        return <Profile />;
      case "changelog":
        return <Changelog />;
      case "extensions":
        return <Extensions />;
      case "player":
        return <Player kind={t.arg?.kind ?? "game"} id={t.arg?.id ?? ""} />;
      default:
        return <NotFound />;
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [tab.now, tab.nonce, lost]);

  const ext = useExt();
  const coins = useEcon().coins;
  const showMeta = useStore(prefs).showMeta;

  return (
    <div className="app">
      <Rail onSettings={() => setSettingsOpen(true)} openSheetCount={0} />
      <div className="work">
        <Chrome onSettings={() => setSettingsOpen(true)} />
        <div className="view">
          <div className="dots" aria-hidden="true" />
          <div key={`${tab.id}-${tab.nonce}`} className="page-host">
            {body}
          </div>
        </div>
      </div>

      {showMeta && (
        <div className="meta">
          <div>Page: {ms} ms</div>
          <div>
            v{VERSION} ∙ {BUILT}
          </div>
        </div>
      )}

      {milestone && <div className="toast">{milestone}</div>}

      {ext.installed.includes("stats") && ext.on.stats && (
        <div className="coinfloat" title="Coin meter (extension)">
          {coins.toLocaleString()}
        </div>
      )}

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export { VERSION, BUILT };
