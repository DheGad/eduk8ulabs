"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * ThemeToggle — Hydration-safe.
 *
 * The server never knows the user's theme preference (it's stored in
 * localStorage). Without a `mounted` guard the server renders one icon
 * (e.g. Moon) and the client immediately swaps it to another (Sun),
 * causing React's Hydration Mismatch error and a cascade of 500s.
 *
 * Fix: render a neutral placeholder until the component has mounted on
 * the client. This ensures server HTML === initial client HTML.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Before mounting, render a neutral-sized placeholder so the DOM
  // structure is identical between server and client.
  if (!mounted) {
    return (
      <div
        className="p-2 rounded-lg w-8 h-8"
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      id="theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
