/* NULL · outage.tsx
   The one card a cloud page shows when the server cannot answer, and the
   switch that turns the shared side of the site off on purpose.

   Two things put NULL in its backendless shape, and they mean the same thing
   to every page:

   · the server went quiet — a deployment switched off, a spent usage limit,
     a network that cannot reach it. Convex queries throw while rendering when
     that happens, and an uncaught throw takes the whole page with it, so pages
     wrap their cloud part in a Guard whose fallback is the card below and
     Guard reports the error here.
   · somebody asked for it, in Settings → Server. Then the site is the same
     site with the shared rooms taken out: no chat, no member directory, no
     leaderboard, and nothing anywhere trying to open a socket.

   Everything else is untouched either way. The shop, the library, the player,
   the profile and the browser never needed a server, and they still do not. */

import { useSyncExternalStore } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

import { prefs } from "./themes";
import { useStore } from "./store";

let down = false;
const subs = new Set<() => void>();

/** What a deployment being switched off reads like in the error text. */
const BAD = /usage limit|has been disabled|unreachable|FailedToLoad|InvalidResponseError|NetworkError|Failed to fetch/i;

function tell() {
  subs.forEach((fn) => fn());
}

function subscribeOutage(fn: () => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/** True when this error is the server being down rather than a page bug. */
export function markOutage(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err ?? "");
  if (!BAD.test(text)) return false;
  if (!down) {
    down = true;
    tell();
  }
  return true;
}

export function outageOn(): boolean {
  return down;
}

/** Forget the outage, for the Retry button: the next query gets to try again
 *  rather than being refused by a flag that was set an hour ago. */
export function clearOutage() {
  if (!down) return;
  down = false;
  tell();
}

/** The switch in Settings. Asking for the backendless build is a preference
 *  and is remembered; the outage above is not. */
export function setBackendless(on: boolean) {
  prefs.set({ offline: on });
}

export function useOutage(): boolean {
  return useSyncExternalStore(subscribeOutage, outageOn, outageOn);
}

/** Is the site in its backendless shape right now — because the server is not
 *  answering, or because that is how it was asked to run. */
export function serverlessNow(): boolean {
  return down || prefs.get().offline;
}

export function useServerless(): boolean {
  const gone = useOutage();
  const asked = useStore(prefs).offline;
  return gone || asked;
}

/** One line where a cloud panel would have been, for the sections that sit
 *  inside a page that is otherwise fine — the profile's friends list, its
 *  saves and its appeal box. A whole card would be too much for those, and
 *  rendering nothing at all would look like a bug rather than a choice. */
export function CloudOff({ what }: { what: string }) {
  return (
    <p className="tiny faint">
      {what} lives on the server, and this build is running without one. Everything kept on
      this browser is still here.
    </p>
  );
}

/** The fallback body for a Guard around a cloud page, and the page you get
 *  when a cloud door is opened in the backendless build.
 *
 *  `err` is the error the Guard caught. When the server itself is fine, that
 *  error is a bug in this page, and saying "the server could not be reached"
 *  about a bug sends everybody looking in the wrong place — so the real line
 *  goes on screen in small print. That is how a missing function, an old
 *  deployment or a bad argument gets reported instead of guessed at. */
export function CloudDown({ what, err }: { what: string; err?: Error }) {
  const outage = useOutage();
  const asked = useStore(prefs).offline;
  const off = outage || asked;
  return (
    <div className="page">
      <div className="lb-top">
        <h1 className="lb-title">{what}</h1>
        <span className="lb-count tiny faint">{off ? "backendless" : "offline"}</span>
      </div>
      <div className="card card--pad">
        {asked && !outage ? (
          <p>
            This build is running without a backend, so the shared side of {what} is not
            offered: the room, the directory and the board all live on the server, and there
            is not one. Everything kept on this browser — coins, profile, favorites,
            decorations — is untouched, and turning the backend back on in Settings brings
            this back.
          </p>
        ) : outage ? (
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
        {!off && err?.message && <p className="tiny faint">{err.message}</p>}
        <div className="cl-out-actions">
          {outage && (
            <button className="btn" onClick={() => clearOutage()}>
              <RefreshCw /> Try the server again
            </button>
          )}
          {asked && (
            <button className="btn" onClick={() => setBackendless(false)}>
              <WifiOff /> Turn the backend back on
            </button>
          )}
          <button className="btn" onClick={() => location.reload()}>
            <RefreshCw /> Reload
          </button>
        </div>
      </div>
    </div>
  );
}
