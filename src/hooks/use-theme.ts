import { useCallback, useEffect, useState } from "react";

type ThemePrefs = {
  matchSystem: boolean;
  manualTheme: "light" | "dark";
};

const STORAGE_KEY = "lsb:theme-prefs";
const DEFAULTS: ThemePrefs = { matchSystem: true, manualTheme: "light" };

function loadPrefs(): ThemePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ThemePrefs>) };
  } catch {
    return DEFAULTS;
  }
}

function savePrefs(prefs: ThemePrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable
  }
}

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemeClass(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [prefs, setPrefsState] = useState<ThemePrefs>(loadPrefs);

  const resolvedTheme: "light" | "dark" = prefs.matchSystem
    ? getSystemTheme()
    : prefs.manualTheme;

  // Apply theme class whenever resolved theme changes.
  useEffect(() => {
    applyThemeClass(resolvedTheme === "dark");
  }, [resolvedTheme]);

  // While matchSystem is on, track OS changes in real-time.
  useEffect(() => {
    if (!prefs.matchSystem) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handle = () => applyThemeClass(mq.matches);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, [prefs.matchSystem]);

  const setPrefs = useCallback((patch: Partial<ThemePrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  return {
    matchSystem: prefs.matchSystem,
    manualTheme: prefs.manualTheme,
    resolvedTheme,
    setMatchSystem: (v: boolean) => setPrefs({ matchSystem: v }),
    setManualTheme: (v: "light" | "dark") =>
      setPrefs({ matchSystem: false, manualTheme: v }),
  };
}
