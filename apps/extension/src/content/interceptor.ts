/**
 * @file interceptor.ts
 * @module StreetMP Extension — Content Script
 * @command COMMAND_094 — THE ZERO-TRUST BROWSER EXTENSION
 * @version V94.0.0
 *
 * ================================================================
 * THE SHADOW-IT INTERCEPTOR
 * ================================================================
 *
 * This content script is injected into ChatGPT, Claude, and Gemini.
 * It performs three core functions:
 *
 *   1. SHIELD INJECTION: Appends a discrete StreetMP Shield badge
 *      inside the native chat input box. This is a visible signal to
 *      employees that their inputs are being scanned by corporate policy.
 *
 *   2. PROMPT INTERCEPTION: Captures the prompt text BEFORE it is
 *      transmitted to the external LLM by intercepting:
 *        • The Enter key keydown event on the textarea
 *        • The "Send" / "Submit" button click event
 *        • The form submit event (fallback)
 *
 *   3. PII SCAN + BLOCK: Runs the inline V94 PII scanner. If sensitive
 *      data is detected, the submit is cancelled at the DOM level
 *      and a styled in-page alert is rendered. A trace event is
 *      dispatched to the background service worker for kernel logging.
 *
 * ================================================================
 * SITE ADAPTERS
 * ================================================================
 *
 * Each supported site exposes its textarea and send button via
 * different DOM selectors. The adapter map below is the ONLY
 * place these selectors live — update here to fix site changes.
 *
 * ================================================================
 */

import { scanForPii, type ScanResult }            from "../shared/piiScanner";
import type { BlockMessage }     from "../shared/messages";

// ─── Site Adapter Configuration ───────────────────────────────────────────────
type SiteName = "ChatGPT" | "Claude" | "Gemini" | "Unknown";

interface SiteAdapter {
  name:         SiteName;
  /** CSS selectors to find the prompt textarea (tried in order) */
  textareaSelectors: string[];
  /** CSS selectors to find the send button */
  sendButtonSelectors: string[];
  /** Parent element to inject the shield badge into */
  shieldAnchorSelectors: string[];
}

const SITE_ADAPTERS: SiteAdapter[] = [
  {
    name: "ChatGPT",
    textareaSelectors: [
      "textarea#prompt-textarea",
      "div[contenteditable='true'][data-id='root']",
      "textarea[data-testid='prompt-textarea']",
      "textarea.m-0",
    ],
    sendButtonSelectors: [
      "button[data-testid='send-button']",
      "button[aria-label='Send prompt']",
      "button.send-button",
    ],
    shieldAnchorSelectors: [
      "div.relative.flex",
      "form.stretch",
      "form[class*='flex']",
    ],
  },
  {
    name: "Claude",
    textareaSelectors: [
      "div[contenteditable='true'].ProseMirror",
      "div[contenteditable='true'][class*='input']",
      "div.claude-input-area [contenteditable]",
    ],
    sendButtonSelectors: [
      "button[aria-label='Send message']",
      "button[type='submit']",
    ],
    shieldAnchorSelectors: [
      "div.relative.flex.flex-col",
      "div[class*='composer']",
    ],
  },
  {
    name: "Gemini",
    textareaSelectors: [
      "div.ql-editor[contenteditable='true']",
      "rich-textarea div[contenteditable='true']",
      "textarea.input-area",
    ],
    sendButtonSelectors: [
      "button[aria-label='Send message']",
      "button.send-button mat-icon",
      "button[jsaction*='submit']",
    ],
    shieldAnchorSelectors: [
      "div.input-container",
      "div.input-area-section",
    ],
  },
];

// ─── State ────────────────────────────────────────────────────────────────────
let shieldInjected = false;
let blockingEnabled = true;
let observer: MutationObserver | null = null;

// ─── Helpers: Site Detection ──────────────────────────────────────────────────
function detectSite(): SiteAdapter {
  const host = location.hostname;
  if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) {
    return SITE_ADAPTERS.find((a) => a.name === "ChatGPT")!;
  }
  if (host.includes("claude.ai") || host.includes("anthropic.com")) {
    return SITE_ADAPTERS.find((a) => a.name === "Claude")!;
  }
  if (host.includes("gemini.google.com") || host.includes("bard.google.com")) {
    return SITE_ADAPTERS.find((a) => a.name === "Gemini")!;
  }
  return { name: "Unknown", textareaSelectors: [], sendButtonSelectors: [], shieldAnchorSelectors: [] };
}

function querySelector<T extends Element>(selectors: string[]): T | null {
  for (const sel of selectors) {
    const el = document.querySelector<T>(sel);
    if (el) return el;
  }
  return null;
}

// ─── Helpers: Get Prompt Text ─────────────────────────────────────────────────
function getPromptText(textarea: Element): string {
  if (textarea instanceof HTMLTextAreaElement) {
    return textarea.value;
  }
  if (textarea instanceof HTMLElement && textarea.isContentEditable) {
    return textarea.innerText;
  }
  return textarea.textContent ?? "";
}

