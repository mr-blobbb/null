/* NULL · vote.ts
   The staff vote, read out of a message.

   A poll is not a separate thing to post: it is a line in the message, which
   is why it can sit under a paragraph of prose the way the announcement does —

     # attention null users!
     we are selecting a new default UI menu option! vote below:
     /vote #keep the current UI #change it plz it sucks #which UI option should we use?

   Everything after the last # is the question, everything before it is an
   option. The line itself is taken out of the body before it is stored, so the
   message reads as prose and the poll is drawn under it.

   Only staff get here — the server checks that as well, because a client is a
   claim and never a fact. */

export type Choice = { id: string; text: string };

/** A choice and who picked it. Votes are a list, never an object keyed by
 *  anything, which is the shape Convex will actually store. */
export type Tally = { id: string; by: string[] };

export type Poll = { title: string; options: Choice[]; votes: Tally[] };

/** What a message carries to the server: the prose, and the poll if any. */
export type Vote = { body: string; poll: { title: string; options: Choice[] } | null };

const LINE = /^[ \t]*\/vote\b[^\n]*$/im;
const MAX_OPTIONS = 6;
const MAX_TEXT = 80;
const MAX_TITLE = 90;

/** Read a `/vote` line out of a draft. No line, or a line with nothing to
 *  choose between, leaves the text exactly as it was typed. */
export function parseVote(text: string): Vote {
  const found = LINE.exec(text);
  if (!found) return { body: text.trim(), poll: null };

  const said = found[0].replace(/^[ \t]*\/vote\b/i, "").split("#");
  const parts = said.map((s) => s.trim()).filter(Boolean);
  /* "# one thing" is not a vote: it needs a second choice to mean anything */
  if (parts.length < 2) return { body: text.trim(), poll: null };

  const titled = parts.length > 2;
  const title = titled ? parts[parts.length - 1] : "Vote";
  const options = (titled ? parts.slice(0, -1) : parts).slice(0, MAX_OPTIONS);

  return {
    body: text.replace(found[0], "").trim(),
    poll: {
      title: title.slice(0, MAX_TITLE),
      options: options.map((t, i) => ({ id: `o${i + 1}`, text: t.slice(0, MAX_TEXT) })),
    },
  };
}

/** The count on one choice. */
export function countOf(poll: Poll, id: string): number {
  return poll.votes.find((v) => v.id === id)?.by.length ?? 0;
}

export function totalVotes(poll: Poll): number {
  return poll.options.reduce((n, o) => n + countOf(poll, o.id), 0);
}

/** Which choice this person picked, or null while they have not. */
export function myChoice(poll: Poll, handle: string): string | null {
  const who = handle.replace(/^@/, "").trim().toLowerCase();
  const hit = poll.options.find((o) => (poll.votes.find((v) => v.id === o.id)?.by ?? []).includes(who));
  return hit?.id ?? null;
}
