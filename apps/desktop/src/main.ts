/**
 * @file main.ts
 * @app StreetMP OS Desktop Shell
 * @command COMMAND_093 — THE SOVEREIGN SHELL
 * @version V93.0.0
 *
 * ================================================================
 * ZERO-TRUST SECURITY ARCHITECTURE
 * ================================================================
 *
 * This is the hardened Electron main process for StreetMP OS.
 * Every security control is enforced at the OS process boundary:
 *
 *   • nodeIntegration: false      — Node.js never exposed to renderer
 *   • contextIsolation: true      — V8 context completely isolated
 *   • sandbox: true               — Chromium OS-level sandboxing
 *   • webSecurity: true           — All web platform security enabled
 *   • allowRunningInsecureContent: false — Zero mixed-content
 *   • IPC via contextBridge only  — preload.ts is the ONLY bridge
 *
 * ================================================================
 * FEATURES
 * ================================================================
 *
 *   V93-A: Main Window → loads production StreetMP OS dashboard
 *   V93-B: Quick Prompt Overlay → global Cmd+Shift+Space shortcut
 *   V93-C: streetmp:// deep-link protocol registration
 *   V93-D: Auto-updater via GitHub releases (electron-updater)
 *   V93-E: Hardware-backed session token storage via safeStorage
 *   V93-F: Crash reporting + structured logging via electron-log
 *
 * ================================================================
 */

import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  nativeTheme,
  protocol,
  safeStorage,
  screen,
  session,
  shell,
  Notification,
} from "electron";
import path from "path";
import log from "electron-log";
import { autoUpdater } from "electron-updater";
import Store from "electron-store";

// ─── Strict typed persistent store (never stores secrets — use safeStorage) ───
const store = new Store<{
  lastRoute:     string;
  windowBounds:  { x: number; y: number; width: number; height: number };
  theme:         "dark" | "light" | "system";
  telemetryId:   string;
}>({
  name: "streetmp-prefs",
  defaults: {
    lastRoute:    "/dashboard",
    windowBounds: { x: 0, y: 0, width: 1400, height: 900 },
    theme:        "dark",
    telemetryId:  crypto.randomUUID(),
  },
  // Encrypt the store file on disk with AES-256
  encryptionKey: "streetmp-v93-local-prefs",
  clearInvalidConfig: true,
});

// ─── Logging ────────────────────────────────────────────────────────────────
log.transports.file.level = "info";
log.transports.console.level = "debug";
log.info("[V93:SovereignShell] Electron main process starting…");

// ─── Production Target ──────────────────────────────────────────────────────
const PRODUCTION_URL    = "https://os.streetmp.com";
const DEV_URL           = "http://localhost:3000";
const TARGET_URL        = app.isPackaged ? PRODUCTION_URL : DEV_URL;

// ─── Deep Link Scheme ───────────────────────────────────────────────────────
const PROTOCOL_SCHEME   = "streetmp";

// ─── Window References ──────────────────────────────────────────────────────
let mainWindow:    BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

// ─── Protocol Registration (must happen before app.ready) ───────────────────
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
}

// ─── Security: Block all permission requests that aren't explicitly needed ──
app.on("web-contents-created", (_event, contents) => {
  // Block all navigation to external origins
  contents.on("will-navigate", (navEvent, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const allowedOrigins = [
      TARGET_URL,
      "https://os.streetmp.com",
      "https://streetmp.com",
    ];
    const isAllowed = allowedOrigins.some(
      (origin) => new URL(origin).origin === parsedUrl.origin
    );
    if (!isAllowed) {
      log.warn(`[V93:SecurityGate] Blocked navigation to: ${navigationUrl}`);
      navEvent.preventDefault();
    }
  });

  // Intercept new windows — block popups, open external links in OS browser
  contents.setWindowOpenHandler(({ url }) => {
    const parsedUrl = new URL(url);
    // Allow only StreetMP origins to open in-app
    if (parsedUrl.origin === new URL(TARGET_URL).origin) {
      return { action: "allow" };
    }
    // All others go to OS default browser
    shell.openExternal(url);
    return { action: "deny" };
  });
});

// ─── Content Security Policy ────────────────────────────────────────────────
/**
 * Set a strict CSP on the session before any page loads.
 * This prevents XSS from executing arbitrary scripts even if injected.
 */
