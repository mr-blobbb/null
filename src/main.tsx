import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles/tokens.css";
import "./styles/shell.css";
import "./styles/pages.css";
import "./styles/shop.css";
import "./styles/profile.css";
import "./styles/settings.css";

import { App } from "./App";

const host = document.getElementById("root");
if (!host) throw new Error("NULL: the #root element is missing from index.html");

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
