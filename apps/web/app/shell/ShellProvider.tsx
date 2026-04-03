/**
 * @file ShellProvider.tsx
 * @app StreetMP OS Web (Next.js) — Desktop + Mobile Shell Integration
 * @command COMMAND_093 — THE SOVEREIGN SHELL
 * @version V93.0.0
 *
 * ================================================================
 * HOW THE WEB APP DETECTS THE NATIVE SHELL
 * ================================================================
 *
 * When running inside the Electron shell, `window.shellAPI` is
 * injected by preload.ts via contextBridge. The React app can
 * detect this and:
 *
 *   • Request native OS notifications (bypass browser Notification API)
 *   • Store JWT tokens in the OS keychain (not localStorage)
 *   • Listen for deep-link navigation events
 *   • Show the Quick Prompt Overlay via keyboard shortcut
 *
 * When running on mobile (Capacitor), the Capacitor SDK is
 * available globally. The app can detect this via Capacitor.isNativePlatform().
 *
 * When running as a browser PWA, neither is present and the app
 * falls back to standard web APIs gracefully.
 *
 * ================================================================
 */

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

// ─── Shell Environment Detection ─────────────────────────────────────────────
type ShellEnv = "electron" | "capacitor" | "browser";

function detectShellEnv(): ShellEnv {
  if (typeof window === "undefined") return "browser";
  // Electron: window.shellAPI injected by preload.ts
  if ("shellAPI" in window && window.shellAPI) return "electron";
  // Capacitor: window.Capacitor available after native plugins load
  if ("Capacitor" in window) return "capacitor";
  return "browser";
}

// ─── Context ─────────────────────────────────────────────────────────────────
interface ShellContextValue {
  env:              ShellEnv;
  appVersion:       string | null;
  platform:         string | null;

  /** Store a credential in the OS keychain (Electron) or Keystore (Capacitor) */
  storeCredential:  (key: string, value: string) => Promise<boolean>;

  /** Retrieve a credential from the hardware-backed store */
  retrieveCredential: (key: string) => Promise<string | null>;

  /** Remove a credential */
  deleteCredential: (key: string) => Promise<boolean>;

  /** Trigger the Quick Prompt overlay (Electron only) */
  toggleOverlay:    () => void;

  /** Send a native OS notification */
  notify:           (title: string, body: string) => void;

  /** True if running inside any native shell */
  isNative:         boolean;
}

const ShellContext = createContext<ShellContextValue>({
  env:               "browser",
  appVersion:        null,
  platform:          null,
  storeCredential:   async () => false,
  retrieveCredential: async () => null,
  deleteCredential:  async () => false,
  toggleOverlay:     () => undefined,
  notify:            () => undefined,
  isNative:          false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ShellProvider({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const [env, setEnv]             = useState<ShellEnv>("browser");
  const [appVersion, setVersion]  = useState<string | null>(null);
  const [platform, setPlatform]   = useState<string | null>(null);

  useEffect(() => {
    const detected = detectShellEnv();
    setEnv(detected);

    if (detected === "electron" && window.shellAPI) {
      const api = window.shellAPI;

      // Fetch shell metadata
      api.getVersion().then(setVersion).catch(() => undefined);
      api.getPlatform().then(setPlatform).catch(() => undefined);

      // Register deep-link navigation listener
      const unsubNav = api.onNavigate((route: string) => {
        router.push(route);
      });

      // Register update listeners (show toast in UI)
      const unsubAvail = api.onUpdateAvailable((version: string) => {
        console.info(`[ShellProvider] Update available: ${version}`);
      });
      const unsubDl = api.onUpdateDownloaded((version: string) => {
        console.info(`[ShellProvider] Update downloaded: ${version} — install on quit.`);
      });

      // Expose the navigation function for main.ts deep-link injection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__streetmp_navigate = (route: string) => router.push(route);

      return () => {
        unsubNav();
        unsubAvail();
        unsubDl();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window as any).__streetmp_navigate;
      };
    }
  }, [router]);

  // ─── Credential Store ────────────────────────────────────────────────────
  const storeCredential = useCallback(async (key: string, value: string) => {
    if (env === "electron" && window.shellAPI) {
      const result = await window.shellAPI.storeCredential(key, value);
      return result.success;
    }
    // Browser fallback: sessionStorage (cleared on tab close — still no localStorage)
    sessionStorage.setItem(`cred.${key}`, value);
    return true;
  }, [env]);

  const retrieveCredential = useCallback(async (key: string) => {
    if (env === "electron" && window.shellAPI) {
      const result = await window.shellAPI.retrieveCredential(key);
      return result.data;
    }
    return sessionStorage.getItem(`cred.${key}`);
  }, [env]);

  const deleteCredential = useCallback(async (key: string) => {
    if (env === "electron" && window.shellAPI) {
      const result = await window.shellAPI.deleteCredential(key);
      return result.success;
    }
    sessionStorage.removeItem(`cred.${key}`);
    return true;
  }, [env]);

  // ─── Overlay ─────────────────────────────────────────────────────────────
  const toggleOverlay = useCallback(() => {
    if (env === "electron" && window.shellAPI) {
      window.shellAPI.toggleOverlay();
    }
  }, [env]);

  // ─── Notifications ───────────────────────────────────────────────────────
  const notify = useCallback((title: string, body: string) => {
    if (env === "electron" && window.shellAPI) {
      window.shellAPI.notify(title, body);
      return;
    }
    // Browser fallback
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  }, [env]);

  return (
    <ShellContext.Provider value={{
      env,
      appVersion,
      platform,
      storeCredential,
      retrieveCredential,
      deleteCredential,
      toggleOverlay,
      notify,
      isNative: env !== "browser",
    }}>
      {children}
    </ShellContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useShell() {
  return useContext(ShellContext);
}
