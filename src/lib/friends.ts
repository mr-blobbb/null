/* NULL · friends.ts
   Friends, and the beat that keeps them honest.

   Two jobs that belong together, because a friends list without presence is
   just a list of names:

   · **the graph** — requests out, requests in, and the mutuals that are
     friends. The server side is convex/friends.ts, and there is no separate
     friend table there: two follows pointing at each other are a friendship.
   · **presence** — this browser says "still me" every forty-five seconds, and
     anybody whose last word was inside the server's online window counts as
     here. The beat is a two-field write rather than a whole member card,
     which is what makes it cheap enough to run for three hours straight.

   With no server both halves quietly do nothing, which is the rule the rest
   of NULL follows: a browser with no network is a normal browser. */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { cloud, cloudOn } from "./cloud";
import { createStore } from "./store";

export type Brief = {
  user: string;
  name: string;
  pfp: string | null;
  nameStyle: string;
  roles: string[];
  verified: boolean;
  owner: boolean;
  online: boolean;
  seen: number;
  banned: boolean;
  /** only on the pending lists */ at?: number;
};

export type Graph = { friends: Brief[]; incoming: Brief[]; outgoing: Brief[] };

const EMPTY: Graph = { friends: [], incoming: [], outgoing: [] };

/* ---------- a local copy, for the panel to fall back on ---------- */

/** What this browser knows about its own friendships when there is no server
 *  to ask. Handles only, and only the parts this machine decided: the other
 *  half of a friendship lives on the other machine. */
export const localGraph = createStore<{ friends: string[]; outgoing: string[] }>("friends", {
  friends: [],
  outgoing: [],
});

function brief(user: string): Brief {
  return {
    user,
    name: user,
    pfp: null,
    nameStyle: "",
    roles: [],
    verified: false,
    owner: false,
    online: false,
    seen: 0,
    banned: false,
  };
}

function local(): Graph {
  const s = localGraph.get();
  return { friends: s.friends.map(brief), incoming: [], outgoing: s.outgoing.map(brief) };
}

/** The graph: live when there is a deployment behind it, local when there is
 *  not. Never null, so a panel does not have to check twice. */
export function useGraph(user: string | null): Graph {
  const live = useQuery(api.friends.mine, cloudOn() && user ? { user } : "skip") as Graph | undefined;
  const offline = useMemo(() => local(), [live, user]);
  return live ?? offline ?? EMPTY;
}

/** Move the local copy first, so the button answers the click whether or not
 *  the deployment is awake. */
function locally(fn: string, by: string, user: string) {
  const s = localGraph.get();
  if (fn === "request" && !s.outgoing.includes(user)) localGraph.set({ outgoing: [...s.outgoing, user] });
  if (fn === "accept") {
    localGraph.set({
      friends: s.friends.includes(user) ? s.friends : [...s.friends, user],
      outgoing: s.outgoing.filter((u) => u !== user),
    });
  }
  if (fn === "decline" || fn === "remove") {
    localGraph.set({
      friends: s.friends.filter((u) => u !== user),
      outgoing: s.outgoing.filter((u) => u !== user),
    });
  }
}

export async function askFriend(by: string, user: string) {
  locally("request", by, user);
  const c = cloud();
  if (!c) return null;
  try {
    return await c.mutation(api.friends.request, { by, user });
  } catch {
    return null;
  }
}

export async function acceptFriend(by: string, user: string) {
  locally("accept", by, user);
  const c = cloud();
  if (!c) return null;
  try {
    return await c.mutation(api.friends.accept, { by, user });
  } catch {
    return null;
  }
}

export async function declineFriend(by: string, user: string) {
  locally("decline", by, user);
  const c = cloud();
  if (!c) return null;
  try {
    return await c.mutation(api.friends.decline, { by, user });
  } catch {
    return null;
  }
}

