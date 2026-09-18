/* NULL · Ai.tsx
   The assistant: a general chatbot, not a manual for the site.

   Two different things on this site get called a bot, and they are different
   on purpose. Null Bot — in the chat rooms — is a lookup table: it answers
   $playerdata and $rich from data NULL already has, and it can never be
   wrong. This page is a model, and a model can be wrong, which is why it
   lives behind its own door instead of in the room where people are comparing
   scores. Ask it for code, for dinner, for an explanation of something — the
   site is only ever a question away, it is not the subject.

   The conversation is kept in this browser, like everything else, so closing
   the tab does not throw it away. The server road is asked first, because
   there the key stays on the deployment where nobody can read it; a build
   with no key set there falls back to src/lib/ai.ts, which carries a
   scrambled key of its own so the assistant still answers. */

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Bot, Eraser, Loader, Send, Sparkles, UserRound } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import { askModel, BUILT_IN_MODEL, builtInReady, type Said as Turn } from "../lib/ai";
import { cloudOn, machine } from "../lib/cloud";
import { CloudDown } from "../lib/outage";
import { createStore, useStore } from "../lib/store";
import { Markdown } from "../lib/md";

type Line = { id: string; who: "you" | "ai"; body: string; at: number };
type Said = { ready: boolean; provider: string | null };

/* kept between visits, like the profile: a conversation you lose by switching
   tabs is a conversation nobody has */
const ai = createStore<{ lines: Line[] }>("ai", { lines: [] });

/* Openers that show what this thing is for. Deliberately not about NULL. */
const IDEAS = [
  "explain the monty hall problem",
  "write a haiku about mondays",
  "what should i cook with rice and eggs?",
  "help me word a text asking for an extension",
  "why is my css not applying?",
];

export function Ai() {
  if (!cloudOn()) {
    return (
      <div className="page">
        <div className="lb-top">
          <h1 className="lb-title">Assistant</h1>
          <span className="lb-count tiny faint">offline</span>
        </div>
        <div className="card card--pad">
          <p>
            The assistant runs on the server — an API key must never ship to a browser — and
            this build cannot reach one. Everything else on NULL still works.
          </p>
        </div>
      </div>
    );
  }
  return (
    <Guard what="AI" fallback={(err) => <CloudDown what="AI" err={err} key={err.message} />}>
      <Desk />
    </Guard>
  );
}

