/* NULL · account.ts
   The account is local: a handle, a salted hash of the password, and the
   profile card around it. The card itself travels: when there is a server to
   ask, signing in pulls the cloud card back over the local one, so a new
   device (or a fresh logout) still has the name, picture, banner, name style
   and shop picks the member chose — see restoreCard().

   Several accounts live on one device, and they are kept whole. The book in
   `null:accounts` holds every account ever made here, keyed by handle, and
   `null:account` is only whichever one *this tab* is signed into — so signing
   out, signing back in, or making a second account never costs anybody the
   profile they already had, and two tabs can be two different people. Which
   account a tab holds is remembered in sessionStorage, which is per tab, not
   per browser. See `the account book` below. */

import { createStore, useStore } from "./store";
import { OWNER, isOwner, ownerCred } from "./owner";

export type NameMode = "solid" | "gradient";

export type NameStyle = {
  mode: NameMode;
  c1: string;
  c2: string;
  glow: boolean;
  glowColor: string;
  font: string;
};

export type Recent = { kind: "game" | "app"; id: string; at: number };

export type Account = {
  /** the handle without the @, or null when signed out */
  user: string | null;
  /** The handle this browser holds, signed in or not. `user` is the lock;
   *  this is the account behind it, so signing out does not make the profile
   *  unreachable. */
  handle: string;
  name: string;
  bio: string;
  /** any CSS background value: a colour, a gradient or an image url */
  banner: string;
  pfp: string | null;
  pass: string;
  joined: number;
  nameStyle: NameStyle;
  /** the two colours behind the player card, or null for none */
  card: { top: string; bottom: string } | null;
  lastBackup: number;
  lastUserChange: number;
  favorites: string[];
  recent: Recent[];
  /** who may see what this person is doing right now, on their card */
  activityVisible: "everyone" | "friends" | "nobody";
  /** what this browser is, as src/lib/device.ts reads it. Only ever sent to
   *  the directory when `deviceVisible` is on */
  device: string | null;
  deviceVisible: boolean;
};

export const BANNER_DEFAULT =
  "linear-gradient(135deg, #6d4bd8 0%, #4a4a58 55%, #2e2e33 100%)";

export const BANNER_SWATCHES = [
  "#6d4bd8",
  "#3f7fd8",
  "#3fb98a",
  "#d8a13f",
  "#d85f4b",
  "#b04bd8",
  "#4b4b52",
  "#1f1f24",
];

export const NAME_FONTS: { id: string; name: string; css: string }[] = [
  { id: "default", name: "Default (Inter)", css: "var(--font)" },
  { id: "bungee", name: "Bungee", css: "var(--font-bungee)" },
  { id: "caveat", name: "Caveat", css: "var(--font-caveat)" },
  { id: "silkscreen", name: "Silkscreen", css: "var(--font-silkscreen)" },
  { id: "pacifico", name: "Pacifico", css: "var(--font-pacifico)" },
  { id: "gochi", name: "Gochi Hand", css: "var(--font-gochi)" },
  { id: "playfair", name: "Playfair Display", css: "var(--font-playfair)" },
  { id: "pressstart", name: "Press Start 2P", css: "var(--font-press)" },
  { id: "spacemono", name: "Space Mono", css: "var(--font-space)" },
];

const EMPTY: Account = {
  user: null,
  handle: "",
  name: "",
  bio: "",
  banner: BANNER_DEFAULT,
  pfp: null,
  pass: "",
  joined: 0,
  nameStyle: {
    mode: "solid",
    c1: "#f4f4f5",
    c2: "#7aa2ff",
    glow: false,
    glowColor: "#7aa2ff",
    font: "default",
  },
  card: null,
  lastBackup: 0,
  lastUserChange: 0,
  favorites: [],
  recent: [],
  activityVisible: "everyone",
  device: null,
  deviceVisible: true,
};

export const account = createStore<Account>("account", EMPTY);

/* A browser that has been here since before `handle` existed still has the
   profile on it, so the handle is taken from the fields that did exist. A
   player who had renamed themselves and then signed out may be guessed at
   wrongly, which is the best a machine that never stored the handle can do. */
const stored = account.get();
if (!stored.handle && stored.pass) {
  account.set({ handle: stored.user || stored.name });
}

/* ---------- the book ----------
   Every account made on this device, whole, under its handle. The live
   account mirrors into it on every write, which is what makes signing out
   cost nothing: the lock comes off the record, the record stays. */
const book = createStore<Record<string, Account>>("accounts", {});

/** Where this tab's account is remembered. Per tab, not per browser, so two
 *  tabs can hold two people. */
const TAB_KEY = "null:session";

