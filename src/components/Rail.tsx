/* NULL · Rail.tsx
   The spine. Fixed width, nine doors, never expands: names arrive in a
   tooltip on hover, which keeps the width honest on a laptop. The doors are
   split five and four around a deliberate empty gap. No logo up here — the
   wordmark on the front door is the only mark the site has.

   The active door's icon goes white and an ultra thin line appears flush
   against the window edge beside it.

   In the backendless build the doors that need a server are not drawn at
   all: the rail is what the site offers, and it does not offer a room nobody
   can walk into. */

import { doors, PAGES, RAIL_BOTTOM, RAIL_TOP, type PageId } from "../lib/nav";
import { useServerless } from "../lib/outage";
import { activeTab, go, useTabs } from "../lib/tabs";

export function Rail({ onSettings, openSheetCount }: { onSettings: () => void; openSheetCount: number }) {
  const { tabs, active } = useTabs();
  const here = tabs.find((t) => t.id === active)?.now.page;
  const offline = useServerless();

  const click = (id: PageId) => {
    if (id === "settings") {
      onSettings();
      return;
    }
    /* ⌘/ctrl-click opens beside the current tab, like a browser */
    const t = activeTab();
    if (t.now.page === id && !t.back.length) return;
    go({ page: id });
  };

  return (
    <nav className="rail" aria-label="Primary">
      {doors(RAIL_TOP, offline).map((id) => (
        <Door key={id} id={id} on={here === id} onClick={() => click(id)} />
      ))}

      <div className="rail-gap" />

      {doors(RAIL_BOTTOM, offline).map((id) => (
        <Door key={id} id={id} on={here === id} onClick={() => click(id)} />
      ))}
    </nav>
  );
}

function Door({
  id,
  on,
  onClick,
  badge,
}: {
  id: PageId;
  on: boolean;
  onClick: () => void;
  badge?: number;
}) {
  const page = PAGES[id];
  const Icon = page.icon;
  return (
    <button
      className={`rail-btn tip${on ? " is-on" : ""}`}
      data-tip={page.name}
      onClick={onClick}
      aria-current={on ? "page" : undefined}
      aria-label={page.name}
    >
      <Icon />
      {badge ? <span className="dot" /> : null}
    </button>
  );
}
