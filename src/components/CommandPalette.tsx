/* NULL · CommandPalette.tsx
   The site search. It is not a popup with a list in it: results arrive as
   rows you can read at a glance, each one showing where it goes before you
   press it. Pages, games, apps and proxies all come from the same place. */

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";

import { PAGES, SHEET_PAGES, type PageId } from "../lib/nav";
import { LIBRARY } from "../lib/catalog";
import { go, openTab } from "../lib/tabs";

type Hit = {
  key: string;
  name: string;
  where: string;
  group: "Pages" | "Games" | "Apps" | "Proxies";
  run: () => void;
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setI(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const out: Hit[] = [];
    SHEET_PAGES.forEach((id: PageId) => {
      const p = PAGES[id];
      out.push({
        key: `p-${id}`,
        name: p.name,
        where: p.address,
        group: "Pages",
        run: () => go({ page: id }),
      });
    });
    (Object.keys(LIBRARY) as (keyof typeof LIBRARY)[]).forEach((kind) => {
      LIBRARY[kind].forEach((e) => {
        out.push({
          key: `${kind}-${e.id}`,
          name: e.name,
          where: kind === "game" ? "Games" : kind === "app" ? "Apps" : "Proxies",
          group: kind === "game" ? "Games" : kind === "app" ? "Apps" : "Proxies",
          run: () =>
            kind === "proxy"
              ? go({ page: "proxies", arg: { url: e.url ?? "" } })
              : openTab({ page: "player", arg: { kind, id: e.id, title: e.name } }),
        });
      });
    });
    return out;
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return hits.slice(0, 9);
    return hits
      .filter((h) => h.name.toLowerCase().includes(s) || h.where.toLowerCase().includes(s))
      .slice(0, 12);
  }, [q, hits]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setI((v) => Math.min(v + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setI((v) => Math.max(v - 1, 0));
      }
      if (e.key === "Enter" && filtered[i]) {
        filtered[i].run();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, i, onClose]);

  if (!open) return null;

  return (
    <div className="veil veil--search" onMouseDown={onClose} role="presentation">
      <div className="find" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="find-in">
          <Search />
          <input
            ref={inputRef}
            value={q}
            spellCheck={false}
            placeholder="Search pages, games, apps and proxies"
            aria-label="Search null"
            onChange={(e) => {
              setQ(e.target.value);
              setI(0);
            }}
          />
          <kbd>esc</kbd>
        </div>

        <div className="find-list">
          {filtered.length === 0 && (
            <p className="find-none">Nothing on null matches “{q}”.</p>
          )}
          {filtered.map((h, n) => (
            <button
              key={h.key}
              className={`find-row${n === i ? " is-on" : ""}`}
              onMouseEnter={() => setI(n)}
              onClick={() => {
                h.run();
                onClose();
              }}
            >
              <span className="find-name">{h.name}</span>
              <span className="find-tag">{h.where}</span>
              {n === i && <CornerDownLeft className="find-go" />}
            </button>
          ))}
        </div>

        <div className="find-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span className="faint">{hits.length} destinations</span>
        </div>
      </div>
    </div>
  );
}
