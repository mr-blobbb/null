import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider } from "convex/react";

import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/shell.css";
import "./styles/pages.css";
import "./styles/shop.css";
import "./styles/profile.css";
import "./styles/settings.css";
import "./styles/browser.css";
import "./styles/music.css";
import "./styles/community.css";
import "./styles/voice.css";
import "./styles/saves.css";
import "./styles/account.css";
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
/* the messages page, which is the one place a conversation gets a whole
   window instead of a pop-out */
import "./styles/messages.css";
/* assistant controls and thread history */
import "./styles/ai.css";
/* imported last: the quiet pass, which overrides a few wrote-in sizes */
import "./styles/refine.css";
/* final cross-browser layout and overflow audit */
import "./styles/audit.css";

import { App } from "./App";
import { cloud } from "./lib/cloud";
import { Guard } from "./components/Guard";

const host = document.getElementById("root");
if (!host) throw new Error("NULL: the #root element is missing from index.html");

/* Shared community features always use the same Convex provider. They do not
   silently switch to browser storage when the deployment is unavailable. */
const client = cloud();

createRoot(host).render(
  <StrictMode>
    <Guard>{client ? <ConvexProvider client={client}>{<App />}</ConvexProvider> : <App />}</Guard>
  </StrictMode>,
);