function Desk() {
  const lines = useStore(ai).lines;
  /* useAction hands back nothing when the provider is missing; the page then
     runs on the built-in road, which is exactly what that road is for */
  const ask = useAction(api.ai.ask);
  const status = useAction(api.ai.status);
  const canAsk = typeof ask === "function" && typeof status === "function";

  /* asked once on mount: whether a key exists is not something that changes
     while the page is open */
  const [said, setSaid] = useState<Said | null>(null);
  useEffect(() => {
    let alive = true;
    if (!status) {
      setSaid({ ready: false, provider: null });
      return;
    }
    status({})
      .then((r) => alive && setSaid(r as Said))
      .catch(() => alive && setSaid({ ready: false, provider: null }));
    return () => {
      alive = false;
    };
  }, [status]);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const feed = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, busy]);

  const builtin = builtInReady();
  const ready = said !== null && (said.ready || builtin);

  /** Which road an answer takes: the deployment's key when it has one, and
   *  the one this build carries otherwise. A server that answers with a
   *  failure falls through to the build's, so a missing key is not a dead
   *  assistant. */
  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;

    const mine: Line = { id: `m${Date.now()}`, who: "you", body: q, at: Date.now() };
    const history = [...lines, mine];
    ai.set({ lines: history });
    setDraft("");
    setBusy(true);
    setProblem(null);

    const turns: Turn[] = history.map((l) => ({
      role: l.who === "you" ? "user" : "assistant",
      content: l.body,
    }));

    try {
      let answer: { ok: true; text: string } | { ok: false; reason: string };
      if (said?.ready && canAsk) {
        try {
          const res = await ask({ messages: turns });
          answer = res.ok ? { ok: true, text: res.text } : { ok: false, reason: res.reason };
        } catch (e) {
          answer = { ok: false, reason: (e as Error).message.replace(/^.*?Error: /, "") };
        }
        if (!answer.ok && builtin) answer = await askModel(turns);
      } else {
        answer = await askModel(turns);
      }

      if (answer.ok) {
        ai.set({
          lines: [...ai.get().lines, { id: `a${Date.now()}`, who: "ai", body: answer.text, at: Date.now() }],
        });
      } else {
        setProblem(answer.reason);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page ai">
      <div className="lb-top">
        <h1 className="lb-title">Assistant</h1>
        <span className="lb-count tiny faint">
          <Bot />
          {said === null
            ? "checking…"
            : ready
              ? `running on ${said.ready ? said.provider : BUILT_IN_MODEL}`
              : "no key set"}
        </span>
        {lines.length > 0 && (
          <button className="btn btn--sm" onClick={() => ai.set({ lines: [] })}>
            <Eraser /> Clear
          </button>
        )}
      </div>

      {said && !ready && !builtin && (
        <div className="card card--pad ai-setup">
          <h3 className="set-h">
            <Sparkles /> One command and this works
          </h3>
          <p className="set-note">
            The assistant needs a model key on the deployment, where no browser can read it.
            Any of these will do — Groq's free tier is the quickest to get:
          </p>
          <pre className="ai-cmd">
            {`npx convex env set GROQ_API_KEY <your key>
npx convex env set OPENROUTER_API_KEY <your key>   # or
npx convex env set OPENAI_API_KEY <your key>`}
          </pre>
          <p className="tiny faint">
            Then reload. Nothing else on NULL needs a key — the music player and the chat
            rooms work without one.
          </p>
        </div>
      )}

      <div className="card ai-window">
        <div className="ai-feed" ref={feed}>
          {lines.length === 0 && (
            <div className="ai-hello">
              <span className="ai-hello-pic">
                <Bot />
              </span>
              <h2>Ask me anything</h2>
              <p className="faint">
                Not a guide to this site — just a chatbot, and a thorough one. Code, homework,
                writing, dinner, whatever, with the working shown. It can be wrong, and it
                says so when it does not know.
              </p>
              <div className="ai-ideas">
                {IDEAS.map((idea) => (
                  <button
                    key={idea}
                    className="ai-idea"
                    onClick={() => void send(idea)}
                    disabled={!ready || busy}
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          )}

          {lines.map((l) => (
            <div key={l.id} className={`ai-say is-${l.who}`}>
              <span className="ai-pic">{l.who === "you" ? <UserRound /> : <Bot />}</span>
              {/* the assistant is told to answer in markdown, so the feed
                  renders the whole set: headings, lists, code, quotes, links */}
              <div className="ai-say-body">
                <Markdown body={l.body} staff />
              </div>
            </div>
          ))}

          {busy && (
            <div className="ai-say is-ai">
              <span className="ai-pic">
                <Bot />
              </span>
              <div className="ai-say-body ai-thinking">
                <Loader className="px-spin" /> thinking…
              </div>
            </div>
          )}

          {problem && <p className="ai-problem">{problem}</p>}
        </div>

        <div className="ai-box">
          <textarea
            className="ch-input"
            rows={1}
            value={draft}
            placeholder={ready ? "Ask anything…" : "Waiting for a key on the deployment"}
            disabled={!ready}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
          />
          <button
            className="btn btn--fill ch-send"
            disabled={!ready || busy || !draft.trim()}
            onClick={() => void send(draft)}
          >
            <Send /> Send
          </button>
        </div>
      </div>

      <p className="tiny faint ai-foot">
        Machine <span className="mono">{machine}</span> · the conversation is kept in this
        browser. {said?.ready
          ? "The key it runs on lives on the deployment."
          : "This build carries its own key, scrambled — set OPENROUTER_API_KEY on the deployment to move it off the client."}
      </p>
    </div>
  );
}
