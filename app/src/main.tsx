import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { initStore } from "./lib/store";
import "./styles/global.css";

initStore();
if (import.meta.env.DEV) import("./dev").then((m) => m.installDevHooks());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
