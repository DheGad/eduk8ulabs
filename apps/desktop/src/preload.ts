/**
 * @file preload.ts
 * @app StreetMP OS Desktop Shell
 * @command COMMAND_093 — THE SOVEREIGN SHELL
 * @version V93.0.0
 *
 * ================================================================
 * THE IPC SECURITY BRIDGE
 * ================================================================
 *
 * This file runs in an isolated Node.js sandbox and is the ONLY
 * code allowed to cross the renderer ↔ main process boundary.
 *
 * CONTRACT:
 *   1. ONLY whitelisted API methods are exposed via contextBridge.
 *   2. The renderer NEVER has access to: require, process, __dirname,
 *      ipcRenderer directly, or any Node.js globals.
 *   3. All inputs passed from the renderer are validated for type
 *      and length before being passed to the main process.
 *   4. The bridge is built as a frozen, non-extensible API object.
 *
 * ================================================================
 * SECURITY VALIDATION RULES
 * ================================================================
 *
 *   • Strings:  max 4096 chars, stripped of null bytes
 *   • URLs:     must have https: or mailto: scheme
 *   • Keys:     [a-zA-Z0-9._-] only, max 128 chars
 *   • Numbers:  finite, non-NaN
 *
 * ================================================================
 */

import { contextBridge, ipcRenderer } from "electron";

// ─── Type Definitions (also available to renderer via window.shellAPI) ────────
export interface ShellAPI {
  /** Returns the current app version string. */
  getVersion(): Promise<string>;

  /** Returns the current OS platform ("darwin" | "win32" | "linux"). */
  getPlatform(): Promise<"darwin" | "win32" | "linux">;

  /** Returns whether the OS is in dark mode. */
  getTheme(): Promise<"dark" | "light">;

  /**
   * Opens a URL in the OS default browser.
   * Only https: and mailto: schemes are allowed.
   */
  openExternal(url: string): Promise<void>;

  /**
   * Stores a credential encrypted with the OS keychain (Keychain/DPAPI/SecretService).
   * Uses Electron's safeStorage — hardware-backed AES-256 where available.
   */
  storeCredential(key: string, value: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Retrieves a previously stored credential.
   * Returns null if not found or decryption fails.
   */
  retrieveCredential(key: string): Promise<{ success: boolean; data: string | null }>;

  /**
   * Deletes a stored credential.
   */
  deleteCredential(key: string): Promise<{ success: boolean }>;

  /**
   * Toggles the Quick Prompt Overlay window (Cmd+Shift+Space shortcut target).
   */
  toggleOverlay(): Promise<void>;

  /**
   * Sends a native OS notification (bypasses browser Notification API).
   */
  notify(title: string, body: string): Promise<void>;

  /**
   * Listen for update events pushed from the auto-updater.
   */
  onUpdateAvailable(callback: (version: string) => void): () => void;
  onUpdateDownloaded(callback: (version: string) => void): () => void;

  /**
   * Listen for deep-link navigation events dispatched from the main process.
   */
  onNavigate(callback: (route: string) => void): () => void;
}

// ─── Input Validators ─────────────────────────────────────────────────────────

function validateString(value: unknown, maxLen = 4096): string {
  if (typeof value !== "string") throw new TypeError("Expected string");
  if (value.length > maxLen)     throw new RangeError(`String exceeds max length ${maxLen}`);
  // Strip null bytes to prevent injection attacks
  return value.replace(/\0/g, "");
}

function validateUrl(value: unknown): string {
  const url = validateString(value, 2048);
  const parsed = new URL(url); // throws if malformed
  if (!["https:", "mailto:"].includes(parsed.protocol)) {
    throw new TypeError(`Blocked URL scheme: ${parsed.protocol}`);
  }
  return url;
}

function validateKey(value: unknown): string {
  const key = validateString(value, 128);
  if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
    throw new TypeError(`Invalid key format: ${key}`);
  }
  return key;
}

// ─── Listener Management ──────────────────────────────────────────────────────
/**
 * Registers a one-direction listener for events pushed from the main process.
 * Returns an unsubscribe function to prevent memory leaks.
 */
function createMainListener<T>(
  channel: string,
  callback: (data: T) => void
): () => void {
  const handler = (_event: Electron.IpcRendererEvent, data: T) => callback(data);
  ipcRenderer.on(channel, handler);
  // Return teardown function so the renderer can unsubscribe (useEffect cleanup)
  return () => ipcRenderer.removeListener(channel, handler);
}

// ─── The Sealed API Bridge ────────────────────────────────────────────────────
const shellAPI: ShellAPI = {
  // ─── Info APIs ───────────────────────────────────────────────────────────
  async getVersion(): Promise<string> {
    return ipcRenderer.invoke("shell:get-version");
  },

  async getPlatform(): Promise<"darwin" | "win32" | "linux"> {
    return ipcRenderer.invoke("shell:get-platform");
  },

  async getTheme(): Promise<"dark" | "light"> {
    return ipcRenderer.invoke("shell:get-theme");
  },

  // ─── External Browser ────────────────────────────────────────────────────
  async openExternal(url: string): Promise<void> {
    const safeUrl = validateUrl(url);
    return ipcRenderer.invoke("shell:open-external", safeUrl);
  },

  // ─── Hardware-Backed Credential APIs ─────────────────────────────────────
  async storeCredential(
    key: string,
    value: string
  ): Promise<{ success: boolean; error?: string }> {
    const safeKey   = validateKey(key);
    const safeValue = validateString(value, 4096);
    return ipcRenderer.invoke("shell:store-credential", safeKey, safeValue);
  },

  async retrieveCredential(
    key: string
  ): Promise<{ success: boolean; data: string | null }> {
    const safeKey = validateKey(key);
    return ipcRenderer.invoke("shell:retrieve-credential", safeKey);
  },

  async deleteCredential(key: string): Promise<{ success: boolean }> {
    const safeKey = validateKey(key);
    return ipcRenderer.invoke("shell:delete-credential", safeKey);
  },

  // ─── Overlay ─────────────────────────────────────────────────────────────
  async toggleOverlay(): Promise<void> {
    return ipcRenderer.invoke("shell:toggle-overlay");
  },

  // ─── Notifications ───────────────────────────────────────────────────────
  async notify(title: string, body: string): Promise<void> {
    const safeTitle = validateString(title, 100);
    const safeBody  = validateString(body,  300);
    return ipcRenderer.invoke("shell:notify", safeTitle, safeBody);
  },

  // ─── Event Subscriptions ─────────────────────────────────────────────────
  onUpdateAvailable(callback: (version: string) => void): () => void {
    return createMainListener<string>("update:available", callback);
  },

  onUpdateDownloaded(callback: (version: string) => void): () => void {
    return createMainListener<string>("update:downloaded", callback);
  },

  onNavigate(callback: (route: string) => void): () => void {
    return createMainListener<string>("navigate", callback);
  },
};

// ─── Expose the sealed API via contextBridge ──────────────────────────────────
// Object.freeze ensures the renderer cannot monkey-patch or replace our API.
contextBridge.exposeInMainWorld("shellAPI", Object.freeze(shellAPI));

// ─── Type augmentation for TypeScript renderer code ───────────────────────────
// This ensures that `window.shellAPI` is properly typed in Next.js/renderer.
declare global {
  interface Window {
    shellAPI: Readonly<ShellAPI>;
    /** Set by main.ts to allow deep-link navigation from the renderer */
    __streetmp_navigate?: (route: string) => void;
  }
}
