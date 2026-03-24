import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

// Apply dark mode by default
if (!localStorage.getItem("theme") || localStorage.getItem("theme") === "dark") {
  document.documentElement.classList.add("dark");
}

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.2,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
});

createRoot(document.getElementById("root")!).render(<App />);
