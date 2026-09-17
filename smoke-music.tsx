/* Render the shell on the pages this change touched, run the music store the
   way the page does, and check the cloak writes what it says it writes. */
const listeners: Record<string, ((e: unknown) => void)[]> = {};
const links: { rel: string; href: string }[] = [];

const head = { append: (el: { rel: string; href: string }) => links.push(el) };

const linkEl = () => {
  const el = { rel: "", href: "", getAttribute: () => el.href, setAttribute: (_k: string, v: string) => (el.href = v) };
  return el;
};

const g = globalThis as unknown as Record<string, unknown>;
g.location = { hash: "", origin: "https://null.test", pathname: "/" };
g.history = { pushState() {} };
g.window = {
  addEventListener: (n: string, fn: (e: unknown) => void) => (listeners[n] = [...(listeners[n] ?? []), fn]),
  removeEventListener() {},
  setInterval: () => 0,
  clearInterval() {},
  setTimeout: () => 0,
  clearTimeout() {},
  open() {},
};
g.document = {
  title: "null",
  visibilityState: "visible",
  documentElement: { dataset: {} },
  head,
  createElement: (tag: string) => (tag === "link" ? linkEl() : { style: {} }),
  querySelector: () => links[0] ? Object.assign(linkEl(), { rel: "icon", href: links[0].href }) : null,
  addEventListener() {},
  removeEventListener() {},
};
g.getComputedStyle = () => ({ getPropertyValue: () => "", fontFamily: "Inter" });

/* a stand-in for the audio element: enough of it for the engine to run */
g.Audio = class {
  volume = 1;
  preload = "";
  src = "";
  currentTime = 0;
  duration = 0;
  paused = true;
  addEventListener() {}
  removeAttribute() {
    this.src = "";
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
};

const { renderToString } = await import("react-dom/server");
const { App } = await import("./src/App");
const { go } = await import("./src/lib/tabs");
const { account } = await import("./src/lib/account");
const { econ } = await import("./src/lib/econ");
const musicLib = await import("./src/lib/music");
const cloak = await import("./src/lib/cloak");

let bad = 0;
const ok = (name: string, pass: boolean) => {
  if (!pass) bad++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name}`);
};
const draw = (page: Parameters<typeof go>[0]) => {
  go(page);
  return renderToString(<App />).replace(/<!-- -->/g, "");
};

/* 1 · the music page */
let html = draw({ page: "music" });
ok("music page renders", html.includes(">Music<"));
ok("the sources are all there", ["Qobuz", "SoundCloud", "YouTube Music", "Keyless catalogue"].every((s) => html.includes(s)));
ok("Qobuz is the default", html.includes("mu-source is-on\">Qobuz"));
ok("the transport is there", html.includes("mu-seek") && html.includes("mu-btn--big"));
ok("playlists can be made", html.includes("New</button>"));
ok("the key fields are there", html.includes("your-qobuz-app-id"));

/* 2 · the music engine itself */
musicLib.setSource("qobuz");
const found = await musicLib.search("daft punk", "qobuz");
ok("keyless search returns real tracks", found.tracks.length > 0);
ok("they carry a stream", found.tracks.every((t) => !!t.audio));
ok("and it says why Qobuz was skipped", !!found.note && found.note.includes("Qobuz needs its app id"));
const first = found.tracks[0];
ok("tracks are mapped properly", !!first.title && !!first.artist && first.source === "keyless");

musicLib.play(first, found.tracks);
ok("playing sets the queue", musicLib.music.get().queue.length === found.tracks.length);
ok("and remembers it", musicLib.music.get().recent[0]?.key === first.key);

const pl = musicLib.newPlaylist("Late night");
musicLib.addToPlaylist(pl, first);
ok("a playlist takes a track", musicLib.playlistOf(pl)?.tracks.length === 1);
musicLib.toggleFavorite(first);
ok("favourites fill", musicLib.music.get().favorites.length === 1);
musicLib.setShuffle(true);
const shuffled = musicLib.music.get();
ok("shuffle keeps the current track first", shuffled.queue[0]?.key === first.key);
ok("and keeps the full list", shuffled.queue.length === found.tracks.length);
musicLib.setShuffle(false);
ok("unshuffling restores the order", musicLib.music.get().queue.map((t) => t.key).join() === found.tracks.map((t) => t.key).join());
ok("the clock formats", musicLib.clock(185) === "3:05" && musicLib.clock(0) === "—");
musicLib.clearQueue();
ok("the queue can be cleared", musicLib.music.get().queue.length === 0 && musicLib.music.get().now === null);

/* 3 · the cloak */
ok("the cloak list is the long one", cloak.CLOAKS.length >= 15);
ok("smart cloak picks from the list", cloak.CLOAKS.some((c) => c.id === cloak.smartPick(new Date(2026, 8, 17, 10)).id));
ok("off means off", cloak.cloakFor("off", false).id === "off");
ok("a chosen cloak is honoured", cloak.cloakFor("classroom", false).title === "Classes");
ok("the panic key overrides the setting", cloak.cloakFor("off", true).id !== "off");
cloak.applyCloak(cloak.pick("docs"));
ok("the document title is cloaked", (g.document as { title: string }).title === "Untitled document - Google Docs");
ok("and an icon link exists", links.length > 0 && links[0].href.startsWith("data:image/svg+xml"));
ok("every disguise has an icon", cloak.CLOAKS.every((c) => c.icon.length > 10));

/* 4 · movies runs through the rewritten window now */
html = draw({ page: "movies" });
ok("movies uses the browser window", html.includes("Starting the browser"));
ok("movies is addressed as null://m", html.includes("null://m"));
ok("no open-in-a-tab affordance anywhere on it", !/real tab/i.test(html));

/* 5 · the rail order: movies, then music */
html = draw({ page: "home" });
const rail = /<nav class="rail"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
ok("rail has the music door", rail.includes('aria-label="Music"'));
ok("music sits directly under movies", rail.indexOf('aria-label="Movies"') < rail.indexOf('aria-label="Music"'));
ok("and above the shop", rail.indexOf('aria-label="Music"') < rail.indexOf('aria-label="Shop"'));

/* 6 · the default face is NULL's own, not a glyph */
html = draw({ page: "profile" });
account.set({ user: "blob", name: "blob", joined: Date.now(), pass: "x$y", pfp: null });
econ.set({ equipped: { avatar: "chroma", effect: "galaxy", tag: "tstar" } });
html = draw({ page: "profile" });
ok("the profile shows the mark", html.includes('class="nf"'));
ok("and not a silhouette", !html.includes("lucide-user-round"));
ok("the clip decoration is still on the picture", html.includes('class="art-video" src="decor/avatar-chroma.mp4"'));

/* 7 · the toolbar player is wired to the engine */
ok("the mini player reads the engine", draw({ page: "home" }).includes("Not Playing"));
musicLib.play(first, found.tracks);
ok("and shows what is playing", draw({ page: "home" }).includes(first.title));

console.log(bad ? `\n${bad} FAILURES` : "\nall good");