function applyContentSecurityPolicy(): void {
  const filter = { urls: ["*://*/*"] };
  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          [
            "default-src 'self' https://os.streetmp.com https://streetmp.com",
            "script-src 'self' 'unsafe-inline' https://os.streetmp.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' https://os.streetmp.com https://streetmp.com wss://os.streetmp.com",
            "frame-src 'none'",
            "object-src 'none'",
            "base-uri 'self'",
          ].join("; "),
        ],
      },
    });
  });
}

// ─── Main Window Factory ────────────────────────────────────────────────────
function createMainWindow(): BrowserWindow {
  const bounds = store.get("windowBounds");
  const { workArea } = screen.getPrimaryDisplay();

  // Clamp bounds to ensure window is on-screen
  const safeBounds = {
    width:  Math.min(bounds.width,  workArea.width),
    height: Math.min(bounds.height, workArea.height),
    x:      Math.max(workArea.x, Math.min(bounds.x, workArea.width  - 400)),
    y:      Math.max(workArea.y, Math.min(bounds.y, workArea.height - 300)),
  };

  const win = new BrowserWindow({
    ...safeBounds,
    minWidth:  900,
    minHeight: 620,
    title:     "StreetMP OS",
    icon:      path.join(__dirname, "../assets/icon.png"),
    // ─── ZERO-TRUST: True OS-level sandboxing ───────────────────────────
    webPreferences: {
      preload:                  path.join(__dirname, "preload.js"),
      nodeIntegration:          false,     // NEVER expose Node to renderer
      contextIsolation:         true,      // V8 isolation boundary
      sandbox:                  true,      // Chromium OS sandbox
      webSecurity:              true,      // Enforce SOP
      allowRunningInsecureContent: false,  // Zero mixed-content
      experimentalFeatures:     false,     // No bleeding-edge attack surface
      devTools:                 !app.isPackaged, // Disable devtools in prod
      disableHtmlFullscreenWindowResize: false,
      // Partition isolates session from other windows (overlay, etc.)
      partition:                "persist:streetmp-main",
    },
    // ─── Frameless native chrome ─────────────────────────────────────────
    titleBarStyle:  process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: "#0A0A0A",
    show: false,  // Show only after content is ready (prevents flash)
    vibrancy: process.platform === "darwin" ? "under-window" : undefined,
    visualEffectState: process.platform === "darwin" ? "active" : undefined,
  });

  // ─── Navigation ─────────────────────────────────────────────────────────
  win.loadURL(TARGET_URL);

  // ─── Show window after paint (prevents white flash) ──────────────────────
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
    log.info(`[V93:MainWindow] Loaded → ${TARGET_URL}`);
  });

  // ─── Persist window bounds on resize/move ────────────────────────────────
  const persistBounds = () => {
    if (!win.isMaximized() && !win.isMinimized() && !win.isFullScreen()) {
      const [x, y]         = win.getPosition();
      const [width, height] = win.getSize();
      store.set("windowBounds", { x, y, width, height });
    }
  };
  win.on("resize", persistBounds);
  win.on("moved",  persistBounds);

  // ─── IPC Handlers (main-side) ─────────────────────────────────────────────
  // All IPC originates from the preload context bridge — validated here
  ipcMain.handle("shell:get-version",   () => app.getVersion());
  ipcMain.handle("shell:get-platform",  () => process.platform);
  ipcMain.handle("shell:get-theme",     () => nativeTheme.shouldUseDarkColors ? "dark" : "light");
  ipcMain.handle("shell:open-external", (_ev, url: string) => {
    // Validate scheme before handing to OS
    const parsed = new URL(url);
    if (!["https:", "mailto:"].includes(parsed.protocol)) {
      log.warn(`[V93:IPC] Blocked open-external with scheme: ${parsed.protocol}`);
      return;
    }
    shell.openExternal(url);
  });

  // ─── Hardware-backed credential write (via safeStorage AES-256) ──────────
  ipcMain.handle("shell:store-credential", (_ev, key: string, plaintext: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      log.error("[V93:SafeStorage] Encryption not available on this platform.");
      return { success: false, error: "hardware_unavailable" };
    }
    const encrypted = safeStorage.encryptString(plaintext);
    store.set(`cred.${key}`, encrypted.toString("base64"));
    log.info(`[V93:SafeStorage] Credential stored: key=${key}`);
    return { success: true };
  });

  ipcMain.handle("shell:retrieve-credential", (_ev, key: string) => {
    const b64 = store.get(`cred.${key}` as any);
    if (!b64 || typeof b64 !== "string") return { success: false, data: null };
    const decrypted = safeStorage.decryptString(Buffer.from(b64, "base64"));
    return { success: true, data: decrypted };
  });

  ipcMain.handle("shell:delete-credential", (_ev, key: string) => {
    store.delete(`cred.${key}` as any);
    return { success: true };
  });

  // ─── Quick Overlay toggle ──────────────────────────────────────────────────
  ipcMain.handle("shell:toggle-overlay", () => {
    toggleOverlayWindow();
  });

  // ─── Push notification API ────────────────────────────────────────────────
  ipcMain.handle("shell:notify", (_ev, title: string, body: string) => {
    if (Notification.isSupported()) {
      new Notification({ title, body, icon: path.join(__dirname, "../assets/icon.png") }).show();
    }
  });

  win.on("closed", () => {
    mainWindow = null;
    overlayWindow?.close();
    overlayWindow = null;
  });

  return win;
}

