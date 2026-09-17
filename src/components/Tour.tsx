/* NULL · Tour.tsx
   The first five minutes.

   A short card in the middle of the screen, five steps long, shown once. It
   used to spotlight parts of the page through a hole punched in the backdrop;
   that read as a lot of moving parts for very little teaching, and the card
   sitting on top of a see-through backdrop was worse to look at than the page
   underneath. So: no spotlight, no holes, and the card is the same opaque
   surface every other popup on NULL uses.

   It runs once. The store's name is versioned, so a tour that has been
   rewritten is offered once more rather than hidden from everyone who saw the
   old one; the Settings sheet can ask for it again — a tour you cannot replay
   is a tour you skip. */

import { useEffect, useState } from "react";

import { createStore, useStore } from "../lib/store";

const tour = createStore<{ done: boolean }>("tour-v2", { done: false });

/** Read by Settings, so the tour can be watched again on purpose. */
export function tourSeen(): boolean {
  return tour.get().done;
}

export function replayTour() {
  tour.set({ done: false });
}

type Step = { title: string; body: string };

const STEPS: Step[] = [
  {
    title: "this is null",
    body: "A hub for games, apps and anything the web will let you open. Everything happens inside this one window — nothing ever navigates you away from it.",
  },
  {
    title: "the box up top does three jobs",
    body: "Type words and it searches the web. Type an address and it loads the site in here. Type null://g and it goes to the games. It is the same box on the front door.",
  },
  {
    title: "the rail on the left",
    body: "Every page is a door down the left edge: games, apps, chat, movies, music, the shop. Hover one and its name appears. The ones you spend the most time in sit at the top.",
  },
  {
    title: "coins are just time",
    body: "Nothing here costs money. Stay on a game or an app and coins tick up on their own; the shop spends them on decorations, profile effects and name tags.",
  },
  {
    title: "and then there is the rest",
    body: "Tabs work like a browser's — drag them, middle-click to close. Settings holds the themes, the tab cloak and your data. Press Escape any time to shut this card.",
  },
];

export function Tour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

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
    if (last) finish();
    else setI(i + 1);
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="A short tour of NULL">
      <span className="tour-dim" aria-hidden="true" />

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
