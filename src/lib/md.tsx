/* NULL · md.tsx
   Markdown for the rooms, in two permission levels.

   A member gets bold, italics, underline and numbered lists — the four things
   that cannot be weaponised. Staff get the whole set: headers, code, code
   blocks, quotes, strikethrough, spoilers, masked links and bulleted lists,
   because the room trusts them to use markup on the room's behalf.

   Everything arrives as plain text and leaves as elements; nothing a person
   types is ever handed to the HTML engine. Spoilers are blurred until they are
   clicked, which is the one bit of state here. */

import { useState, type ReactNode } from "react";

/* ---------- inline ---------- */

type InlineOpts = { staff: boolean };

function inline(text: string, staff: boolean, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  let k = 0;

  /* order matters: the longest syntaxes first, so *** wins over ** wins over * */
  const rx = staff
    ? /\*\*\*([\s\S]+?)\*\*\*|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([\s\S]+?)\*_?|_([\s\S]+?)_|~~([\s\S]+?)~~|`([^`]+)`|```([\s\S]*?)```|\|\|([\s\S]+?)\|\||\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<]+)/g
    : /\*\*\*([\s\S]+?)\*\*\*|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([\s\S]+?)\*_?|_([\s\S]+?)_/g;

  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) {
    if (m.index > at) out.push(<span key={`${keyBase}-t${k++}`}>{text.slice(at, m.index)}</span>);
    if (m[1] !== undefined) out.push(<b key={`${keyBase}-bi${k++}`}><i>{m[1]}</i></b>);
    else if (m[2] !== undefined) out.push(<b key={`${keyBase}-b${k++}`}>{m[2]}</b>);
    else if (m[3] !== undefined) out.push(<u key={`${keyBase}-u${k++}`}>{m[3]}</u>);
    else if (m[4] !== undefined) out.push(<i key={`${keyBase}-i${k++}`}>{m[4]}</i>);
    else if (m[5] !== undefined) out.push(<i key={`${keyBase}-i${k++}`}>{m[5]}</i>);
    else if (m[6] !== undefined) out.push(<s key={`${keyBase}-s${k++}`}>{m[6]}</s>);
    else if (m[7] !== undefined) out.push(<code key={`${keyBase}-c${k++}`}>{m[7]}</code>);
    else if (m[8] !== undefined) out.push(<pre key={`${keyBase}-pre${k++}`} className="md-pre">{m[8].replace(/^\n+|\n+$/g, "")}</pre>);
    else if (m[9] !== undefined) out.push(<Spoiler key={`${keyBase}-sp${k++}`} text={m[9]} />);
    else if (m[10] !== undefined)
      out.push(
        <a key={`${keyBase}-a${k++}`} href={m[11]} target="_blank" rel="noreferrer noopener">
          {m[10]}
        </a>,
      );
    else if (m[12] !== undefined)
      out.push(
        <a key={`${keyBase}-a${k++}`} href={m[12]} target="_blank" rel="noreferrer noopener">
          {m[12].replace(/^https?:\/\//, "")}
        </a>,
      );
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(<span key={`${keyBase}-t${k++}`}>{text.slice(at)}</span>);
  return out;
}

function Spoiler({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button className={`md-spoiler${open ? " is-open" : ""}`} onClick={() => setOpen(true)}>
      {text}
    </button>
  );
}

/* ---------- block ---------- */

type Line = { kind: "p" | "h1" | "h2" | "h3" | "quote" | "ul" | "ol" | "code"; text: string; n?: number };

function blocks(body: string): Line[] {
  const lines = body.split("\n");
  const out: Line[] = [];
  let ol = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const olm = line.match(/^(\d+)\.\s+(.*)$/);
    const ulm = line.match(/^[-*]\s+(.*)$/);
    if (h) {
      ol = 0;
      out.push({ kind: `h${h[1].length}` as "h1", text: h[2] });
      continue;
    }
    if (olm) {
      ol = ol || 1;
      out.push({ kind: "ol", text: olm[2], n: parseInt(olm[1], 10) });
      continue;
    }
    ol = 0;
    if (ulm) {
      out.push({ kind: "ul", text: ulm[1] });
      continue;
    }
    if (line.startsWith("> ")) {
      out.push({ kind: "quote", text: line.slice(2) });
      continue;
    }
    if (line === "```") {
      /* the code fence: everything until the next fence is one block */
      const body2: string[] = [];
      i++;
      while (i < lines.length && lines[i] !== "```") body2.push(lines[i++]);
      out.push({ kind: "code", text: body2.join("\n") });
      continue;
    }
    if (line.trim()) out.push({ kind: "p", text: line });
  }
  return out;
}

export function Markdown({ body, staff = false, member = false }: { body: string; staff?: boolean; member?: boolean }) {
  const allow = staff || !member;
  /* a member's markup is still rendered, but only the four basic kinds land —
     the inline regex simply has fewer alternatives */
  const items = blocks(body);
  return (
    <>
      {items.map((l, i) => {
        if (l.kind === "code")
          return (
            <pre key={i} className="md-pre">
              {l.text}
            </pre>
          );
        if (l.kind === "h1") return <h4 key={i} className="md-h md-h1">{inline(l.text, allow, `l${i}`)}</h4>;
        if (l.kind === "h2") return <h5 key={i} className="md-h md-h2">{inline(l.text, allow, `l${i}`)}</h5>;
        if (l.kind === "h3") return <h6 key={i} className="md-h md-h3">{inline(l.text, allow, `l${i}`)}</h6>;
        if (l.kind === "quote") return <blockquote key={i} className="md-quote">{inline(l.text, allow, `l${i}`)}</blockquote>;
        if (l.kind === "ul")
          return (
            <div key={i} className="md-li md-li--ul">
              <i />
              <span>{inline(l.text, allow, `l${i}`)}</span>
            </div>
          );
        if (l.kind === "ol")
          return (
            <div key={i} className="md-li md-li--ol">
              <b>{l.n ?? i + 1}.</b>
              <span>{inline(l.text, allow, `l${i}`)}</span>
            </div>
          );
        return <span key={i} className="md-p">{inline(l.text, allow, `l${i}`)}</span>;
      })}
    </>
  );
}

/** Does this body use markup a member is not allowed? The composer greys the
 *  hint when it does, rather than silently stripping it. */
export function usesStaffMd(body: string): boolean {
  return /#{1,3}\s|```|~~|\|\||\[[^\]]+\]\(|^>\s|^\s*[-*]\s/m.test(body);
}
