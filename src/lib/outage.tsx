/* NULL · outage.tsx
   The one card a cloud page shows when the server cannot answer.

   Convex queries throw while rendering when the deployment is disabled (a
   spent usage limit) or unreachable, and an uncaught throw takes the whole
   page with it. Pages wrap their cloud part in a Guard whose fallback is the
   card below; Guard reports the error here, so every page says the same true
   thing about the same outage instead of guessing. */

import { useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";

let down = false;
const subs = new Set<() => void>();

/** What a deployment being switched off reads like in the error text. */
const BAD = /usage limit|has been disabled|unreachable|FailedToLoad|InvalidResponseError|NetworkError|Failed to fetch/i;

/** True when this error is the server being down rather than a page bug. */
export function markOutage(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err ?? "");
  if (!BAD.test(text)) return false;
  if (!down) {
    down = true;
    subs.forEach((fn) => fn());
  }
  return true;
}

export function outageOn(): boolean {
  return down;
}

function subscribeOutage(fn: () => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function useOutage(): boolean {
  return useSyncExternalStore(subscribeOutage, outageOn, outageOn);
}

/** The fallback body for a Guard around a cloud page.
 *
 *  `err` is the error the Guard caught. When the server itself is fine, that
 *  error is a bug in this page, and saying "the server could not be reached"
 *  about a bug sends everybody looking in the wrong place — so the real line
 *  goes on screen in small print. That is how a missing function, an old
 *  deployment or a bad argument gets reported instead of guessed at. */
export function CloudDown({ what, err }: { what: string; err?: Error }) {
  const outage = useOutage();
  return (
    <div className="page">
      <div className="lb-top">
        <h1 className="lb-title">{what}</h1>
        <span className="lb-count tiny faint">{outage ? "server down" : "offline"}</span>
      </div>
      <div className="card card--pad">
        {outage ? (
          <p>
            The server ran out of credits, so the shared side of {what} is paused. Your local
            stuff — coins, profile, favorites — is untouched, and this comes back the moment the
            deployment is topped up.
          </p>
        ) : err?.message ? (
          <p>
            The shared side of {what} could not be drawn just now. That is a fault on this side,
            not an outage, and the line below is what it was. Everything stored on this browser
            still works.
          </p>
        ) : (
          <p>
            The server could not be reached just now, so the shared side of {what} is offline.
            Everything stored on this browser still works.
          </p>
        )}
        {!outage && err?.message && <p className="tiny faint">{err.message}</p>}
        <button className="btn" onClick={() => location.reload()}>
          <RefreshCw /> Retry
        </button>
      </div>
    </div>
  );
}
