"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light";

function getPreferredTheme(): ThemeMode {
  if (typeof globalThis === "undefined") return "dark";

  const fromStorage = globalThis.localStorage.getItem("theme-mode");
  if (fromStorage === "dark" || fromStorage === "light") {
    return fromStorage;
  }

  return "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const preferred = getPreferredTheme();
    setTheme(preferred);
    document.documentElement.dataset.theme = preferred;
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    globalThis.localStorage.setItem("theme-mode", next);
  };

  return (
    <button
      type="button"
      className="action-btn btn-secondary"
      onClick={toggleTheme}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.38rem", fontSize: "0.8rem", padding: "0.38rem 0.58rem" }}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
