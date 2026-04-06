import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./App";
import "./index.css";

// Apply the saved theme class synchronously before first paint (no flash).
(function applyInitialTheme() {
  try {
    const raw = localStorage.getItem("lsb:theme-prefs");
    const prefs = raw ? (JSON.parse(raw) as { matchSystem?: boolean; manualTheme?: string }) : null;
    const matchSystem = prefs?.matchSystem !== false; // default true
    const dark = matchSystem
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : prefs?.manualTheme === "dark";
    document.documentElement.classList.toggle("dark", dark);
  } catch {
    document.documentElement.classList.toggle(
      "dark",
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
  }
})();

// Watches <html class="..."> for changes so the Toaster theme stays in sync
// with whatever the useTheme hook applies to the document.
function useDocumentTheme(): "light" | "dark" {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark")),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark ? "dark" : "light";
}

function Root() {
  const theme = useDocumentTheme();
  return (
    <TooltipProvider delay={200}>
      <App />
      <Toaster
        position="bottom-right"
        theme={theme}
        gap={8}
        toastOptions={{
          classNames: {
            toast: "font-sans rounded-xl border shadow-md px-4 py-3 text-sm",
            title: "font-semibold tracking-tight text-[13px]",
            description: "text-[12px] mt-0.5 opacity-60",
            success: "!border-emerald-500/20 [&_[data-icon]]:text-emerald-500",
            error: "!border-destructive/20 [&_[data-icon]]:text-destructive",
            closeButton: "!top-3 !right-3 opacity-50 hover:opacity-100",
          },
          duration: 4000,
        }}
      />
    </TooltipProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
