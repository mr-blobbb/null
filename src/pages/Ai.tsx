import { useEffect, useMemo, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Bot, ChevronDown, Eraser, Loader, MessageSquarePlus, Send, Sparkles, Trash2, UserRound } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import { askModel, BUILT_IN_MODEL, builtInReady, type Said as Turn } from "../lib/ai";
import { cloudOn, machine } from "../lib/cloud";
import { CloudDown } from "../lib/outage";
import { createStore, useStore } from "../lib/store";
import { Markdown } from "../lib/md";

type Line = { id: string; who: "you" | "ai"; body: string; at: number };
type Thread = { id: string; title: string; lines: Line[]; updated: number };
type State = { threads: Thread[]; active: string };
type Said = { ready: boolean; provider: string | null };

const ai = createStore<State>("ai", { threads: [], active: "" });
const IDEAS = [
  "explain the monty hall problem",
  "write a haiku about mondays",
  "what should i cook with rice and eggs?",
  "help me word a text asking for an extension",
  "why is my css not applying?",
];

function fresh(): Thread {
  const now = Date.now();
  return { id: `thread-${now}-${Math.random().toString(36).slice(2, 7)}`, title: "New conversation", lines: [], updated: now };
}
function ensure(state: State): State {
  if (state.threads.length && state.threads.some((t) => t.id === state.active)) return state;
  const t = state.threads[0] ?? fresh();
  return { threads: state.threads.length ? state.threads : [t], active: t.id };
}
function estimate(lines: Line[]): number {
  return Math.ceil(lines.reduce((n, l) => n + l.body.length, 0) / 4);
}

export function Ai() {
  if (!cloudOn()) return <div className="page"><div className="lb-top"><h1 className="lb-title">Assistant</h1><span className="lb-count tiny faint">offline</span></div><div className="card card--pad"><p>The assistant runs on the server and this build cannot reach one. Everything else on NULL still works.</p></div></div>;
  return <Guard what="AI" fallback={(err) => <CloudDown what="AI" err={err} key={err.message} />}><Desk /></Guard>;
}

