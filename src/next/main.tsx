import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "../styles/base.css";
import { createLocalStorageKV } from "../data/kv";
import { App } from "../app/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App kv={createLocalStorageKV()} />
  </StrictMode>,
);
