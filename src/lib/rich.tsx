/* NULL · rich.tsx
   A very small amount of markup, for text the site writes to itself.

   Null Bot and the assistant both answer in the chat window, and both want to
   say "**Null Bot**" once in a while without dragging a markdown library into
   a games site. So: bold, inline code, and line breaks. Nothing else is
   interpreted — no links, no images, no nesting — which also means nothing a
   visitor types is ever rendered as markup. Everything from a person goes
   through here as plain text with the asterisks taken literally, because the
   alternative is a site where anybody can post a link that looks like a
   button.
 */

import type { ReactNode } from "react";

type Piece = { kind: "text" | "bold" | "code" | "br"; text: string };

export function parse(body: string): Piece[] {
  const out: Piece[] = [];
  /* one pass; the alternation is ordered so `**` is tried before a lone
     backtick, and a newline is its own piece so layout can break lines */
  const rx = /\*\*([\s\S]+?)\*\*|`([^`]+)`|\n/g;
  let at = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body))) {
    if (m.index > at) out.push({ kind: "text", text: body.slice(at, m.index) });
    if (m[0] === "\n") out.push({ kind: "br", text: "" });
    else if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else out.push({ kind: "code", text: m[2] });
    at = m.index + m[0].length;
  }
  if (at < body.length) out.push({ kind: "text", text: body.slice(at) });
  return out;
}

export function Rich({ body }: { body: string }): ReactNode {
  return (
    <>
      {parse(body).map((p, i) => {
        if (p.kind === "br") return <br key={i} />;
        if (p.kind === "bold") return <b key={i}>{p.text}</b>;
        if (p.kind === "code") return <code key={i}>{p.text}</code>;
        return <span key={i}>{p.text}</span>;
      })}
    </>
  );
}

/** How much of a body is markup? The chat uses it to decide whether a line
 *  needs the wider treatment, so plain sentences stay plain. */
export function hasMarkup(body: string): boolean {
  return /\*\*|`|\n/.test(body);
}
