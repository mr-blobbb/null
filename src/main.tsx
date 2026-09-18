import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider } from "convex/react";

import "./styles/tokens.css";
import "./styles/shell.css";
import "./styles/pages.css";
import "./styles/shop.css";
import "./styles/profile.css";
import "./styles/settings.css";
import "./styles/browser.css";
import "./styles/music.css";
import "./styles/community.css";
/* the owner's staff-role control, which the chat card and the members board
   both wear */
import "./styles/staff.css";
/* what the chat composer grew: the emoji pad, the gif shelf, the names under a
   colon — all of it chat, so it sits right after the rooms and overrides them */
import "./styles/emoji.css";
/* what the markdown renderer produces, wherever it is used */
import "./styles/markdown.css";
/* gifts and jams: the two things members do for each other */
import "./styles/social.css";
/* imported last: the quiet pass, which overrides a few wrote-in sizes */
import "./styles/refine.css";

import { App } from "./App";
import { cloud } from "./lib/cloud";
import { Guard } from "./components/Guard";

const host = document.getElementById("root");
if (!host) throw new Error("NULL: the #root element is missing from index.html");

/* With a backend the tree gains one provider, which is what makes the member
   list and the chat room share state between machines. Without one the tree is
   exactly as it was and every cloud page falls back to this browser — so the
   site is never broken by a server being absent, only quieter. */
const client = cloud();

createRoot(host).render(
  <StrictMode>
    <Guard>{client ? <ConvexProvider client={client}>{<App />}</ConvexProvider> : <App />}</Guard>
  </StrictMode>,
);