export async function dropFriend(by: string, user: string) {
  locally("remove", by, user);
  const c = cloud();
  if (!c) return null;
  try {
    return await c.mutation(api.friends.remove, { by, user, both: true });
  } catch {
    return null;
  }
}

export type Relation = {
  following: boolean;
  follows: boolean;
  friends: boolean;
  /** I asked and they have not answered */ outgoing: boolean;
  /** they asked and I have not answered */ incoming: boolean;
};

/** Between two people, for the buttons on a card. */
export function useRelation(me: string | null, them: string | null): Relation {
  const rows = useQuery(
    api.friends.between,
    cloudOn() && me && them ? { by: me, user: them } : "skip",
  ) as { following: boolean; follows: boolean; friends: boolean } | undefined;
  const s = localGraph.get();
  if (!me || !them) {
    return { following: false, follows: false, friends: false, outgoing: false, incoming: false };
  }
  const following = rows?.following ?? s.outgoing.includes(them);
  const follows = rows?.follows ?? false;
  const friends = rows?.friends ?? (following && follows);
  return { following, follows, friends, outgoing: following && !follows, incoming: follows && !following };
}

/* ---------- presence ---------- */

/** How often a browser says it is still here: a third of the server's window,
 *  so one lost beat is not a sign-out. */
const BEAT = 45_000;

/** Keep this member's presence fresh, and keep "what they are doing" current.
 *  Called once from the shell, and it runs for as long as NULL is open. */
export function usePulse(user: string | null) {
  useEffect(() => {
    if (!user || !cloudOn()) return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      const c = cloud();
      if (!c) return;
      void c.mutation(api.presence.pulse, { user, activity: activityOf() }).catch(() => {});
    };
    /* once on arrival, then on a timer, then the moment somebody comes back:
       the beat that matters most is the one after an idle spell */
    beat();
    const id = window.setInterval(beat, BEAT);
    const onBack = () => beat();
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
    };
  }, [user]);
}

export type Activity = { kind: string; name: string; detail: string };

/** What this browser is doing, as the directory stores it. The page is the
 *  reliable half of it; the argument is a game or a member when there is one. */
function activityOf(): string {
  const seg = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const page = seg[0] || "home";
  const arg = seg[1] ? decodeURIComponent(seg[1]).replace(/[-_]/g, " ") : "";
  const what: Activity = {
    kind: page,
    name: arg.slice(0, 60),
    detail: PAGE_WORD[page] ?? "somewhere on null",
  };
  return JSON.stringify(what).slice(0, 300);
}

const PAGE_WORD: Record<string, string> = {
  home: "on the front door",
  games: "in the games library",
  apps: "in the apps library",
  chat: "in the chat",
  music: "listening to music",
  ai: "asking the assistant",
  shop: "spending coins in the shop",
  users: "reading the member list",
  rich: "reading the leaderboard",
  profile: "on a profile",
  player: "playing a game",
  movies: "watching something",
  extensions: "looking at extensions",
  changelog: "reading the changelog",
  partners: "reading the partner wall",
};

export type LiveRow = { user: string; name: string; seen: number; online: boolean; activity: Activity | null };

/** Who is online out of a list of handles. A friends list wants the away ones
 *  too, drawn greyed, which is why this is not just "online users". */
export function useLive(users: string[], me?: string | null): LiveRow[] {
  const key = users.slice(0, 120).join(",");
  const rows = useQuery(
    api.presence.live,
    cloudOn() && key ? { users: key.split(","), me: me ?? undefined } : "skip",
  ) as LiveRow[] | undefined;
  return rows ?? [];
}

/** Is this handle here, judging by a `seen` stamp the page already has. The
 *  window is the server's own. */
export function isHere(seen: number | undefined | null): boolean {
  return !!seen && Date.now() - seen < 1000 * 60 * 3;
}

/** A short "3m ago" for a row that has been away a while. */
export function lastSeen(seen: number | undefined | null): string {
  if (!seen) return "not seen yet";
  const mins = Math.max(0, Math.round((Date.now() - seen) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
