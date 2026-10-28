import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "./styles/base.css";
import { registerSW } from "virtual:pwa-register";
import { createLocalStorageKV } from "./data/kv";
import { App } from "./app/App";
import { watchFrames } from "./app/frames";
import { measureViewport } from "./app/viewport";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App kv={createLocalStorageKV()} />
  </StrictMode>,
);

measureViewport();
watchFrames(); // TEMP (wave 3): remove with src/app/frames.ts

// Update the installed app as soon as a new version is deployed (the old app's cache included).
registerSW({ immediate: true });
