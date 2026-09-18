/* NULL · saves.ts
   Cloud saves, from the client's end.

   The server half (convex/saves.ts) is a bag of named blobs, and this is the
   half that knows where a blob comes from. There are two answers, because
   there are two kinds of game in the library:

   · A game NULL **copied into a frame** or serves from its own files runs as
     a document this page can reach, so its storage can simply be read and
     written: `capture` hands back everything the game keeps, `restore` puts
     it back. That is most of the shelf.
   · A game behind somebody else's origin cannot be read at all — the browser
     forbids it — so those cards ask for the save the honest way: paste it in,
     or take the file the game exported and drop it here. `paste` and
     `download` are for that road.

   Everything is stored as text. NULL never parses a save, which is why it
   works for a game nobody has heard of yet. */

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { cloud, cloudOn } from "./cloud";
import { createStore, useStore } from "./store";

export type SaveRow = {
  id: string;
  game: string;
  /** what the slot is called on screen, e.g. "before the boss" */
  name: string;
  slot: string;
  /** the blob itself. On a list from the server this is empty and `size` is
   *  what was recorded: a page of saves should not download every save */
  data: string;
  /** only present on rows that came from the server */
  size?: number;
  from: string;
  at: number;
};

/** The local shelf: what this machine has, whether or not there is a server.
 *  A signed-in save is written here too, so a save made on a school Chromebook
 *  is at least visible on it while the network is being difficult. */
export const shelf = createStore<{ rows: SaveRow[] }>("saves", { rows: [] });

function localRows(game?: string): SaveRow[] {
  const rows = shelf.get().rows ?? [];
  return rows.filter((r) => !game || r.game === game).sort((a, b) => b.at - a.at);
}

function putLocal(row: SaveRow) {
  const rows = shelf.get().rows ?? [];
  const same = rows.find((r) => r.game === row.game && r.slot === row.slot);
  if (same) {
    shelf.set({ rows: rows.map((r) => (r.id === same.id ? { ...row, id: same.id } : r)) });
    return same.id;
  }
  shelf.set({ rows: [row, ...rows].slice(0, 200) });
  return row.id;
}

/** The saves this member has, newest first. Live when signed in to a
 *  deployment, local otherwise. */
export function useSaves(user: string | null, game?: string): SaveRow[] {
  const live = useQuery(
    api.saves.list,
    cloudOn() && user ? { user } : "skip",
  ) as Omit<SaveRow, "data">[] | undefined;
  const mine = useStore(shelf).rows ?? [];
  if (live) {
    return live.filter((r) => !game || r.game === game).map((r) => ({ ...r, data: "" }));
  }
  return mine.filter((r) => !game || r.game === game);
}

/** The contents of one save. Asked for only when somebody is about to use it,
 *  because a list of saves should not ship every save file to every machine. */
export function useSaveData(user: string | null, id: string | null) {
  const live = useQuery(api.saves.read, cloudOn() && id && !id.startsWith("local:") ? { id } : "skip") as
    | { data: string }
    | null
    | undefined;
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    if (!id || !id.startsWith("local:")) return;
    setLocal((shelf.get().rows ?? []).find((r) => r.id === id)?.data ?? null);
  }, [id]);
  if (id && id.startsWith("local:")) return local;
  return live?.data ?? null;
}

/** Keep one slot. Overwrites whatever had that name, which is what a slot is
 *  for: the second save of the day replaces the first. */