function tabHandle(): string {
  try {
    return keyOf(sessionStorage.getItem(TAB_KEY) ?? "");
  } catch {
    return "";
  }
}

function setTab(handle: string) {
  try {
    if (handle) sessionStorage.setItem(TAB_KEY, handle);
    else sessionStorage.removeItem(TAB_KEY);
  } catch {
    /* a browser that refuses sessionStorage still has the live account */
  }
}

/** True when the two records carry the same values, so an unchanged live
 *  account does not rewrite the book on every keystroke elsewhere. */
function same(a: Account, b: Account): boolean {
  return (Object.keys(b) as (keyof Account)[]).every((k) => a[k] === b[k]);
}

function mirror(live: Account) {
  const k = keyOf(live.handle || live.user || "");
  if (!k) return;
  const all = book.get();
  const before = all[k];
  if (before && same(before, live)) return;
  book.set({ ...all, [k]: { ...live, handle: live.handle || k } });
}

account.subscribe(() => mirror(account.get()));

/* Which account this tab starts as: the one it was last signed into on this
   tab, else whatever the browser was holding, which is also what a brand new
   tab gets. A device upgrading from the one-account version adopts that
   account into the book on the way through. */
(function boot() {
  const live = account.get();
  const all = book.get();
  const want = tabHandle();

  if (want && all[want]) {
    account.set({ ...EMPTY, ...all[want] });
    return;
  }
  const held = keyOf(live.handle || live.user || "");
  if (held) {
    if (!all[held]) book.set({ ...all, [held]: { ...live, handle: live.handle || held } });
    setTab(held);
  }
})();

export function useAccount(): Account {
  return useStore(account);
}

/** The handle this browser holds, whether or not it is signed in right now. */
export function heldHandle(): string {
  const s = account.get();
  return s.handle || s.user || "";
}

/* ---------- passwords ----------
   Not cryptography: a salted digest that keeps a typed password out of
   localStorage in plain sight. There is no server here to authenticate
   against, and saying so is better than pretending. */
