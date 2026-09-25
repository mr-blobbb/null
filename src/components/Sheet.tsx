/* NULL · Sheet.tsx
   The one popup shape the site uses: a heavy blur behind, a flat panel in
   front, and a bare corner close button with no box around it. Everything
   that opens over a page — settings, All Apps, the gift code, add shortcut —
   is this component, so they all blur the site the same amount. */

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  /** px; the sheet never grows past the window */
  width?: number;
  /** a corner X is the default; quiet turns it off for very small prompts */
  closeButton?: boolean;
  /** an extra class for a sheet that wants to be a shape of its own — the
   *  share card takes more of the window than a form needs */
  className?: string;
};

export function Sheet({
  open,
  onClose,
  title,
  icon,
  children,
  width = 520,
  closeButton = true,
  className,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="veil" onMouseDown={onClose} role="presentation">
      <div
        className={`sheet${className ? ` ${className}` : ""}`}
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {(title || closeButton) && (
          <div className="sheet-head">
            <div className="sheet-title">
              {icon}
              {title}
            </div>
            {closeButton && (
              <button className="sheet-x" onClick={onClose} aria-label="Close">
                <X />
              </button>
            )}
          </div>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