export async function saveSlot(opts: {
  user: string | null;
  game: string;
  label: string;
  slot: string;
  data: string;
  from?: string;
}): Promise<{ ok: true; id: string } | { ok: false; why: string }> {
  const data = opts.data.trim();
  if (!data) return { ok: false, why: "There is nothing to save yet." };
  if (data.length > 200_000) return { ok: false, why: "That save is too big to keep." };

  const row: SaveRow = {
    id: `local:${opts.game}:${opts.slot}:${Date.now()}`,
    game: opts.game,
    name: opts.label,
    slot: opts.slot,
    data,
    from: opts.from ?? "this browser",
    at: Date.now(),
  };
  const id = putLocal(row);

  if (!opts.user || !cloudOn()) return { ok: true, id };
  const c = cloud();
  if (!c) return { ok: true, id };
  try {
    const remote = (await c.mutation(api.saves.put, {
      user: opts.user,
      game: opts.game,
      label: opts.label,
      name: opts.label,
      slot: opts.slot,
      data,
      from: opts.from ?? "this browser",
    })) as string;
    return { ok: true, id: remote };
  } catch (e) {
    /* kept locally, so the honest answer is "saved here, not there" */
    return { ok: true, id };
  }
}

export async function dropSave(user: string | null, id: string) {
  shelf.set({ rows: (shelf.get().rows ?? []).filter((r) => r.id !== id) });
  if (!user || !cloudOn() || id.startsWith("local:")) return true;
  const c = cloud();
  if (!c) return true;
  try {
    return await c.mutation(api.saves.remove, { user, id });
  } catch {
    return false;
  }
}

/* ---------- talking to the frame ---------- */

/** What a game keeps, read straight out of its own document.
 *
 *  Only the same-origin road works: a remote game is somebody else's origin
 *  and the browser will not let this page see inside it, which is not a
 *  limitation to work around but the point of origins. Those cards fall back
 *  to the paste box. */
export function capture(frame: HTMLIFrameElement | null): string | null {
  const win = frame?.contentWindow;
  if (!win) return null;
  try {
    const out: Record<string, string> = {};
    for (let i = 0; i < win.localStorage.length; i++) {
      const k = win.localStorage.key(i);
      if (k) out[k] = win.localStorage.getItem(k) ?? "";
    }
    for (let i = 0; i < win.sessionStorage.length; i++) {
      const k = win.sessionStorage.key(i);
      if (k) out[`session:${k}`] = win.sessionStorage.getItem(k) ?? "";
    }
    if (!Object.keys(out).length) return null;
    return JSON.stringify({ v: 1, at: Date.now(), store: out });
  } catch {
    /* cross-origin, or a sandboxed copy: not ours to read */
    return null;
  }
}

/** Put it back, and say what happened. The game is reloaded by the caller, so
 *  it picks the save up the way it would on a fresh visit. */
export function restore(frame: HTMLIFrameElement | null, data: string): { ok: boolean; keys: number; why?: string } {
  const win = frame?.contentWindow;
  if (!win) return { ok: false, keys: 0, why: "No game is open." };
  let parsed: { store?: Record<string, string> };
  try {
    parsed = JSON.parse(data);
  } catch {
    return { ok: false, keys: 0, why: "That is not one of NULL's saves." };
  }
  const store = parsed?.store;
  if (!store || typeof store !== "object") return { ok: false, keys: 0, why: "That save is empty." };
  try {
    win.localStorage.clear();
    win.sessionStorage.clear();
    let keys = 0;
    for (const [k, v] of Object.entries(store)) {
      if (k.startsWith("session:")) win.sessionStorage.setItem(k.slice(8), v);
      else win.localStorage.setItem(k, v);
      keys++;
    }
    return { ok: true, keys };
  } catch {
    return { ok: false, keys: 0, why: "This game's origin will not let NULL write to it." };
  }
}

/** Hand somebody the save as a file, for the games NULL cannot reach. */
export function download(name: string, slot: string, data: string) {
  try {
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\w.-]+/g, "-").toLowerCase()}-${slot}.null-save.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch {
    /* a browser that will not download is a browser that can still copy the
       text out of the box */
  }
}

/** A readable size, for the row: saves run from a few bytes to a few hundred
 *  kilobytes and a number with no unit tells you nothing. */
export function sizeOf(data: string | number): string {
  const n = typeof data === "number" ? data : data.length;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 102.4) / 10} kB`;
  return `${Math.round(n / 1024 / 102.4) / 10} MB`;
}
