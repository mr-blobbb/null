/* NULL · Tour.tsx
   The first five minutes.

   A spotlight, not a slideshow: the card stays put in the middle of the screen
   and the page underneath is the slideshow, one part lit up at a time. That
   is the only kind of tour that teaches where things are rather than telling
   you about them.

   It runs once. `null:tour` remembers that it has been seen, and the Settings
   sheet can ask for it again — a tour you cannot replay is a tour you skip. */

import { useEffect, useLayoutEffect, useState } from "react";

import { createStore, useStore } from "../lib/store";

const tour = createStore<{ done: boolean }>("tour", { done: false });

/** Read by Settings, so the tour can be watched again on purpose. */
export function tourSeen(): boolean {
  return tour.get().done;
}

export function replayTour() {
  tour.set({ done: false });
}

type Step = {
  /** what gets lit up. A selector rather than a ref: these live in other
   *  people's components, and a tour should not need props threaded into
   *  every corner of the site to find them. */
  sel: string;
  title: string;
  body: string;
  /** a hole a little wider than the element, for things that need air */
  pad?: number;
};

const STEPS: Step[] = [
  {
    sel: ".hm-word",
    title: "this is null",
    body: "A hub for games, apps and anything the web will let you open. Everything lives inside this one window — the rail is the spine on the left, and nothing ever leaves it.",
    pad: 18,
  },
  {
    sel: ".hm-search",
    title: "one box, three jobs",
    body: "Type words and it searches the web. Type an address and it opens the site in here. Type null://g and it goes to the games. It is the same box as the one up in the toolbar.",
    pad: 10,
  },
  {
    sel: ".hm-links",
    title: "your shortcuts",
    body: "These are yours to keep: hover one and a bin appears, or press Add for anything you like. All Apps is the back door to every page at once.",
    pad: 14,
  },
  {
    sel: ".rail",
    title: "the rail",
    body: "Seven doors down the left, five up from the bottom. Chat and Movies open other places; Shop spends the coins you earn just by being here.",
    pad: 8,
  },
  {
    sel: ".bar",
    title: "the toolbar",
    body: "Back, forward, reload, the address, and the player on the right. Tabs sit above it — drag them about, middle-click to close.",
    pad: 8,
  },
];

type Box = { x: number; y: number; w: number; h: number } | null;

export function Tour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box>(null);
  const step = STEPS[i];

  /* Measure the element this step is about, and keep measuring while the
     window moves under it. Elements that are not on screen simply get no
     hole, and the step becomes a plain card. */
  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector(step.sel);
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      const pad = step.pad ?? 10;
      setBox({ x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function finish() {
    tour.set({ done: true });
    onDone();
  }

  function next() {
    if (i + 1 >= STEPS.length) finish();
    else setI(i + 1);
  }

  const last = i === STEPS.length - 1;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="A short tour of NULL">
      {box ? (
        <span
          className="tour-hole"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
          aria-hidden="true"
        />
      ) : (
        <span className="tour-dim" aria-hidden="true" />
      )}

      <div className="tour-card">
        <span className="tour-kicker">
          {i + 1} / {STEPS.length}
        </span>
        <h2 className="tour-title">{step.title}</h2>
        <p className="tour-body">{step.body}</p>

        <div className="tour-dots" aria-hidden="true">
          {STEPS.map((_, n) => (
            <i key={n} className={n === i ? "is-on" : ""} />
          ))}
        </div>

        <div className="tour-actions">
          <button className="btn btn--ghost" onClick={finish}>
            Skip
          </button>
          <span className="tour-spacer" />
          {i > 0 && (
            <button className="btn" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          <button className="btn btn--fill" onClick={next} autoFocus>
            {last ? "Start" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Whether the tour should be on screen right now. */
export function useTourDue(): boolean {
  return !useStore(tour).done;
}
