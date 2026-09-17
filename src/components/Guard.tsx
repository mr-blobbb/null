/* NULL · Guard.tsx
   A wall between a page that fell over and the rest of the site.

   Two places need one. Around the whole app, so a bug in one page shows a way
   out instead of a blank screen. Around the cloud sections, so a server that
   is unreachable takes the member list down and nothing else — which is the
   difference between an outage and an inconvenience. */

import { Component, type ErrorInfo, type ReactNode } from "react";

import { NullFace } from "../lib/brand";

type Props = { children: ReactNode; fallback?: ReactNode; what?: string };
type State = { broke: string | null };

export class Guard extends Component<Props, State> {
  state: State = { broke: null };

  static getDerivedStateFromError(err: unknown): State {
    return { broke: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    /* the console is where a developer looks; the screen is where a visitor
       looks, and they should not read a stack trace */
    console.error(`NULL · ${this.props.what ?? "the app"} threw`, err, info.componentStack);
  }

  render() {
    if (this.state.broke === null) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="guard">
        <span className="guard-face" aria-hidden="true">
          <NullFace />
        </span>
        <h2 className="guard-title">That page fell over.</h2>
        <p className="guard-line muted">{this.props.what ? `${this.props.what} could not finish.` : "Something went wrong while drawing it."}</p>
        <p className="guard-detail tiny faint">{this.state.broke}</p>
        <button className="btn btn--fill" onClick={() => this.setState({ broke: null })}>
          Try again
        </button>
      </div>
    );
  }
}