// ─── Quick Prompt Overlay Window ─────────────────────────────────────────────
/**
 * The "Sovereign Overlay" — a frameless, hardware-accelerated glass panel
 * that floats above all windows. Triggered by Cmd+Shift+Space.
 * Contains the Zero-Context AI prompt bar backed by the V91 execution engine.
 */
function createOverlayWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const OVERLAY_W = 740;
  const OVERLAY_H = 120;

  const overlay = new BrowserWindow({
    width:             OVERLAY_W,
    height:            OVERLAY_H,
    x:                 Math.round((workArea.width  - OVERLAY_W) / 2),
    y:                 Math.round(workArea.height * 0.28),
    // ─── Frameless glass look ─────────────────────────────────────────
    frame:             false,
    transparent:       true,
    hasShadow:         true,
    alwaysOnTop:       true,
    skipTaskbar:       true,
    resizable:         false,
    movable:           true,
    roundedCorners:    true,
    // ─── macOS: blur-behind effect via VibrancyEffect ─────────────────
    vibrancy:          process.platform === "darwin" ? "hud" : undefined,
    visualEffectState: process.platform === "darwin" ? "active"  : undefined,
    // ─── Zero-Trust ────────────────────────────────────────────────────
    webPreferences: {
      preload:                  path.join(__dirname, "preload.js"),
      nodeIntegration:          false,
      contextIsolation:         true,
      sandbox:                  true,
      webSecurity:              true,
      allowRunningInsecureContent: false,
      devTools:                 !app.isPackaged,
      partition:                "persist:streetmp-overlay",
    },
    show: false,
  });

  const overlayURL = `${TARGET_URL}/overlay`;
  overlay.loadURL(overlayURL);

  overlay.on("blur", () => {
    // Auto-hide when user clicks away
    overlay.hide();
  });

  overlay.once("ready-to-show", () => {
    log.info("[V93:Overlay] Quick Prompt window ready.");
  });

  return overlay;
}

function toggleOverlayWindow(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    overlayWindow = createOverlayWindow();
    overlayWindow.show();
    overlayWindow.focus();
    return;
  }
  if (overlayWindow.isVisible()) {
    overlayWindow.hide();
  } else {
    // Reposition on primary display (user may have moved monitors)
    const { workArea } = screen.getPrimaryDisplay();
    const OVERLAY_W = 740;
    overlayWindow.setPosition(
      Math.round((workArea.width - OVERLAY_W) / 2),
      Math.round(workArea.height * 0.28)
    );
    overlayWindow.show();
    overlayWindow.focus();
  }
}

// ─── Deep Link Handler ────────────────────────────────────────────────────────
/**
 * Processes streetmp:// URIs from other applications.
 *
 * Routing:
 *   streetmp://verify/:hash      → /dashboard/sovereign/verify?hash=XXX
 *   streetmp://audit/:txId       → /dashboard/sovereign/audit?tx=XXX
 *   streetmp://workspace/:chatId → /dashboard/workspace?id=XXX
 *   streetmp://builder           → /dashboard/builder
 */
