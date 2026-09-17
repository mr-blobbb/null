/* NULL · NotFound.tsx
   Shown when an address means nothing. The rail and the chrome stay put, so
   the way out is always one click away. */

import { Compass, Home } from "lucide-react";

import { SHEET_PAGES, PAGES } from "../lib/nav";
import { go } from "../lib/tabs";

export function NotFound() {
  return (
    <div className="page nf">
      <h1 className="nf-code">404</h1>
      <p className="nf-line">There is no page at that address.</p>
      <p className="nf-sub muted">
        It was moved, or it never existed, or you typed it by hand at three in the morning.
      </p>
      <div className="nf-actions">
        <button className="btn btn--fill" onClick={() => go({ page: "home" })}>
          <Home /> Go home
        </button>
      </div>
      <div className="nf-grid">
        {SHEET_PAGES.map((id) => {
          const p = PAGES[id];
          const Icon = p.icon;
          return (
            <button key={id} className="appgrid-btn" onClick={() => go({ page: id })}>
              <Icon />
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>
      <p className="tiny faint row nf-note">
        <Compass /> Everything NULL has is listed above. There is no page outside it.
      </p>
    </div>
  );
}