function digest(salt: string, pass: string): string {
  let h = 2166136261 ^ salt.length;
  const s = `${salt}::${pass}::${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let h2 = 5381;
  for (let i = s.length - 1; i >= 0; i--) h2 = (h2 * 33) ^ s.charCodeAt(i);
  return ((h >>> 0) * 4294967296 + (h2 >>> 0)).toString(36);
}

export const USER_RULE = /^[A-Za-z0-9._-]{3,20}$/;

export function checkUser(user: string): string | null {
  if (user.length < 3) return "At least 3 characters.";
  if (user.length > 20) return "20 characters at most.";
  if (!USER_RULE.test(user)) return "Letters, numbers, . - and _ only.";
  return null;
}

export function signUp(user: string, pass: string, confirm: string): { ok: boolean; error?: string } {
  const bad = checkUser(user);
  if (bad) return { ok: false, error: bad };
  /* the owner's name is taken, and that is the end of it */
  if (isOwner(user)) return { ok: false, error: "That name is taken." };
  if (pass.length < 4) return { ok: false, error: "Passwords need 4 characters." };
  if (pass !== confirm) return { ok: false, error: "Those passwords do not match." };

  /* An account with this handle is already on the device — this is that person
     coming back through the other form. It takes the password it was made
     with, and nothing about their profile is touched. */
  const k = keyOf(user);
  if (book.get()[k]) return signIn(user, pass);

  const salt = Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  /* a whole record, not a patch: EMPTY first, so nothing of the account that
     was live a moment ago leaks into this one */
  account.set({
    ...EMPTY,
    user,
    handle: user,
    name: user,
    pass: `${salt}$${digest(salt, pass)}`,
    joined: now,
    lastUserChange: now,
  });
  setTab(user);
  /* a handle the directory already knows gets its card back: that is how a new
     device picks up the picture and banner that were set on another one */
  void restoreCard(user);
  return { ok: true };
}

export function signIn(user: string, pass: string): { ok: boolean; error?: string } {
  const s = account.get();
  /* The owner's name and password open on any browser, first time and every
     time, and no other password ever opens this name. */
  if (ownerCred(user, pass)) {
    const mine = isOwner(s.user);
    const now = Date.now();
    const salt = Math.random().toString(36).slice(2, 10);
    /* whatever the owner left on this device last time, so unlocking does not
       reset the name and banner they set */
    const was = book.get()[keyOf(OWNER)];
    account.set({
      ...EMPTY,
      ...(was ?? {}),
      user: OWNER,
      handle: OWNER,
      name: mine && s.name ? s.name : (was?.name ?? OWNER),
      pass: `${salt}$${digest(salt, pass)}`,
      joined: mine && s.joined ? s.joined : (was?.joined ?? now),
      lastUserChange: mine && s.lastUserChange ? s.lastUserChange : (was?.lastUserChange ?? now),
    });
    setTab(OWNER);
    void restoreCard(OWNER);
    return { ok: true };
  }
  if (isOwner(user)) return { ok: false, error: "That password is not it." };

  const k = keyOf(user);
  const rec = book.get()[k];
  /* the accounts this browser remembers, by the name on them: no record means
     there is nothing here to open, and the way in is to sign up with the same
     handle, which pulls the cloud card down with it */
  if (!rec) {
    return { ok: false, error: `No account called @${k} is kept on this browser. Sign up with that handle to bring it back.` };
  }
  const [salt, hash] = rec.pass.split("$");
  if (!salt || digest(salt, pass) !== hash) return { ok: false, error: "That password is not it." };

  /* Signing in swaps which account is live and clears its lock — the record,
     and every other account on the device, is left exactly as it was. Then
     the cloud card comes down, which is what makes a profile travel. */
  account.set({ ...EMPTY, ...rec, user: rec.handle || k });
  setTab(k);
  void restoreCard(k);
  return { ok: true };
}

/* ============================================================
   the account book
   ============================================================ */

/** One row in the book, for the list on the sign-in card. */
export type KnownAccount = {
  handle: string;
  name: string;
  pfp: string | null;
  /** true for the account this tab is signed into right now */
  live: boolean;
};

/* a function declaration rather than a const, because the book's boot step
   runs at module load and needs this before its line */
function keyOf(user: string): string {
  return user.replace(/^@/, "").trim().toLowerCase();
}

export function hasAccount(): boolean {
  return !!account.get().user;
}

/* ---------- the travelling card ----------

   Accounts are locks on a browser; the profile card is on the server. Signing
   in on a machine that has never seen the handle would otherwise start from
   defaults, so the sign-in path asks the directory for the card and lays it
   over the local one. Every field the profile page edits comes back with it.

   The server holds the truth for name, bio, banner, picture, name style and
   what the shop has equipped; coins and owned items are deliberately local
   (the coin clock runs per browser), so only the equipped picks are taken. */

/** One field back from the cloud card, or null when there is nothing there. */
type CloudCard = {
  name?: string;
  bio?: string;
  banner?: string;
  pfp?: string | null;
  nameStyle?: string;
  wearing?: { avatar: string | null; effect: string | null; tags: string[] };
};

/** Lay the cloud card over this browser's. Called after a successful sign-in
 *  (and after the owner unlock), never throws.
 *
 *  The directory holds the truth, so most fields come down as they are — but
 *  the display name is the exception, because its default *is* the handle.
 *  A card that was published before somebody renamed themselves still says
 *  "@them" in that field, and laying that over a name they chose turned a
 *  rename into a reset every time they logged back in. A local name that is
 *  neither empty nor the handle was typed on purpose, and it stands. */
export async function restoreCard(user: string): Promise<void> {
  const key = user.replace(/^@/, "").trim().toLowerCase();
  if (!key) return;
  try {
    const { cloud } = await import("./cloud");
    const { api } = await import("../../convex/_generated/api");
    const c = cloud();
    if (!c) return;
    const card = (await c.query(api.members.card, { user: key })) as CloudCard | null;
    if (!card) return;

    const mine = account.get();
    const handle = keyOf(mine.handle || mine.user || "");
    const typed = (mine.name ?? "").trim();
    const patch: Record<string, unknown> = {};
    if (card.name && card.name.trim() && (!typed || keyOf(typed) === handle)) {
      patch.name = card.name.trim().slice(0, 40);
    }
    if (typeof card.bio === "string") patch.bio = card.bio.slice(0, 400);
    if (typeof card.banner === "string" && card.banner) patch.banner = card.banner;
    /* the same rule for the picture: a card that carries none does not get to
       take away one that is on this browser already */
    if (card.pfp) patch.pfp = card.pfp;
    if (typeof card.nameStyle === "string" && card.nameStyle) {
      try {
        const style = JSON.parse(card.nameStyle);
        if (style && typeof style === "object") patch.nameStyle = { ...account.get().nameStyle, ...style };
      } catch {
        /* a style that will not parse is a style nobody set on purpose */
      }
    }
    if (card.wearing) {
      const { econ } = await import("./econ");
      econ.set({
        equipped: {
          avatar: card.wearing.avatar ?? null,
          effect: card.wearing.effect ?? null,
          tags: Array.isArray(card.wearing.tags) ? card.wearing.tags.slice(0, 2) : [],
        },
      });
    }
    if (Object.keys(patch).length) account.set(patch);
  } catch {
    /* offline, or the deployment is having a day: the local card stands */
  }
}

/** Lock the account; keep everything in it. The name a player set, their bio,
 *  banner, picture, favourites and coins all stay on the machine, and signing
 *  back in puts them back where they were rather than back at the start. */
export function signOut() {
  account.set({ user: null });
}

/** Delete: this one account goes out of the book and the name is free again.
 *  Every other account on the device is left alone. */
export function deleteAccount() {
  const k = keyOf(account.get().handle || account.get().user || "");
  /* `del`, not a copy with the key left out: the store merges a patch into
     what is already there, so the missing key simply came back and the
     account stayed deletable and stayed on the sign-in card */
  if (k) book.del(k);
  setTab("");
  account.set({ ...EMPTY, joined: Date.now() });
}

/** The accounts this browser keeps, for the list under the sign-in form. */
export function knownAccounts(): KnownAccount[] {
  const live = keyOf(account.get().user || "");
  return Object.values(book.get())
    .filter((a) => !!a.pass && !!(a.handle || a.user))
    .map((a) => ({
      handle: a.handle || a.user || "",
      name: a.name || a.handle || a.user || "",
      pfp: a.pfp ?? null,
      live: keyOf(a.handle || a.user || "") === live,
    }))
    .sort((a, b) => a.handle.localeCompare(b.handle));
}

export function changePassword(oldPass: string, pass: string, confirm: string): { ok: boolean; error?: string } {
  const s = account.get();
  const [salt, hash] = s.pass.split("$");
  if (digest(salt, oldPass) !== hash) return { ok: false, error: "That password is not it." };
  if (pass.length < 4) return { ok: false, error: "Passwords need 4 characters." };
  if (pass !== confirm) return { ok: false, error: "Those passwords do not match." };
  const next = Math.random().toString(36).slice(2, 10);
  account.set({ pass: `${next}$${digest(next, pass)}` });
  return { ok: true };
}

export function changeUser(user: string): { ok: boolean; error?: string } {
  const bad = checkUser(user);
  if (bad) return { ok: false, error: bad };
  const s = account.get();
  if (isOwner(user) && !isOwner(s.user)) return { ok: false, error: "That name is taken." };
  const wait = 14 * 24 * 60 * 60 * 1000;
  const since = Date.now() - s.lastUserChange;
  if (s.lastUserChange && since < wait) {
    const days = Math.ceil((wait - since) / (24 * 60 * 60 * 1000));
    return { ok: false, error: `You can change this again in ${days} day${days === 1 ? "" : "s"}.` };
  }
  /* the record moves with the handle: the new key is written by the mirror on
     the line above, and the old one goes, so the book never holds a ghost */
  const from = keyOf(s.handle || s.user || "");
  account.set({ user, handle: user, lastUserChange: Date.now() });
  setTab(user);
  /* the same merge would leave the old handle behind as a ghost record that
     still had a password on it */
  if (from && from !== keyOf(user)) book.del(from);
  return { ok: true };
}

export function verifyPassword(pass: string): boolean {
  const s = account.get();
  if (!s.pass) return false;
  const [salt, hash] = s.pass.split("$");
  return digest(salt, pass) === hash;
}

/* ---------- library bits ---------- */
export function isFavorite(id: string): boolean {
  return account.get().favorites.includes(id);
}

export function toggleFavorite(id: string) {
  const s = account.get();
  account.set({
    favorites: s.favorites.includes(id)
      ? s.favorites.filter((f) => f !== id)
      : [...s.favorites, id],
  });
}

export function pushRecent(kind: Recent["kind"], id: string) {
  const s = account.get();
  const rest = s.recent.filter((r) => !(r.kind === kind && r.id === id));
  account.set({ recent: [{ kind, id, at: Date.now() }, ...rest].slice(0, 24) });
}

export function markBackup() {
  account.set({ lastBackup: Date.now() });
}

/** A display-name style turned into inline CSS for wherever the name shows. */
export function nameStyleCss(style: NameStyle): React.CSSProperties {
  const font = NAME_FONTS.find((f) => f.id === style.font) ?? NAME_FONTS[0];
  const css: React.CSSProperties = { fontFamily: font.css };
  if (style.mode === "gradient") {
    css.backgroundImage = `linear-gradient(120deg, ${style.c1}, ${style.c2})`;
    css.WebkitBackgroundClip = "text";
    css.backgroundClip = "text";
    css.color = "transparent";
  } else {
    css.color = style.c1;
  }
  if (style.glow) {
    css.filter = `drop-shadow(0 0 10px ${style.glowColor})`;
  }
  return css;
}
