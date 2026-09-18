/* NULL · jam.ts
   Listening together: one person holds the room, everybody else follows.

   A jam is a row on the server — a code, a host, and the track the host last
   pushed — and the whole of the feature is one machine writing it and the
   others reading it. The host pushes on every change and then once every few
   seconds, because what a guest needs is not only *which* track but roughly
   where in it, and only the host knows that.

   A guest follows rather than syncing: the track is loaded when it changes,
   and the position is nudged only when it has drifted far enough to be
   audible. Chasing every millisecond would make the player stutter, and two
   people in different rooms are never going to be sample-accurate anyway.

   Nothing here plays for a signed-out visitor: a jam you start is a jam the
   others can find you in. */

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { cloud } from "./cloud";
import { createStore, useStore } from "./store";
import { music, play, seek, toggle, type Track } from "./music";

type Jam = { code: string | null; role: "host" | "guest" | null };

const EMPTY: Jam = { code: null, role: null };

export const jam = createStore<Jam>("jam", EMPTY);

export function useJam(): Jam {
  return useStore(jam);
}

/** How far out of step a guest may fall before it is worth a jump. */
const DRIFT = 3.5;
/** How often the host says where they are. */
const BEAT = 4000;

function nowTrack(t: Track | null): string | undefined {
  return t ? JSON.stringify(t) : undefined;
}

export async function startJam(me: string): Promise<{ ok: boolean; code?: string; reason?: string }> {
  const c = cloud();
  if (!c) return { ok: false, reason: "The shared side is offline." };
  try {
    const code = (await c.mutation(api.social.openJam, { host: me })) as string;
    jam.set({ code, role: "host" });
    return { ok: true, code };
  } catch (e) {
    return { ok: false, reason: (e as Error).message.replace(/^.*?Error: /, "") };
  }
}

export async function stopJam(me: string) {
  const c = cloud();
  jam.set(EMPTY);
  if (c) await c.mutation(api.social.closeJam, { host: me }).catch(() => undefined);
}

export function joinJam(code: string, me: string) {
  const clean = code.trim().toUpperCase();
  if (clean.length < 4) return { ok: false, reason: "A code is four letters." };
  jam.set({ code: clean, role: "guest" });
  return { ok: true };
}

export function leaveJam() {
  jam.set(EMPTY);
}

/** The room as the server has it. The host uses it to see who is in; a guest
 *  uses it to know what to play. */
export function useJamRow(code: string | null) {
  return useQuery(api.social.peekJam, code ? { code } : "skip") as
    | {
        code: string;
        host: string;
        track: string | null;
        playing: boolean;
        at: number;
        stamp: number;
      }
    | null
    | undefined;
}

/** The one hook that runs the room. Called once, in the shell, so a jam keeps
 *  playing while you wander off to another page. */
export function useJamWatch(me: string | null) {
  const live = useJam();
  const row = useJamRow(live.code);
  const push = useMutation(api.social.pushJam);
  const m = useStore(music);
  const lastSent = useRef(0);

  /* ---- the host ---- */
  useEffect(() => {
    if (live.role !== "host" || !me || !live.code) return;
    const send = () => {
      const s = music.get();
      void push({
        host: me,
        track: nowTrack(s.now),
        playing: s.playing,
        at: s.at,
      }).catch(() => undefined);
      lastSent.current = Date.now();
    };
    send();
    const beat = window.setInterval(send, BEAT);
    return () => window.clearInterval(beat);
    /* `m` is read through `music.get()` inside, so this re-runs only when the
       thing that matters to a guest changes: the track, or whether it plays */
  }, [live.role, live.code, me, m.now?.key, m.playing, push]);

  /* ---- the guest ---- */
  useEffect(() => {
    if (live.role !== "guest" || !row) return;
    const mine = music.get();
    const theirs = row.track ? (JSON.parse(row.track) as Track) : null;

    if (!theirs) return;

    if (mine.now?.key !== theirs.key) {
      play(theirs);
      /* the host may be halfway through: land where they are rather than at
         the top of the track */
      const into = row.playing ? row.at + (Date.now() - row.stamp) / 1000 : row.at;
      if (into > 1) window.setTimeout(() => seek(into), 350);
      return;
    }

    const drift = Math.abs((row.playing ? row.at + (Date.now() - row.stamp) / 1000 : row.at) - mine.at);
    if (row.playing && drift > DRIFT) seek(row.at + (Date.now() - row.stamp) / 1000);

    /* follow the play button too, so a pause on the host's side lands here */
    const shouldPlay = row.playing && !!theirs.audio;
    if (shouldPlay !== mine.playing) toggle();
  }, [live.role, row?.track, row?.playing, row?.stamp]);
}
