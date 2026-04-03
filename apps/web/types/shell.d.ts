/**
 * @file shell.d.ts
 * @description Global type declarations for the V93 Sovereign Shell.
 *
 * Extends the Window interface so that `window.shellAPI` and
 * `window.__streetmp_navigate` are properly typed in Next.js / any
 * TypeScript file without requiring explicit imports.
 *
 * These properties are injected at runtime by:
 *   - Desktop: preload.ts (Electron contextBridge)
 *   - Mobile:  Capacitor WebView bridge
 *   - Browser: undefined (graceful fallback via ShellProvider)
 */

// ─── ShellAPI (injected by Electron preload.ts) ───────────────────────────────
interface ShellAPI {
  getVersion():     Promise<string>;
  getPlatform():    Promise<"darwin" | "win32" | "linux">;
  getTheme():       Promise<"dark" | "light">;
  openExternal(url: string): Promise<void>;
  storeCredential(key: string, value: string): Promise<{ success: boolean; error?: string }>;
  retrieveCredential(key: string): Promise<{ success: boolean; data: string | null }>;
  deleteCredential(key: string): Promise<{ success: boolean }>;
  toggleOverlay(): Promise<void>;
  notify(title: string, body: string): Promise<void>;
  onUpdateAvailable(callback: (version: string) => void): () => void;
  onUpdateDownloaded(callback: (version: string) => void): () => void;
  onNavigate(callback: (route: string) => void): () => void;
}

declare global {
  interface Window {
    /** Injected by Electron preload.ts via contextBridge when running as native desktop app */
    shellAPI?: Readonly<ShellAPI>;

    /** Set by ShellProvider to enable deep-link navigation from Electron main process */
    __streetmp_navigate?: (route: string) => void;

    /** Capacitor global — present when running inside a Capacitor native shell */
    Capacitor?: {
      isNativePlatform(): boolean;
      getPlatform(): "ios" | "android" | "web";
    };
  }
}

export {};
