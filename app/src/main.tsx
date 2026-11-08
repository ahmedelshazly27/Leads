import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/global.css";
import { App } from "./App";
import { initStore } from "./lib/store";
import "./styles/mobile.css"; // last: overrides page layouts on small screens

initStore();
if (import.meta.env.DEV) import("./dev").then((m) => m.installDevHooks());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
