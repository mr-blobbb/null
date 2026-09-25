/* NULL · App.tsx
   The shell. It owns the three things that must happen once and only once:
   painting the palette, running the coin clock, and deciding which page the
   active tab is showing.

   The clock pauses whenever the tab is hidden or the keyboard and mouse have
   been still for ninety seconds, which is what "should pause whilst the tab
   is idle" means in practice. */

import { useEffect, useMemo, useRef, useState } from "react";

import { Ambient } from "./components/Ambient";
import { Chrome } from "./components/Chrome";
import { Guard } from "./components/Guard";
import { CtxMenu } from "./components/CtxMenu";
import { Rail } from "./components/Rail";
import { SettingsSheet, type SettingsTab } from "./components/SettingsSheet";
import { NotFound } from "./pages/NotFound";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { Proxies } from "./pages/Proxies";
import { Shop } from "./pages/Shop";
import { Members } from "./pages/Members";
import { Richest } from "./pages/Richest";
import { Ai } from "./pages/Ai";
import { Chat } from "./pages/Chat";
import { Music } from "./pages/Music";
import { Profile } from "./pages/Profile";
import { Changelog } from "./pages/Changelog";
import { Player } from "./pages/Player";

import { applyPalette, applyPerf, prefs, usePalette } from "./lib/themes";
import { applyCloak, cloakFor } from "./lib/cloak";
import { useStore } from "./lib/store";
import { IDLE_MS, tick, useEcon } from "./lib/econ";
import { account, useAccount } from "./lib/account";
import { publish } from "./lib/members";
import { detectDevice } from "./lib/device";
import { usePulse } from "./lib/friends";
import { needsCloud, PAGES } from "./lib/nav";
import { CloudDown, serverlessNow, useServerless } from "./lib/outage";
import { activeTab, go, openTab, selectSplitPane, targetFromHash, useTabs } from "./lib/tabs";
import { overlayExtensions, useExt } from "./lib/extensions";
import { useJamWatch } from "./lib/jam";
import { watchLibrary } from "./lib/music";

const VERSION = "1.3.1";
const BUILT = "20260925";

