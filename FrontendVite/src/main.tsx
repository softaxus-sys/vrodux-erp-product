import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { AppProviders } from "@/components/providers/app-providers";
import { App } from "./App";
import { initDesktopApiUrl, isDesktop } from "@/lib/desktop";
import "./index.css";

// ── Global error boundary — shows a readable crash screen instead of blank page ──
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ padding: 32, fontFamily: "monospace" }}>
          <h2 style={{ color: "#ef4444" }}>App crashed — open DevTools console for details</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{err.message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, opacity: 0.6 }}>{err.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Electron loads from file:// — BrowserRouter can't handle that, so use HashRouter
const Router = isDesktop ? HashRouter : BrowserRouter;

async function boot() {
  await initDesktopApiUrl();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Router>
          <AppProviders>
            <App />
          </AppProviders>
        </Router>
      </ErrorBoundary>
    </React.StrictMode>
  );
}

boot();
