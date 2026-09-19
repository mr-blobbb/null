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

import { packOf, stickerOf, twemojiOf } from "./packs";

/* ---------- inline ---------- */

function inline(text: string, staff: boolean, keyBase: string, packs = false): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  let k = 0;

  /* order matters: the longest syntaxes first, so *** wins over ** wins over *
     The trailing :name: group is the custom packs — a colon-word-colon that
     is an emoji name or a sticker. It only matches when the caller said the
     room renders packs, so the changelog and the shop never turn a plain
     "look :here:" into a missing picture.

     Named groups, because a member's regex and a staff member's regex have
     different lengths, and a handler reading numbered groups silently reads
     the wrong one across the two. */
  const rx = staff
    ? /\*\*\*(?<bi>[\s\S]+?)\*\*\*|\*\*(?<b>[\s\S]+?)\*\*|__(?<u>[\s\S]+?)__|\*(?<i>[\s\S]+?)\*_?|_(?<i2>[\s\S]+?)_|~~(?<s>[\s\S]+?)~~|`(?<c>[^`]+)`|```(?<pre>[\s\S]*?)```|\|\|(?<sp>[\s\S]+?)\|\||\[(?<lt>[^\]]+)\]\((?<lh>https?:\/\/[^)\s]+)\)|(?<ul>https?:\/\/[^\s<]+)|:(?<pk>[a-z0-9_+-]{1,32}):/g
    : /\*\*\*(?<bi>[\s\S]+?)\*\*\*|\*\*(?<b>[\s\S]+?)\*\*|__(?<u>[\s\S]+?)__|\*(?<i>[\s\S]+?)\*_?|_(?<i2>[\s\S]+?)_|:(?<pk>[a-z0-9_+-]{1,32}):/g;

  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) {
    const g = (m.groups ?? {}) as Record<string, string | undefined>;
    if (m.index > at) out.push(<span key={`${keyBase}-t${k++}`}>{text.slice(at, m.index)}</span>);
    if (g.bi !== undefined) out.push(<b key={`${keyBase}-bi${k++}`}><i>{g.bi}</i></b>);
    else if (g.b !== undefined) out.push(<b key={`${keyBase}-b${k++}`}>{g.b}</b>);
    else if (g.u !== undefined) out.push(<u key={`${keyBase}-u${k++}`}>{g.u}</u>);
    else if (g.i !== undefined) out.push(<i key={`${keyBase}-i${k++}`}>{g.i}</i>);
    else if (g.i2 !== undefined) out.push(<i key={`${keyBase}-i2${k++}`}>{g.i2}</i>);
    else if (g.s !== undefined) out.push(<s key={`${keyBase}-s${k++}`}>{g.s}</s>);
    else if (g.c !== undefined) out.push(<code key={`${keyBase}-c${k++}`}>{g.c}</code>);
    else if (g.pre !== undefined) out.push(<pre key={`${keyBase}-pre${k++}`} className="md-pre">{g.pre.replace(/^\n+|\n+$/g, "")}</pre>);
    else if (g.sp !== undefined) out.push(<Spoiler key={`${keyBase}-sp${k++}`} text={g.sp} />);
    else if (g.lt !== undefined)
      out.push(
        <a key={`${keyBase}-a${k++}`} href={g.lh} target="_blank" rel="noreferrer noopener">
          {g.lt}
        </a>,
      );
    else if (g.ul !== undefined)
      out.push(
        <a key={`${keyBase}-a${k++}`} href={g.ul} target="_blank" rel="noreferrer noopener">
          {g.ul.replace(/^https?:\/\//, "")}
        </a>,
      );
    else if (g.pk !== undefined) {
      /* a named pack: a Twemoji picture when the word is one of ours, a
         sticker when it answers to st-…, and the raw text when it is neither
         — somebody writing :sus: is left exactly as they wrote it. Rooms opt
         in with the packs flag; a changelog that says "look :here:" stays
         prose. */
      const name = g.pk.toLowerCase();
      const sticker = packs ? stickerOf(name) : null;
      const char = packs && !sticker ? packOf(name) : null;
      const pic = char ? twemojiOf(char) : null;
      if (sticker) out.push(<img key={`${keyBase}-st${k++}`} className="md-sticker" src={sticker.url} alt={`:${name}:`} title={`:${name}:`} loading="lazy" decoding="async" />);
      else if (pic) out.push(<img key={`${keyBase}-pe${k++}`} className="md-pack" src={pic} alt={char!} title={`:${name}:`} loading="lazy" decoding="async" />);
      else out.push(<span key={`${keyBase}-pt${k++}`}>{m[0]}</span>);
    }
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

type Line =
  | { kind: "p" | "h1" | "h2" | "h3" | "quote" | "ul" | "ol" | "code"; text: string; n?: number; lang?: string }
  | { kind: "table"; head: string[]; rows: string[][] };

/** A fence line, with or without a language on it. ```` ```python ```` has
 *  always been the way a person writes a code block, and a parser that only
 *  understands a bare fence prints the fence at them. */