export function App() {
  const palette = usePalette();
  const state = useTabs();
  const tab = activeTab(state);
  /* Is the shared side of the site available? Either the deployment stopped
     answering, or somebody asked for the backendless build in Settings. The
     doors that need it come off the rail and the pages behind them say so
     instead of throwing. */
  const offline = useServerless();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("appearance");
  const openSettings = (tab: SettingsTab = "appearance") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  /* the right-click menu asks for the themes pane without knowing what a
     settings sheet is: one event, one listener, here where the sheet lives */
  useEffect(() => {
    const ask = () => openSettings("appearance");
    document.addEventListener("null:settings", ask);
    return () => document.removeEventListener("null:settings", ask);
  }, []);
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

  /* the tab cloak: what the tab strip calls this page, and the key that puts
     the disguise on the moment you need it (src/lib/cloak.ts) */
  const cloak = useStore(prefs).cloak;
  const panicKey = useStore(prefs).panicKey;
  const [panic, setPanic] = useState(false);

  useEffect(() => {
    applyCloak(cloakFor(cloak, panic));
  }, [cloak, panic]);

  useEffect(() => {
    if (!panicKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== panicKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      setPanic((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panicKey]);

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

  /* the hash a visitor arrived on. An unknown one is now itself a target —
     the 404 page carrying the address that missed — rather than a flag that
     quietly showed the homepage at an address that does not exist. */
  useEffect(() => {
    let first = true;
    const apply = () => {
      const t = targetFromHash(location.hash);
      if (!t) return;
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

  const bodyFor = (t: typeof tab) => {
    /* A cloud door opened in the backendless build shows the honest card
       rather than the page: the page's first act would be a query against a
       server that is not there, and a throw here takes the tab with it. */
    if (offline && needsCloud(t.now.page)) return <CloudDown what={PAGES[t.now.page].name} />;
    switch (t.now.page) {
      case "missing":
        return <NotFound address={t.now.arg?.url} />;
      case "home":
      case "settings":
        return <Home />;
      case "games":
        return <Library kind="game" />;
      case "apps":
        return <Library kind="app" />;
      case "movies":
        /* aether.cx refuses to be framed (`x-frame-options: DENY`), so the
           movies door is the rewritten window like any other address */
        return <Proxies url={PAGES.movies.loads} back="home" tabTitle="Movies" onOpenSettings={() => openSettings("browser")} />;
      case "minecraft":
        return <Proxies url={PAGES.minecraft.loads} back="home" tabTitle="Minecraft" onOpenSettings={() => openSettings("browser")} />;
      case "proxies":
        return <Proxies url={t.now.arg?.url} onOpenSettings={() => openSettings("browser")} />;
      case "shop":
        return <Shop onOpenSettings={() => setSettingsOpen(true)} />;
      case "music":
        return <Music />;
      case "ai":
        return <Ai />;
      case "chat":
        return <Chat />;
      case "rich":
        return <Richest />;
      case "users":
        return <Members />;
      case "profile":
        return <Profile />;
      case "changelog":
        return <Changelog />;
      case "player":
        return <Player kind={t.now.arg?.kind ?? "game"} id={t.now.arg?.id ?? ""} />;
      default:
        return <NotFound />;
    }
  };

  const body = useMemo(() => bodyFor(tab), [tab, offline]);
  /* Game players are stateful documents (canvas, WebGL workers, audio, and
     saves). Keep one mounted instance per tab instead of destroying the
     player whenever the browser tab changes. A nonce still creates a fresh
     instance when the user explicitly reloads it. */
  const gameTabs = useMemo(
    () => state.tabs.filter((t) => t.now.page === "player"),
    [state.tabs],
  );
  const split = state.split;
  const leftTab = split ? state.tabs.find((t) => t.id === split.left) : undefined;
  const rightTab = split ? state.tabs.find((t) => t.id === split.right) : undefined;

  const coins = useEcon().coins;
  const showMeta = useStore(prefs).showMeta;

  /* Keep the member card on the server as fresh as the coins are, so the
     leaderboard is not showing a number from last Tuesday. One write a
     minute, and only while signed in. */
  const me = useAccount();
  const eco = useEcon();
  const lastSent = useRef(0);

  /* What this browser is, worked out once and kept on the account. It is only
     ever shown when the member leaves the chip on, and it is what their card
     prints instead of "unknown device" — see src/lib/device.ts. */
  useEffect(() => {
    if (!me.user) return;
    const label = detectDevice().label;
    if (account.get().device !== label) account.set({ device: label });
  }, [me.user]);

  useEffect(() => {
    /* the leaderboard keeps itself fresh, which is a write — and there is
       nowhere to write it in the backendless build */
    if (!me.user || serverlessNow()) return;
    const send = () => {
      if (eco.coins === lastSent.current) return;
      lastSent.current = eco.coins;
      void publish(me, eco);
    };
    send();
    const id = window.setInterval(send, 60_000);
    return () => window.clearInterval(id);
  }, [me, eco]);


  return (
    <div className="app">
      <Rail onSettings={() => setSettingsOpen(true)} openSheetCount={0} />
      <div className="work">
        <Chrome onSettings={() => setSettingsOpen(true)} />
        <div className="view">
          {/* the fog sits under the dot grid, which sits under the page */}
          <Ambient />
          <div className="dots" aria-hidden="true" />
          {/* Four pages own the whole window rather than scrolling inside
              it: the front door, the chat rooms, the assistant, and the
              messages page. The shell says so once, here, instead of every
              page guessing its height. */}
          {split && leftTab && rightTab ? (
            <div className="split-view" aria-label="Split page view">
              <section
                className={`split-pane${split.focus === "left" ? " is-focused" : ""}`}
                onMouseDown={() => selectSplitPane(leftTab.id)}
              >
                <div className="split-pane-body">{bodyFor(leftTab)}</div>
              </section>
              <section
                className={`split-pane${split.focus === "right" ? " is-focused" : ""}`}
                onMouseDown={() => selectSplitPane(rightTab.id)}
              >
                <div className="split-pane-body">{bodyFor(rightTab)}</div>
              </section>
            </div>
          ) : (
            <div
              className={`page-host${
                tab.now.page === "home" || tab.now.page === "chat" || tab.now.page === "ai" ? " page-host--fit" : ""
              }`}
            >
              {/* One page falling over is that page's problem. Without this
                  the error reached main.tsx's guard, which replaces the
                  whole site — rail, chrome and sign-in card included — and a
                  backend having a day became a site nobody could sign in
                  to. */}
              <div className="page-layer">
                {tab.now.page !== "player" && (
                  <Guard what={PAGES[tab.now.page].name}>
                    {body}
                  </Guard>
                )}
              </div>
              <div className="game-tab-stack" aria-live="off">
                {gameTabs.map((gameTab) => (
                  <div
                    key={`${gameTab.id}-${gameTab.nonce}`}
                    className={`game-tab-instance${gameTab.id === tab.id ? " is-active" : ""}`}
                    aria-hidden={gameTab.id !== tab.id}
                  >
                    {bodyFor(gameTab)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* the page-time and build stamp belong to the front door only: every
          other page is a real page and should not look like a debug overlay */}
      {showMeta && tab.now.page === "home" && (
        <div className="meta">
          <div>Page: {ms} ms</div>
          <div>
            v{VERSION} ∙ {BUILT}
          </div>
        </div>
      )}

      {milestone && <div className="toast">{milestone}</div>}

      {/* The beats that need the server, in a component of their own so a
          deployment that is switched off takes them out and nothing else.
          In the backendless build they are not started at all: presence,
          the jam and the music shelf all open a socket on mount. */}
      {!offline && (
        <Guard what="the shared side" fallback={null}>
          <CloudBeats user={me.user} />
        </Guard>
      )}

      <OverlayExts coins={coins} />

      <CtxMenu />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initial={settingsTab}
      />
    </div>
  );
}

/** Presence, the listen-along jam, and the kept music shelf: three things
 *  that talk to the server and none of which anyone needs before they are
 *  signed in. Kept apart from the shell for the reason in the guard above. */
function CloudBeats({ user }: { user: string | null }) {
  /* the presence beat: this page says "still me" every forty-five seconds,
     which is what draws the green dot beside a name */
  usePulse(user);
  /* A jam runs from the shell, not from the music page: the point of
     listening together is that you can wander off to the games and it keeps
     playing. */
  useJamWatch(user);
  /* And the kept music follows the account rather than the machine: sign in
     and the shelf is merged, sign out and it stays where it is. */
  useEffect(() => {
    watchLibrary(user);
  }, [user]);
  return null;
}

/** The chips extensions float over the page. They are deliberately the only
 *  place an add-on draws by itself — everything else an extension does, it
 *  does inside a surface the page gave it. */
function OverlayExts({ coins }: { coins: number }) {
  const ext = useExt();
  const [now, setNow] = useState(() => new Date());
  const live = ext.installed.includes("clock") && ext.on.clock !== false;

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  const on = overlayExtensions();
  if (!on.length) return null;

  return (
    <div className="floats">
      {on.map((e) =>
        e.id === "clock" ? (
          <span className="coinfloat" key={e.id} title="Clock (extension)">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : e.id === "stats" ? (
          <span className="coinfloat" key={e.id} title="Coin meter (extension)">
            {coins.toLocaleString()}
          </span>
        ) : null,
      )}
    </div>
  );
}

export { VERSION, BUILT };