function Desk() {
  const state = useStore(ai);
  const safe = useMemo(() => ensure(state), [state]);
  const thread = safe.threads.find((t) => t.id === safe.active) ?? safe.threads[0];
  const lines = thread?.lines ?? [];
  const ask = useAction(api.ai.ask);
  const status = useAction(api.ai.status);
  const canAsk = typeof ask === "function" && typeof status === "function";
  const [said, setSaid] = useState<Said | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const builtin = builtInReady();
  const ready = said !== null && (said.ready || builtin);

  useEffect(() => {
    if (safe.active !== state.active || safe.threads.length !== state.threads.length) ai.set(safe);
  }, [safe, state.active, state.threads.length]);
  useEffect(() => {
    let alive = true;
    if (!status) { setSaid({ ready: false, provider: null }); return; }
    status({}).then((r) => alive && setSaid(r as Said)).catch(() => alive && setSaid({ ready: false, provider: null }));
    return () => { alive = false; };
  }, [status]);
  useEffect(() => { const el = feed.current; if (el) el.scrollTop = el.scrollHeight; }, [lines.length, busy, safe.active]);

  const saveLines = (next: Line[], title?: string) => {
    const now = Date.now();
    ai.set({ ...safe, active: thread.id, threads: safe.threads.map((t) => t.id === thread.id ? { ...t, lines: next, title: title ?? t.title, updated: now } : t) });
  };
  const newThread = () => { const t = fresh(); ai.set({ threads: [t, ...safe.threads], active: t.id }); setDraft(""); setProblem(null); };
  const removeThread = (id: string) => {
    const left = safe.threads.filter((t) => t.id !== id);
    const next = left.length ? left : [fresh()];
    ai.set({ threads: next, active: id === safe.active ? next[0].id : safe.active });
  };

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const mine: Line = { id: `m${Date.now()}`, who: "you", body: q, at: Date.now() };
    const history = [...lines, mine];
    saveLines(history, thread.title === "New conversation" ? q.slice(0, 38) : undefined);
    setDraft(""); setBusy(true); setProblem(null);
    const turns: Turn[] = history.map((l) => ({ role: l.who === "you" ? "user" : "assistant", content: l.body }));
    try {
      let answer: { ok: true; text: string } | { ok: false; reason: string };
      if (said?.ready && canAsk) {
        try { const res = await ask({ messages: turns }); answer = res.ok ? { ok: true, text: res.text } : { ok: false, reason: res.reason }; }
        catch (e) { answer = { ok: false, reason: (e as Error).message.replace(/^.*?Error: /, "") }; }
        if (!answer.ok && builtin) answer = await askModel(turns);
      } else answer = await askModel(turns);
      if (answer.ok) saveLines([...ai.get().threads.find((t) => t.id === thread.id)!.lines, { id: `a${Date.now()}`, who: "ai", body: answer.text, at: Date.now() }]);
      else setProblem(answer.reason);
    } finally { setBusy(false); }
  }

  return <div className="page ai">
    <div className="lb-top ai-top"><div><h1 className="lb-title">Assistant</h1><span className="lb-count tiny faint"><Bot /> {said === null ? "checking…" : ready ? `running on ${said.ready ? said.provider : BUILT_IN_MODEL}` : "no key set"}</span></div><button className="btn btn--sm" onClick={newThread}><MessageSquarePlus /> New</button></div>
    <div className="ai-layout">
      <aside className="ai-threads" aria-label="Conversation history">
        <div className="ai-threads-head"><span>Conversations</span><button className="btn btn--xs" onClick={newThread} title="New conversation"><MessageSquarePlus /></button></div>
        <div className="ai-thread-list">{safe.threads.map((t) => <div key={t.id} className={`ai-thread${t.id === safe.active ? " is-on" : ""}`}><button onClick={() => ai.set({ ...safe, active: t.id })}><b>{t.title}</b><small>{t.lines.length ? `${t.lines.length} messages` : "Empty"}</small></button>{safe.threads.length > 1 && <button className="ai-thread-del" onClick={() => removeThread(t.id)} aria-label={`Delete ${t.title}`}><Trash2 /></button>}</div>)}</div>
      </aside>
      <section className="card ai-window">
        <div className="ai-toolbar"><label>Model<select value="gpt-4o-mini" onChange={() => {}} aria-label="Model"><option value="gpt-4o-mini">GPT-4o mini · Active</option><option value="other" disabled>Other models… · Coming Soon</option></select><ChevronDown /></label><span className="ai-usage">~{estimate(lines).toLocaleString()} tokens used</span>{lines.length > 0 && <button className="btn btn--xs" onClick={() => saveLines([])}><Eraser /> Clear</button>}</div>
        <div className="ai-feed" ref={feed}>
          {lines.length === 0 && <div className="ai-hello"><span className="ai-hello-pic"><Bot /></span><h2>Ask me anything</h2><p className="faint">A thorough general-purpose assistant. Code, homework, writing, dinner, whatever.</p><div className="ai-ideas">{IDEAS.map((idea) => <button key={idea} className="ai-idea" onClick={() => void send(idea)} disabled={!ready || busy}>{idea}</button>)}</div></div>}
          {lines.map((l) => <div key={l.id} className={`ai-say is-${l.who}`}><span className="ai-pic">{l.who === "you" ? <UserRound /> : <Bot />}</span><div className="ai-say-body"><Markdown body={l.body} staff /></div></div>)}
          {busy && <div className="ai-say is-ai"><span className="ai-pic"><Bot /></span><div className="ai-say-body ai-thinking"><Loader className="px-spin" /> thinking…</div></div>}
          {problem && <p className="ai-problem">{problem}</p>}
        </div>
        <div className="ai-box"><textarea className="ch-input" rows={1} value={draft} placeholder={ready ? "Ask anything…" : "Waiting for a key on the deployment"} disabled={!ready} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(draft); } }} /><button className="btn btn--fill ch-send" disabled={!ready || busy || !draft.trim()} onClick={() => void send(draft)}><Send /> Send</button></div>
      </section>
    </div>
    <p className="tiny faint ai-foot">Model GPT-4o mini · machine <span className="mono">{machine}</span> · usage is an estimate (characters ÷ 4) and is kept per conversation.</p>
  </div>;
}
