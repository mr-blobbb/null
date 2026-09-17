/* NULL · Ai.tsx
   The assistant.

   Two different things on this site get called a bot, and they are different
   on purpose. Null Bot — in the chat rooms — is a lookup table: it answers
   $playerdata and $rich from data NULL already has, and it can never be
   wrong. This page is a model, and a model can be wrong, which is why it
   lives behind its own door instead of in the room where people are comparing
   scores.

   The conversation is kept in this browser, like everything else, so closing
   the tab does not throw it away. The key is not here at all: the call goes
   to the Convex action, which reads it from the deployment's environment. */

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Bot, Eraser, Loader, Send, Sparkles, UserRound } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import { cloudOn, machine } from "../lib/cloud";
import { createStore, useStore } from "../lib/store";
import { Rich } from "../lib/rich";

type Line = { id: string; who: "you" | "ai"; body: string; at: number };
type Said = { ready: boolean; provider: string | null };

/* kept between visits, like the profile: a conversation you lose by switching
   tabs is a conversation nobody has */
const ai = createStore<{ lines: Line[] }>("ai", { lines: [] });

const IDEAS = [
  "what is null?",
  "where do the coins come from?",
  "which page has movies?",
  "how do i add my own game?",
  "what can $ commands do?",
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
    <Guard what="the assistant">
      <Desk />
    </Guard>
  );
}

function Desk() {
  const lines = useStore(ai).lines;
  const ask = useAction(api.ai.ask);
  const status = useAction(api.ai.status);

  /* asked once on mount: whether a key exists is not something that changes
     while the page is open */
  const [said, setSaid] = useState<Said | null>(null);
  useEffect(() => {
    let alive = true;
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

  const ready = said?.ready === true;

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;

    const mine: Line = { id: `m${Date.now()}`, who: "you", body: q, at: Date.now() };
    const history = [...lines, mine];
    ai.set({ lines: history });
    setDraft("");
    setBusy(true);
    setProblem(null);

    try {
      const res = await ask({
        messages: history.map((l) => ({ role: l.who === "you" ? "user" : "assistant", content: l.body })),
      });
      if (res.ok) {
        ai.set({
          lines: [...ai.get().lines, { id: `a${Date.now()}`, who: "ai", body: res.text, at: Date.now() }],
        });
      } else {
        setProblem(res.reason);
      }
    } catch (e) {
      setProblem((e as Error).message.replace(/^.*?Error: /, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page ai">
      <div className="lb-top">
        <h1 className="lb-title">Assistant</h1>
        <span className="lb-count tiny faint">
          <Bot /> {said === null ? "checking…" : ready ? `running on ${said.provider}` : "no key set"}
        </span>
        {lines.length > 0 && (
          <button className="btn btn--sm" onClick={() => ai.set({ lines: [] })}>
            <Eraser /> Clear
          </button>
        )}
      </div>

      {said && !ready && (
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
              <h2>Ask me about null</h2>
              <p className="faint">
                What the pages do, where the coins come from, how the browser works. Short
                answers, and it says when it does not know.
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
              <div className="ai-say-body">
                <Rich body={l.body} />
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
            placeholder={ready ? "Ask about null…" : "Waiting for a key on the deployment"}
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
        browser, and the key only ever lives on the server.
      </p>
    </div>
  );
}
