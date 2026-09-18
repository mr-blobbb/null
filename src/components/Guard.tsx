/* NULL · Guard.tsx
   A wall between a page that fell over and the rest of the site.

   Two places need one. Around the whole app, so a bug in one page shows a way
   out instead of a blank screen. Around the cloud sections, so a server that
   is unreachable takes the member list down and nothing else — which is the
   difference between an outage and an inconvenience.

   `fallback` is either a ready-made ReactNode or a function that receives the
   error: cloud pages pass a function so the card can say what actually
   happened. Server-shaped errors (a disabled deployment, a spent usage limit)
   are reported to outage.ts so every page reads the same outage. */

import { Component, type ErrorInfo, type ReactNode } from "react";

import { NullFace } from "../lib/brand";
import { markOutage } from "../lib/outage";

type Props = { children: ReactNode; fallback?: ReactNode | ((err: Error) => ReactNode); what?: string };
type State = { broke: Error | null };

export class Guard extends Component<Props, State> {
  state: State = { broke: null };

  static getDerivedStateFromError(err: unknown): State {
    return { broke: err instanceof Error ? err : new Error(String(err ?? "unknown")) };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    /* the console is where a developer looks; the screen is where a visitor
       looks, and they should not read a stack trace */
    console.error(`NULL · ${this.props.what ?? "the app"} threw`, err, info.componentStack);
    markOutage(err);
  }

  render() {
    if (this.state.broke === null) return this.props.children;
    if (typeof this.props.fallback === "function") return this.props.fallback(this.state.broke);
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="guard">
        <span className="guard-face" aria-hidden="true">
          <NullFace />
        </span>
        <h2 className="guard-title">That page fell over.</h2>
        <p className="guard-line muted">{this.props.what ? `${this.props.what} could not finish.` : "Something went wrong while drawing it."}</p>
        <p className="guard-detail tiny faint">{this.state.broke.message}</p>
        <button className="btn btn--fill" onClick={() => this.setState({ broke: null })}>
          Try again
        </button>
      </div>
    );
  }
}
