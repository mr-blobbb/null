/* NULL · Partners.tsx
   The wall. Two rows of it, and they are different kinds of wall:

   · **people** — whoever holds the PARTNER role, read from the directory, so
     the page is never a list that went stale the week after it was written.
     Each one gets a badge drawn from their own handle, which means a partner
     who joins tomorrow has one without anybody designing it.
   · **projects** — the shelves, engines and relays NULL is built on top of.
     Every game in the library comes out of one of these, and crediting them
     is the least a site that leans on them can do.

   The badges are drawn in code: a shape, a pair of colours taken from the
   name, and the initials. No artwork is fetched, so nothing on this page can
   be blocked, and nothing here goes out of date because an image 404s. */

import { useQuery } from "convex/react";
import { ExternalLink, Heart, Link2, Users } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { cloudOn } from "../lib/cloud";
import { openDestination } from "../lib/tabs";
import { NullFace } from "../lib/brand";
import { RoleChip } from "../components/RoleMark";

type MemberRow = {
  user: string;
  name: string;
  pfp: string | null;
  roles: string[];
  owner: boolean;
  verified: boolean;
  online: boolean;
};

/** A project NULL is built on. `why` is what it actually provides, because a
 *  credit that does not say what it did is a logo. */
type Friend = { name: string; handle: string; url: string; why: string };

const FRIENDS: Friend[] = [
  {
    name: "gmshelf",
    handle: "gmshelf",
    url: "https://github.com/gmshelf",
    why: "seraph, truffled, ckv and ugs — the four shelves the whole games library is read from, with their covers.",
  },
  {
    name: "Seraph",
    handle: "gmshelf/seraph",
    url: "https://github.com/gmshelf/seraph",
    why: "five hundred games in one manifest, which is what NULL's discovery script walks first.",
  },
  {
    name: "Truffled",
    handle: "gmshelf/truffled",
    url: "https://github.com/gmshelf/truffled",
    why: "another four hundred, and the shelf most of the fps and .io titles come from.",
  },
  {
    name: "Chicken King's Vault",
    handle: "gmshelf/ckv",
    url: "https://github.com/gmshelf/ckv",
    why: "the single-file games, and the cover art that the stash games borrow.",
  },
  {
    name: "Ultimate Game Stash",
    handle: "gmshelf/ugs",
    url: "https://github.com/gmshelf/ugs",
    why: "the biggest shelf here, and the one the genres are matched against.",
  },
  {
    name: "Ultraviolet",
    handle: "titaniumnetwork-dev",
    url: "https://github.com/titaniumnetwork-dev/Ultraviolet",
    why: "the rewriting proxy in the browser window: every address NULL opens goes through it.",
  },
  {
    name: "bare-mux & epoxy",
    handle: "mercuryworkshop",
    url: "https://github.com/MercuryWorkshop",
    why: "the transport underneath the proxy, and the Wisp protocol it speaks.",
  },
  {
    name: "stratus-api",
    handle: "x8rr/stratus-api",
    url: "https://github.com/x8rr/stratus-api",
    why: "the catalogue behind the cloud shelf — two hundred titles that stream rather than download.",
  },
  {
    name: "Internet Archive",
    handle: "archive.org",
    url: "https://archive.org/",
    why: "full-length audio for the music page, with no key and no account, which is why it is a source.",
  },
  {
    name: "Audius",
    handle: "audius.co",
    url: "https://audius.co/",
    why: "the other keyless music source, and the only one that streams whole modern tracks.",
  },
];

export function Partners() {
  const rows = useQuery(api.members.list, cloudOn() ? {} : "skip") as MemberRow[] | undefined;
  const live = (rows ?? []).filter((m) => m.owner || (m.roles ?? []).some((r) => r.toLowerCase() === "partner"));

  return (
    <div className="page">
      <div className="lb-top">
        <h1 className="lb-title">Partners</h1>
        <span className="lb-count tiny faint">
          {live.filter((m) => !m.owner).length} partners · {FRIENDS.length} projects
        </span>
      </div>

      <p className="pt-lede">
        NULL is a window, and a window is only as good as what it looks out on. Everybody below either
        runs a shelf this site reads, carries the traffic it makes, or is wearing the PARTNER badge in
        the chat.
      </p>

      <h2 className="pf-h">
        <Heart /> Partners
      </h2>
      {live.length === 0 ? (
        <div className="card card--pad">
          <p className="faint tiny">
            No partners yet. The owner grants the badge from a member's card, and whoever wears it is
            drawn here straight away — this list is the directory with a filter on it, not a file
            somebody remembers to edit.
          </p>
        </div>
      ) : (
        <div className="pt-grid">
          {live.map((m) => (
            <article className="pt-card" key={m.user}>
              <Badge name={m.name || m.user} />
              <div className="pt-card-txt">
                <b>{m.name || m.user}</b>
                <span className="tiny faint">@{m.user}</span>
                <span className="pt-card-tags">
                  {m.owner ? (
                    <span className="tagchip tagchip--owner">owner</span>
                  ) : (
                    m.roles
                      .filter((r) => r.toLowerCase() === "partner")
                      .map((r) => <RoleChip key={r} role={r} />)
                  )}
                  {m.verified && <span className="tagchip">verified</span>}
                  <span className={`pt-dot${m.online ? " is-on" : ""}`} />
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      <h2 className="pf-h">
        <Link2 /> What NULL is built on
      </h2>
      <div className="pt-grid">
        {FRIENDS.map((f) => (
          <article className="pt-card pt-card--wide" key={f.handle}>
            <Badge name={f.name} />
            <div className="pt-card-txt">
              <b>{f.name}</b>
              <span className="tiny faint">
                <Users /> {f.handle}
              </span>
              <p className="pt-why">{f.why}</p>
              <button className="btn btn--sm pt-go" onClick={() => openDestination({ url: f.url })}>
                <ExternalLink /> Open in NULL
              </button>
            </div>
          </article>
        ))}
      </div>

      <p className="pt-foot tiny faint">
        Want your shelf on this wall? The badge is the owner's to give, and the wall is a filter over
        the member directory: hold the role and you are on it.
      </p>
    </div>
  );
}

/* ---------- the badge ---------- */

/** A mark drawn from a name: a shape, two colours and the initials.
 *
 *  Deterministic on purpose — the same handle always gets the same badge, so
 *  it works as an identity rather than as decoration. Nothing is fetched, so
 *  a filtered network cannot cost anybody their badge. */
function Badge({ name }: { name: string }) {
  const seed = hash(name);
  const shape = seed % 5;
  const hue = seed % 360;
  const second = (hue + 40 + (seed % 60)) % 360;
  const initials = name
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className={`pt-badge pt-badge--s${shape}`}
      style={{
        background: `linear-gradient(140deg, hsl(${hue} 62% 46%), hsl(${second} 58% 32%))`,
      }}
      title={name}
      aria-hidden="true"
    >
      {initials || <NullFace />}
    </span>
  );
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