const FENCE = /^\s*```(\S+)?\s*$/;

/** The `|---|---|` line under a table's header. */
const RULE = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

function cells(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

function blocks(body: string): Line[] {
  const lines = body.split("\n");
  const out: Line[] = [];
  let ol = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const olm = line.match(/^(\d+)\.\s+(.*)$/);
    const ulm = line.match(/^[-*]\s+(.*)$/);
    const fence = line.match(FENCE);
    if (h) {
      ol = 0;
      out.push({ kind: `h${h[1].length}` as "h1", text: h[2] });
      continue;
    }
    if (fence) {
      /* everything to the closing fence is one block, verbatim */
      ol = 0;
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) code.push(lines[i++]);
      out.push({ kind: "code", text: code.join("\n"), lang: fence[1] });
      continue;
    }
    if (olm) {
      ol = ol || 1;
      out.push({ kind: "ol", text: olm[2], n: parseInt(olm[1], 10) });
      continue;
    }
    ol = 0;
    /* a table is a row of cells with a rule under it, and everything after it
       that still holds a pipe */
    if (line.includes("|") && lines[i + 1] && RULE.test(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].includes("|") && lines[j].trim()) rows.push(cells(lines[j++]));
      i = j - 1;
      out.push({ kind: "table", head, rows });
      continue;
    }
    if (ulm) {
      out.push({ kind: "ul", text: ulm[1] });
      continue;
    }
    if (line.startsWith("> ")) {
      out.push({ kind: "quote", text: line.slice(2) });
      continue;
    }
    if (line.trim()) out.push({ kind: "p", text: line });
  }
  return out;
}

export function Markdown({ body, staff = false, member = false, packs = false }: { body: string; staff?: boolean; member?: boolean; packs?: boolean }) {
  const allow = staff || !member;
  /* a member's markup is still rendered, but only the four basic kinds land —
     the inline regex simply has fewer alternatives */
  const items = blocks(body);
  return (
    <>
      {items.map((l, i) => {
        if (l.kind === "code")
          return (
            <pre key={i} className={`md-pre${l.lang ? " md-pre--lang" : ""}`}>
              {l.text}
            </pre>
          );
        if (l.kind === "table")
          return (
            <span key={i} className="md-table-wrap">
              <table className="md-table">
                <thead>
                  <tr>
                    {l.head.map((c, j) => (
                      <th key={j}>{inline(c, allow, `t${i}h${j}`, packs)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {l.rows.map((row, j) => (
                    <tr key={j}>
                      {row.map((c, k) => (
                        <td key={k}>{inline(c, allow, `t${i}r${j}c${k}`, packs)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </span>
          );
        if (l.kind === "h1") return <h4 key={i} className="md-h md-h1">{inline(l.text, allow, `l${i}`, packs)}</h4>;
        if (l.kind === "h2") return <h5 key={i} className="md-h md-h2">{inline(l.text, allow, `l${i}`, packs)}</h5>;
        if (l.kind === "h3") return <h6 key={i} className="md-h md-h3">{inline(l.text, allow, `l${i}`, packs)}</h6>;
        if (l.kind === "quote") return <blockquote key={i} className="md-quote">{inline(l.text, allow, `l${i}`, packs)}</blockquote>;
        if (l.kind === "ul")
          return (
            <div key={i} className="md-li md-li--ul">
              <i />
              <span>{inline(l.text, allow, `l${i}`, packs)}</span>
            </div>
          );
        if (l.kind === "ol")
          return (
            <div key={i} className="md-li md-li--ol">
              <b>{l.n ?? i + 1}.</b>
              <span>{inline(l.text, allow, `l${i}`, packs)}</span>
            </div>
          );
        return <span key={i} className="md-p">{inline(l.text, allow, `l${i}`, packs)}</span>;
      })}
    </>
  );
}

/** Does this body use markup a member is not allowed? The composer greys the
 *  hint when it does, rather than silently stripping it. */
export function usesStaffMd(body: string): boolean {
  return /#{1,3}\s|```|~~|\|\||\[[^\]]+\]\(|^>\s|^\s*[-*]\s|^\s*\|.*\|/m.test(body);
}
