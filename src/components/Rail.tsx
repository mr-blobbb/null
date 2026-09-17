/* NULL · Rail.tsx
   The spine. Fixed 56px, nine doors, never expands: names arrive in a
   tooltip on hover, which keeps the width honest on a laptop. The doors are
   split five and four around a deliberate empty gap.

   The active door's icon goes white and an ultra thin line appears flush
   against the window edge beside it. */

import { PAGES, RAIL_BOTTOM, RAIL_TOP, type PageId } from "../lib/nav";
import { activeTab, go, openTab, useTabs } from "../lib/tabs";

export function Rail({ onSettings, openSheetCount }: { onSettings: () => void; openSheetCount: number }) {
  const { tabs, active } = useTabs();
  const here = tabs.find((t) => t.id === active)?.now.page;

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
      <button
        className="rail-mark"
        onClick={() => openTab({ page: "home" })}
        title="null"
        aria-label="null"
      >
        n
      </button>

      {RAIL_TOP.map((id) => (
        <Door key={id} id={id} on={here === id} onClick={() => click(id)} />
      ))}

      <div className="rail-gap" />

      {RAIL_BOTTOM.map((id) => (
        <Door
          key={id}
          id={id}
          on={here === id}
          onClick={() => click(id)}
          badge={id === "extensions" && openSheetCount > 0 ? openSheetCount : undefined}
        />
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
