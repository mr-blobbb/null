/* NULL · voice.ts
   A voice channel, made of nothing but the browsers in it.

   There is no media server. Each person in the room holds one connection to
   every other person in the room, and the only thing that goes through NULL's
   own backend is the introduction: an offer, an answer, and a handful of
   addresses, all of which are thrown away as soon as they have been read
   (convex/voice.ts). The audio is peer to peer, which is also why nothing can
   be recorded from this side of it.

   What that buys and what it costs:

   · Two people is one connection, four people is six, eight is twenty-eight.
     It is built for a handful of people talking, and the room says so once
     the count gets silly.
   · Both ends have to be able to reach each other. The STUN servers below
     find that out; a network that blocks UDP outright, or two machines both
     behind a strict router, will simply fail to connect, and the honest thing
     is to say so rather than to look like it is working.
   · Nobody is "the host". Somebody closing their laptop ends their
     connections and nothing else.

   One detail worth naming: whoever has the earlier handle alphabetically
   makes the offer. Two people both offering at the same moment is a glare,
   and a rule about who goes first is all it takes to never have one. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { cloud, cloudOn } from "./cloud";

export type Peer = { user: string; name: string; muted: boolean; deaf: boolean; at: number };

type Signal = { id: string; from: string; kind: string; data: string };

/** Public STUN, and only STUN: NULL has no TURN relay to fall back on, so a
 *  pair of browsers that cannot see each other simply will not connect. */
const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

/** How often the room is told we are still here. Well inside the server's
 *  window, so a slow network does not read as a hang-up. */
const BEAT = 6000;

export type Voice = {
  joined: boolean;
  joining: boolean;
  muted: boolean;
  deaf: boolean;
  peers: Peer[];
  /** 0..1, per handle, for the ring around the picture. `me` is included. */
  level: Record<string, number>;
  error: string | null;
  join: () => void;
  leave: () => void;
  setMuted: (on: boolean) => void;
  setDeaf: (on: boolean) => void;
  /** how many of the people in the room we are actually connected to */
  live: number;
};

const key = (s: string) => s.trim().toLowerCase();

