/* NULL · account.ts
   The account is local: a handle, a salted hash of the password, and the
   profile card around it. The card itself travels: when there is a server to
   ask, signing in pulls the cloud card back over the local one, so a new
   device (or a fresh logout) still has the name, picture, banner, name style
   and shop picks the member chose — see restoreCard(). */

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
  /* Signing up for the account this browser already holds is signing back in.
     The profile stays exactly as it was: a returning player should not lose
     the name, bio and banner they set just because they came through the
     other form. */
  const held = heldHandle();
  if (held && account.get().pass && held.toLowerCase() === user.toLowerCase()) {
    return signIn(user, pass);
  }
  /* A browser holds one account. Starting a second one on top of it would
     throw the first profile away, so it is refused by name rather than done
     quietly. */
  if (held && account.get().pass) {
    return {
      ok: false,
      error: `This browser already holds @${held}. Sign in as @${held}, or delete that account first.`,
    };
  }

  const salt = Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  account.set({
    user,
    handle: user,
    name: user,
    pass: `${salt}$${digest(salt, pass)}`,
    joined: now,
    lastUserChange: now,
    bio: "",
    pfp: null,
    banner: BANNER_DEFAULT,
  });
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
    account.set({
      user: OWNER,
      handle: OWNER,
      name: mine && s.name ? s.name : OWNER,
      pass: `${salt}$${digest(salt, pass)}`,
      joined: mine && s.joined ? s.joined : now,
      lastUserChange: mine && s.lastUserChange ? s.lastUserChange : now,
    });
    void restoreCard(OWNER);
    return { ok: true };
  }
  if (isOwner(user)) return { ok: false, error: "That password is not it." };
  const held = heldHandle();
  if (!held) return { ok: false, error: "There is no account on this browser yet." };
  if (held.toLowerCase() !== user.toLowerCase()) {
    return { ok: false, error: "No account called that here." };
  }
  const [salt, hash] = s.pass.split("$");
  if (digest(salt, pass) !== hash) return { ok: false, error: "That password is not it." };
  /* Signing in clears the lock and nothing else — then the cloud card comes
     down, which is what makes the profile travel between machines. */
  account.set({ user: held, handle: held });
  void restoreCard(held);
  return { ok: true };
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

let pulled = "";

/** Lay the cloud card over this browser's. Called after a successful sign-in
 *  (and after the owner unlock), never throws. */
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

    pulled = key;
    const patch: Record<string, unknown> = {};
    if (card.name && card.name.trim()) patch.name = card.name.trim().slice(0, 40);
    if (typeof card.bio === "string") patch.bio = card.bio.slice(0, 400);
    if (typeof card.banner === "string" && card.banner) patch.banner = card.banner;
    if (card.pfp !== undefined) patch.pfp = card.pfp ?? null;
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

/** Delete: the profile and the handle both go, which frees the name again. */
export function deleteAccount() {
  account.set({ ...EMPTY, joined: Date.now() });
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
  account.set({ user, handle: user, lastUserChange: Date.now() });
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
