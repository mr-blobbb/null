/* NULL · Movies.tsx
   null://m — aether.cx, framed.

   This is the one address NULL points at with a plain <iframe> instead of the
   Ultraviolet chain in src/lib/browser.ts. That chain is the right way to
   reach an arbitrary site (it is the only way to reach one that refuses to be
   framed), but it depends on a Wisp relay, and a relay is a WebSocket server:
   it is the part NULL cannot ship. So the one address people expect to be
   here gets the direct route, and says what to do if the site says no.

   Nothing of NULL's chrome is duplicated inside: the tab bar above already
   carries the address, so this is the frame and a corner note, nothing more. */

import { ExternalLink, Film } from "lucide-react";

import { PAGES } from "../lib/nav";

export function Movies() {
  const url = PAGES.movies.loads ?? "";
  const host = url.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div className="mov">
      <iframe
        className="mov-frame"
        src={url}
        title={host}
        referrerPolicy="no-referrer"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      />

      <div className="mov-chip">
        <Film />
        <b>{host}</b>
        <span className="mov-sep">∙</span>
        <span>blank? it refuses to be framed</span>
        <button
          className="btn btn--sm"
          onClick={() => window.open(url, "_blank", "noopener")}
          title={`Open ${host} in a real tab`}
        >
          <ExternalLink /> Open
        </button>
      </div>
    </div>
  );
}