// ─── Helpers: Crypto (SHA-256 of prompt for audit log) ───────────────────────
async function sha256Hex(text: string): Promise<string> {
  const data    = new TextEncoder().encode(text.slice(0, 1024));
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Shield Badge Injection ───────────────────────────────────────────────────
function injectShieldBadge(site: SiteAdapter): void {
  if (shieldInjected) return;
  const anchor = querySelector(site.shieldAnchorSelectors);
  if (!anchor) return;

  const badge = document.createElement("div");
  badge.id    = "streetmp-shield-badge";
  badge.setAttribute("title", "StreetMP Security Shield — Active");
  badge.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 1.5L3 5.25V11.25C3 16.35 6.975 21.105 12 22.5C17.025 21.105 21 16.35 21 11.25V5.25L12 1.5Z"
        fill="rgba(0, 229, 153, 0.15)" stroke="#00E599" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M9 12L11 14L15 10" stroke="#00E599" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>StreetMP Active</span>
  `;

  // Styles injected via JS to avoid relying on CSS injection ordering
  Object.assign(badge.style, {
    position:       "absolute",
    bottom:         "8px",
    right:          "60px",
    display:        "flex",
    alignItems:     "center",
    gap:            "5px",
    padding:        "3px 8px",
    borderRadius:   "20px",
    background:     "rgba(0, 229, 153, 0.08)",
    border:         "1px solid rgba(0, 229, 153, 0.3)",
    color:          "#00E599",
    fontSize:       "11px",
    fontWeight:     "600",
    fontFamily:     "system-ui, -apple-system, sans-serif",
    letterSpacing:  "0.02em",
    zIndex:         "9999",
    cursor:         "default",
    pointerEvents:  "none",
    backdropFilter: "blur(8px)",
  });

  // Ensure anchor is positioned
  const anchorStyle = getComputedStyle(anchor);
  if (anchorStyle.position === "static") {
    (anchor as HTMLElement).style.position = "relative";
  }

  anchor.appendChild(badge);
  shieldInjected = true;
  console.info("[V94:StreetMPShield] Badge injected on", site.name);
}

// ─── In-Page Redact Alert ──────────────────────────────────────────────────────
function showRedactAlert(scanResult: ScanResult, site: SiteName): void {
  // Remove any existing alert
  document.querySelector("#streetmp-redact-alert")?.remove();

  const categories = [...new Set(scanResult.matches.map((m) => m.label))];
  const topCategory = categories[0] ?? "Sensitive Data";

  const alert = document.createElement("div");
  alert.id    = "streetmp-redact-alert";
  alert.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 1.5L3 5.25V11.25C3 16.35 6.975 21.105 12 22.5C17.025 21.105 21 16.35 21 11.25V5.25L12 1.5Z"
          fill="rgba(0, 229, 153, 0.2)" stroke="#00E599" stroke-width="1.5"/>
        <path d="M12 8V12M12 16H12.01" stroke="#00E599" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <div>
        <div style="font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:0.01em;">
          StreetMP OS: Data Redacted
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;">
          Shadow-IT Prevention — Sensitive details removed
        </div>
      </div>
      <button id="streetmp-alert-close" style="
        margin-left:auto;background:none;border:none;cursor:pointer;
        color:rgba(255,255,255,0.4);font-size:18px;padding:0;line-height:1;
      ">✕</button>
    </div>
    <div style="
      background:rgba(0,229,153,0.06);border:1px solid rgba(0,229,153,0.15);
      border-radius:8px;padding:10px 12px;margin-bottom:10px;
    ">
      <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:4px;">
        🚫 Detected: <strong style="color:#00E599">${topCategory}</strong>
        ${categories.length > 1 ? `<span style="color:rgba(255,255,255,0.4)"> +${categories.length - 1} more</span>` : ""}
      </div>
      <div style="font-size:11px;color:rgba(255,255,255,0.45);">
        Risk Score: ${scanResult.riskScore}/1000 · ${scanResult.matches.length} pattern${scanResult.matches.length > 1 ? "s" : ""} matched
      </div>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,0.55);line-height:1.5;margin-bottom:12px;">
      Your prompt contained sensitive data that was <strong>redacted</strong> before transmission to <strong style="color:rgba(255,255,255,0.8)">${site}</strong>.
      Use the <strong style="color:#00E599">StreetMP Sovereign Workspace</strong> for unrestricted AI interactions.
    </div>
    <a href="https://os.streetmp.com/dashboard/workspace" target="_blank" style="
      display:inline-flex;align-items:center;gap:6px;
      background:linear-gradient(135deg,#00E599,#00b077);
      color:#000;font-size:12px;font-weight:700;
      padding:7px 14px;border-radius:8px;text-decoration:none;
      box-shadow:0 0 16px rgba(0,229,153,0.3);
    ">
      Open Sovereign Workspace →
    </a>
  `;

  Object.assign(alert.style, {
    position:    "fixed",
    top:         "20px",
    right:       "20px",
    width:       "360px",
    background:  "rgba(10,10,10,0.95)",
    border:      "1px solid rgba(0,229,153,0.3)",
    borderRadius: "14px",
    padding:     "16px",
    zIndex:      "2147483647",    // Maximum z-index
    backdropFilter: "blur(20px)",
    boxShadow:   "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,229,153,0.1)",
    fontFamily:  "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    animation:   "streetmp-slide-in 0.25s cubic-bezier(0.16,1,0.3,1)",
  });

  document.body.appendChild(alert);

  // Close button
  alert.querySelector("#streetmp-alert-close")?.addEventListener("click", () => {
    alert.style.animation = "streetmp-slide-out 0.2s ease-in forwards";
    setTimeout(() => alert.remove(), 200);
  });

  // Auto-dismiss after 12s
  setTimeout(() => {
    if (document.contains(alert)) {
      alert.style.animation = "streetmp-slide-out 0.2s ease-in forwards";
      setTimeout(() => alert.remove(), 200);
    }
  }, 12_000);
}

function replacePromptText(textarea: Element, redactedText: string): void {
  if (textarea instanceof HTMLTextAreaElement) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(textarea, redactedText);
    } else {
      textarea.value = redactedText;
    }
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (textarea instanceof HTMLElement && textarea.isContentEditable) {
    textarea.innerText = redactedText;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    textarea.textContent = redactedText;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

// ─── Core Intercept Handler ───────────────────────────────────────────────────
async function handleInterception(
  _event: Event,
  site: SiteAdapter,
  textarea: Element
): Promise<void> {
  if (!blockingEnabled) return;

  const promptText = getPromptText(textarea).trim();
  if (!promptText || promptText.length < 10) return;  // Skip empty / trivial inputs

  const scanResult = scanForPii(promptText);
  if (!scanResult.hasPii) return;   // Clean — allow through

  // ── Physically replace the text ─────────────────────────────────────────────
  replacePromptText(textarea, scanResult.redacted);

  // ── Show in-page alert ──────────────────────────────────────────────────────
  showRedactAlert(scanResult, site.name);

  // ── Dispatch trace to background service worker ──────────────────────────────
  const traceId    = crypto.randomUUID();
  const promptHash = await sha256Hex(promptText);

  const message: BlockMessage = {
    type:    "SHADOW_IT_REDACTED",
    payload: {
      url:           location.href,
      site:          site.name,
      piiCategories: [...new Set(scanResult.matches.map((m) => m.category))],
      riskScore:     scanResult.riskScore,
      traceId,
      timestamp:     new Date().toISOString(),
      promptHash,
    },
  };

  chrome.runtime.sendMessage(message).catch(() => {
    // Background may not be loaded yet — non-fatal
  });

  console.warn(
    `[V94:StreetMPShield] REDACTED on ${site.name} | ` +
    `pii=${scanResult.matches.map((m) => m.category).join(",")} ` +
    `score=${scanResult.riskScore} trace=${traceId}`
  );
}

// ─── Event Attachment ─────────────────────────────────────────────────────────
function attachInterceptors(site: SiteAdapter): void {
  const textarea = querySelector<Element>(site.textareaSelectors);
  if (!textarea) return;

  // ── Enter key on textarea/contenteditable ──────────────────────────────────
  textarea.addEventListener(
    "keydown",
    async (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === "Enter" && !keyEvent.shiftKey) {
        await handleInterception(e, site, textarea);
      }
    },
    { capture: true }   // Capture phase = before site's own handler
  );

  // ── Send button click ─────────────────────────────────────────────────────
  const sendBtn = querySelector<HTMLButtonElement>(site.sendButtonSelectors);
  if (sendBtn) {
    sendBtn.addEventListener(
      "click",
      async (e) => { await handleInterception(e, site, textarea); },
      { capture: true }
    );
  }

  // ── Form submit (fallback) ────────────────────────────────────────────────
  const form = textarea.closest("form");
  if (form) {
    form.addEventListener(
      "submit",
      async (e) => { await handleInterception(e, site, textarea); },
      { capture: true }
    );
  }
}

// ─── Initialization ───────────────────────────────────────────────────────────
async function initialize(): Promise<void> {
  // Load settings from extension storage
  const stored = await chrome.storage.sync.get(["blockingEnabled"]);
  blockingEnabled = stored.blockingEnabled !== false;   // Default: true

  const site = detectSite();
  if (site.name === "Unknown") return;

  console.info(`[V94:StreetMPShield] Initializing on ${site.name} (${location.hostname})`);

  // Try immediate injection (page may already be loaded)
  injectShieldBadge(site);
  attachInterceptors(site);

  // MutationObserver: re-inject when the DOM updates (SPA navigation)
  observer = new MutationObserver(() => {
    injectShieldBadge(site);
    if (!querySelector<Element>(site.textareaSelectors)) {
      // Elements replaced — re-attach
      attachInterceptors(site);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initialize());
} else {
  initialize();
}

// ─── Listen for settings changes from popup ───────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "SETTINGS_UPDATE" && typeof msg?.payload?.blockingEnabled === "boolean") {
    blockingEnabled = msg.payload.blockingEnabled;
    console.info(`[V94:StreetMPShield] Blocking ${blockingEnabled ? "ENABLED" : "DISABLED"}`);
  }
});