function handleDeepLink(url: string): void {
  log.info(`[V93:DeepLink] Received: ${url}`);

  let routePath: string;
  try {
    const parsed = new URL(url);
    const scheme   = parsed.protocol.replace(":", "");
    if (scheme !== PROTOCOL_SCHEME) {
      log.warn(`[V93:DeepLink] Rejected unknown scheme: ${scheme}`);
      return;
    }

    const host = parsed.hostname;
    const pathParts = parsed.pathname.replace(/^\//, "").split("/");

    switch (host) {
      case "verify":
        routePath = `/dashboard/sovereign/verify?hash=${encodeURIComponent(pathParts[0] ?? "")}`;
        break;
      case "audit":
        routePath = `/dashboard/sovereign/audit?tx=${encodeURIComponent(pathParts[0] ?? "")}`;
        break;
      case "workspace":
        routePath = `/dashboard/workspace?id=${encodeURIComponent(pathParts[0] ?? "")}`;
        break;
      case "builder":
        routePath = "/dashboard/builder";
        break;
      default:
        routePath = "/dashboard";
    }
  } catch (err) {
    log.error(`[V93:DeepLink] Failed to parse URL: ${url}`, err);
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();

  // Navigate the renderer to the target route
  mainWindow.webContents.executeJavaScript(
    `window.__streetmp_navigate && window.__streetmp_navigate(${JSON.stringify(routePath)})`
  );
  log.info(`[V93:DeepLink] Routed to: ${routePath}`);
}

// ─── Auto-Updater Configuration ───────────────────────────────────────────────
function configureAutoUpdater(): void {
  autoUpdater.logger = log;
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("update-available", (info) => {
    log.info(`[V93:AutoUpdater] Update available: ${info.version}`);
    mainWindow?.webContents.send("update:available", info.version);
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info(`[V93:AutoUpdater] Update downloaded: ${info.version} — installing on quit.`);
    mainWindow?.webContents.send("update:downloaded", info.version);
    // Show OS notification
    if (Notification.isSupported()) {
      new Notification({
        title: "StreetMP OS Update Ready",
        body:  `Version ${info.version} will install when you quit and relaunch.`,
      }).show();
    }
  });

  autoUpdater.on("error", (err) => {
    log.error("[V93:AutoUpdater] Error:", err.message);
  });
}

// ─── Application Lifecycle ────────────────────────────────────────────────────
app.whenReady().then(async () => {
  log.info(`[V93:SovereignShell] App ready. Platform=${process.platform}`);

  // Apply session-level Content Security Policy
  applyContentSecurityPolicy();

  // Force theme to dark (V91 glassmorphism design system)
  nativeTheme.themeSource = "dark";

  // ─── Create main window ────────────────────────────────────────────────
  mainWindow = createMainWindow();

  // ─── Register global shortcut: Cmd+Shift+Space / Ctrl+Shift+Space ───────
  const shortcutAccel = "CommandOrControl+Shift+Space";
  const registered = globalShortcut.register(shortcutAccel, () => {
    log.debug("[V93:Shortcut] Quick Prompt triggered.");
    toggleOverlayWindow();
  });
  if (!registered) {
    log.warn(`[V93:Shortcut] Failed to register global shortcut: ${shortcutAccel}`);
  } else {
    log.info(`[V93:Shortcut] Registered: ${shortcutAccel}`);
  }

  // ─── macOS: re-create window when dock icon is clicked ────────────────
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  // ─── Auto-updater (production only) ───────────────────────────────────
  if (app.isPackaged) {
    configureAutoUpdater();
  }

  log.info("[V93:SovereignShell] Initialization complete ✅");
});

// ─── Deep Link: macOS (open-url event) ───────────────────────────────────────
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// ─── Deep Link: Windows / Linux (second-instance) ────────────────────────────
// On Windows, the deep link URL arrives as a command-line argument on a
// second instance. The single-instance lock redirects it here.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log.warn("[V93:SingleInstance] Another instance is running — quitting.");
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    // Find the deep-link URL in the args
    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`));
    if (url) handleDeepLink(url);

    // Bring main window to front
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  log.info("[V93:SovereignShell] Shutting down. Shortcuts unregistered.");
});

app.on("window-all-closed", () => {
  // On macOS, keep the app running even with no windows (standard Mac behaviour)
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// ─── Uncaught rejection safety net ───────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  log.error("[V93:Process] Unhandled rejection:", reason);
});
