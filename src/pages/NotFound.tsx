/* NULL · NotFound.tsx
   Shown when an address means nothing. The rail and the chrome stay put, so
   the way out is always one click away.

   It takes the address that missed and prints it. A 404 that only says
   "not found" makes you wonder whether you typed it wrong; one that shows
   `null://skdjf` back to you is answering the question you asked. */

import { ArrowLeft, Compass, Home } from "lucide-react";

import { doors, SHEET_PAGES, PAGES } from "../lib/nav";
import { useServerless } from "../lib/outage";
import { go, goBack, useTabs } from "../lib/tabs";

export function NotFound({ address }: { address?: string }) {
  const { tabs, active } = useTabs();
  const offline = useServerless();
  const here = tabs.find((t) => t.id === active);
  const canGoBack = !!here?.back.length;
  const tried = address || "null://404";

  return (
    <div className="page nf">
      <h1 className="nf-code">404</h1>
      <p className="nf-at">
        <span className="nf-at-label">no page at</span>
        <code className="nf-at-url">{tried}</code>
      </p>
      <p className="nf-sub muted">
        It was moved, or it never existed, or you typed it by hand at three in the morning.
      </p>
      <div className="nf-actions">
        {canGoBack && (
          <button className="btn" onClick={() => goBack()}>
            <ArrowLeft /> Go back
          </button>
        )}
        <button className="btn btn--fill" onClick={() => go({ page: "home" })}>
          <Home /> Go home
        </button>
      </div>
      <div className="nf-grid">
        {doors(SHEET_PAGES, offline).map((id) => {
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