export function useVoice(me: { user: string; name: string } | null, thread: string | null): Voice {
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deaf, setDeaf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<Record<string, number>>({});
  const [live, setLive] = useState(0);

  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const streams = useRef(new Map<string, MediaStream>());
  const audios = useRef(new Map<string, HTMLAudioElement>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const mic = useRef<MediaStream | null>(null);
  const ac = useRef<AudioContext | null>(null);
  const analysers = useRef(new Map<string, AnalyserNode>());
  const mutedRef = useRef(false);
  const deafRef = useRef(false);
  const meRef = useRef<string>("");

  meRef.current = me ? key(me.user) : "";
  mutedRef.current = muted;
  deafRef.current = deaf;

  const on = joined && !!thread && !!me && cloudOn();
  const roster = useQuery(api.voice.roster, on ? { thread: thread as string } : "skip") as Peer[] | undefined;
  const inbox = useQuery(
    api.voice.mailbox,
    on && me ? { thread: thread as string, user: me.user } : "skip",
  ) as Signal[] | undefined;

  /* ---------- the microphone ---------- */

  const openMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      mic.current = stream;
      stream.getAudioTracks().forEach((t) => (t.enabled = !mutedRef.current));
      return stream;
    } catch (e) {
      const named = (e as Error)?.name;
      setError(
        named === "NotAllowedError"
          ? "The browser refused the microphone. Allow it for this site, then try again."
          : "No microphone this browser can use.",
      );
      return null;
    }
  }, []);

  /* ---------- one connection, made or answered ---------- */

  const pcFor = useCallback((who: string, initiator: boolean) => {
    const had = pcs.current.get(who);
    if (had) return had;
    const pc = new RTCPeerConnection(ICE);
    pcs.current.set(who, pc);

    const mine = mic.current;
    if (mine) mine.getTracks().forEach((t) => pc.addTrack(t, mine));

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      const c = cloud();
      if (!c || !thread || !me) return;
      void c
        .mutation(api.voice.signal, {
          thread,
          from: me.user,
          to: who,
          kind: "ice",
          data: JSON.stringify(ev.candidate.toJSON()),
        })
        .catch(() => {});
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      if (!stream) return;
      streams.current.set(who, stream);
      let el = audios.current.get(who);
      if (!el) {
        el = new Audio();
        el.autoplay = true;
        el.controls = false;
        el.setAttribute("playsinline", "true");
        /* Keeping the element in the document makes ChromeOS treat the
           incoming track as a real media output instead of a detached,
           autoplay-blocked object. */
        document.body.appendChild(el);
        audios.current.set(who, el);
      }
      el.srcObject = stream;
      el.muted = deafRef.current;
      void el.play().catch(() => {});
      /* an analyser per remote stream, purely to draw the ring around their
         picture: nothing is measured, kept or sent */
      const ctx = ac.current;
      if (ctx) {
        void ctx.resume().catch(() => {});
        try {
          const src = ctx.createMediaStreamSource(stream);
          const an = ctx.createAnalyser();
          an.fftSize = 512;
          src.connect(an);
          analysers.current.set(who, an);
        } catch {
          /* a stream the audio graph refuses is one without a ring */
        }
      }
      setLive(pcs.current.size);
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "failed" || s === "closed") {
        pc.close();
        pcs.current.delete(who);
        setLive(pcs.current.size);
      }
    };

    if (initiator) {
      void (async () => {
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          const c = cloud();
          if (!c || !thread || !me) return;
          await c.mutation(api.voice.signal, {
            thread,
            from: me.user,
            to: who,
            kind: "offer",
            data: JSON.stringify(offer),
          });
        } catch (e) {
          setError("Could not open a call to the room.");
        }
      })();
    }
    return pc;
  }, [me, thread]);

  /** Drop one peer's connection and everything that came with it. */
  const hangUp = useCallback((who: string) => {
    pcs.current.get(who)?.close();
    pcs.current.delete(who);
    streams.current.delete(who);
    analysers.current.delete(who);
    const el = audios.current.get(who);
    if (el) {
      el.srcObject = null;
      el.remove();
      audios.current.delete(who);
    }
    setLive(pcs.current.size);
  }, []);

  /* ---------- the post: offers, answers, addresses ---------- */

  useEffect(() => {
    const c = cloud();
    if (!on || !inbox?.length || !c || !thread || !me) return;
    const ids: string[] = [];
    let alive = true;

    void (async () => {
      for (const sig of inbox) {
        ids.push(sig.id);
        const who = sig.from;
        try {
          if (sig.kind === "offer") {
            const pc = pcFor(who, false);
            await pc.setRemoteDescription(JSON.parse(sig.data));
            for (const cand of pendingIce.current.get(who) ?? []) {
              await pc.addIceCandidate(cand).catch(() => {});
            }
            pendingIce.current.delete(who);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await c.mutation(api.voice.signal, {
              thread,
              from: me.user,
              to: who,
              kind: "answer",
              data: JSON.stringify(answer),
            });
          } else if (sig.kind === "answer") {
            const pc = pcs.current.get(who);
            if (pc) {
              await pc.setRemoteDescription(JSON.parse(sig.data));
              for (const cand of pendingIce.current.get(who) ?? []) {
                await pc.addIceCandidate(cand).catch(() => {});
              }
              pendingIce.current.delete(who);
            }
          } else if (sig.kind === "ice") {
            const pc = pcs.current.get(who);
            const cand = JSON.parse(sig.data) as RTCIceCandidateInit;
            if (pc?.remoteDescription) await pc.addIceCandidate(cand).catch(() => {});
            else pendingIce.current.set(who, [...(pendingIce.current.get(who) ?? []), cand]);
          } else if (sig.kind === "bye") {
            hangUp(who);
          }
        } catch {
          /* one bad signal must not stop the other four */
        }
      }
      if (alive && ids.length) await c.mutation(api.voice.take, { ids }).catch(() => {});
    })();

    return () => {
      alive = false;
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [inbox, on, me?.user, thread]);

  /* ---------- the room: who is here, and who owes whom a call ---------- */

  useEffect(() => {
    if (!on || !roster || !me) return;
    const mine = key(me.user);
    const here = new Set(roster.map((p) => key(p.user)));
    for (const who of [...pcs.current.keys()]) {
      if (!here.has(who)) {
        const c = cloud();
        if (c && thread) {
          void c.mutation(api.voice.signal, { thread, from: me.user, to: who, kind: "bye", data: "{}" }).catch(() => {});
        }
        hangUp(who);
      }
    }
    /* earlier handle offers: one of the two makes the call, never both */
    for (const p of roster) {
      const who = key(p.user);
      if (who === mine || pcs.current.has(who)) continue;
      if (mine < who) pcFor(who, true);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [roster, on, me?.user, thread]);

  /* ---------- still here ---------- */

  useEffect(() => {
    if (!on || !thread || !me) return;
    const c = cloud();
    if (!c) return;
    const beat = () =>
      void c.mutation(api.voice.beat, { thread, user: me.user, muted: mutedRef.current, deaf: deafRef.current }).catch(() => {});
    beat();
    const id = window.setInterval(beat, BEAT);
    return () => window.clearInterval(id);
  }, [on, thread, me?.user, muted, deaf]);

  /* mute and deafen, applied to what is already connected */
  useEffect(() => {
    mic.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted]);

  useEffect(() => {
    audios.current.forEach((el) => (el.muted = deaf));
  }, [deaf]);

  /* ---------- the rings ---------- */

  useEffect(() => {
    if (!on) return;
    const ctx = ac.current ?? new AudioContext();
    ac.current = ctx;
    if (mic.current && !analysers.current.has("me")) {
      try {
        const src = ctx.createMediaStreamSource(mic.current);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        analysers.current.set("me", an);
      } catch {
        /* no ring for the local microphone, then */
      }
    }
    const buf = new Uint8Array(256);
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      /* ten times a second is plenty for a ring, and a state update per frame
         would be more work than the audio it draws */
      if (t - last < 100) return;
      last = t;
      const next: Record<string, number> = {};
      analysers.current.forEach((an, who) => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i += 8) {
          const v = Math.abs(buf[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        next[who === "me" ? meRef.current : who] = peak > 0.06 ? Math.min(1, peak * 1.8) : 0;
      });
      setLevel(next);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [on]);

  /* ---------- joining and leaving ---------- */

  const leave = useCallback(() => {
    const c = cloud();
    if (c && thread && me) void c.mutation(api.voice.leave, { thread, user: me.user }).catch(() => {});
    pcs.current.forEach((pc) => pc.close());
    pcs.current.clear();
    [...audios.current.values()].forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    audios.current.clear();
    streams.current.clear();
    analysers.current.clear();
    mic.current?.getTracks().forEach((t) => t.stop());
    mic.current = null;
    void ac.current?.close().catch(() => {});
    ac.current = null;
    setJoined(false);
    setJoining(false);
    setLevel({});
    setLive(0);
  }, [me, thread]);

  const join = useCallback(() => {
    if (!me || !thread || joined || joining) return;
    if (!cloudOn()) {
      setError("Voice needs the server, and this build has none reachable.");
      return;
    }
    setError(null);
    setJoining(true);
    void (async () => {
      const stream = await openMic();
      if (!stream) {
        setJoining(false);
        return;
      }
      const c = cloud();
      try {
        await c?.mutation(api.voice.join, { thread, user: me.user, name: me.name });
      } catch {
        setError("The room did not answer. Try again in a moment.");
        mic.current?.getTracks().forEach((t) => t.stop());
        mic.current = null;
        setJoining(false);
        return;
      }
      /* play the whole room, then say we are here: the order matters, because
         the first thing anyone else's browser will do is hand us an offer and
         it expects a live connection to hand it to */
      ac.current = ac.current ?? new AudioContext();
      setJoined(true);
      setJoining(false);
    })();
  }, [me, thread, joined, joining, openMic]);

  useEffect(() => () => leave(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    joined,
    joining,
    muted,
    deaf,
    peers: roster ?? [],
    level,
    error,
    join,
    leave,
    setMuted,
    setDeaf,
    live,
  };
}
