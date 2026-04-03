"use client";

import { useState, FormEvent, useCallback } from "react";
import { saveByokKey, getToken, ApiError, type ApiProvider } from "@/lib/apiClient";

type ToastType = "success" | "error" | null;

interface Toast {
  type: ToastType;
  message: string;
}

// Decode user_id from the JWT payload stored in localStorage.
// The JWT sub claim carries the UUID — we decode without verifying
// (server verifies on the actual API call).
function getUserIdFromToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

const PROVIDERS: { value: ApiProvider; label: string; hint: string }[] = [
  {
    value: "openai",
    label: "OpenAI",
    hint: "Starts with sk-…",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    hint: "Starts with sk-ant-…",
  },
];

// ── Danger Zone types ─────────────────────────────────────────────────────────
type DangerStage = "idle" | "confirm" | "typing" | "deleting" | "deleted";

const CONFIRM_PHRASE = "DELETE_WORKSPACE_PERMANENTLY";

export default function SettingsPage() {
  const [provider, setProvider] = useState<ApiProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>({ type: null, message: "" });

  // ── Danger Zone state ─────────────────────────────────────────
  const [dangerStage, setDangerStage]           = useState<DangerStage>("idle");
  const [dangerConfirmInput, setDangerConfirmInput] = useState("");
  const [dangerAdminSecret, setDangerAdminSecret]   = useState("");
  const [dangerReason, setDangerReason]             = useState("");
  const [dangerLoading, setDangerLoading]           = useState(false);
  const [dangerReceipt, setDangerReceipt]           = useState<{
    redaction_id: string;
    deleted_at:   string;
    workspace_id: string;
  } | null>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast({ type: null, message: "" }), 5000);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setToast({ type: null, message: "" });

    const userId = getUserIdFromToken();
    if (!userId) {
      showToast("error", "Session expired. Please sign in again.");
      setLoading(false);
      return;
    }

    try {
      await saveByokKey(userId, provider, apiKey.trim());
      setApiKey("");
      showToast("success", "Key encrypted and vaulted successfully.");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          showToast("error", "Session expired. Please sign in again.");
        } else {
          showToast("error", err.message);
        }
      } else {
        showToast("error", "Failed to reach the vault. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const selectedProvider = PROVIDERS.find((p) => p.value === provider)!;

  return (
    <div className="p-8 max-w-2xl space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          API Keys
        </h1>
        <p className="text-sm text-white/40 leading-relaxed">
          Your keys are encrypted with AES-256-GCM before storage.
          They are never logged or accessible to Streetmp staff.
        </p>
      </div>

      {/* Security info banner */}
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-violet-500/20 bg-violet-500/[0.05]">
        <svg className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
        </svg>
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-violet-300">
            End-to-end encrypted storage
          </p>
          <p className="text-xs text-white/35 leading-relaxed">
            Keys are encrypted in-browser before transit. The vault stores only
            ciphertext + IV + auth tag — never plaintext.
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast.type === "success" && (
        <div className="success-msg">
          <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          <span>{toast.message}</span>
        </div>
      )}
      {toast.type === "error" && (
        <div className="error-msg">
          <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Key form */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-white mb-5">
          Vault a new key
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Provider select */}
          <div>
            <label htmlFor="provider" className="label">
              Provider
            </label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as ApiProvider)}
              disabled={loading}
              className="select"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* API key input */}
          <div>
            <label htmlFor="api_key" className="label">
              API Key
            </label>
            <div className="relative">
              <input
                id="api_key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selectedProvider.hint}
                required
                disabled={loading}
                autoComplete="off"
                spellCheck={false}
                className="input font-mono pr-12"
              />
              {/* Show/hide toggle */}
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-1"
                tabIndex={-1}
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-white/25">
              Your key is encrypted before leaving your browser.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="btn-primary"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Encrypting &amp; vaulting…
              </span>
            ) : (
              <>
                <span>🔒</span> Encrypt &amp; vault key
              </>
            )}
          </button>
        </form>
      </div>

      {/* Existing keys table — placeholder for Phase 2 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Vaulted keys</h2>
          <span className="text-xs text-white/30 font-medium px-2 py-0.5 rounded-full border border-white/10">
            Phase 2
          </span>
        </div>
        <p className="text-xs text-white/30">
          Key listing and rotation UI will be available in Phase 2.
        </p>
      </div>

      {/* ── DANGER ZONE: Delete Workspace ─────────────────────── */}
      <div className="mt-12 border border-red-500/30 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-red-500/10 border-b border-red-500/20 flex items-center gap-3">
          <svg className="w-4 h-4 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <h2 className="text-sm font-bold text-red-400 tracking-wide uppercase">Danger Zone</h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Description */}
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Delete Workspace</p>
            <p className="text-xs text-white/40 leading-relaxed">
              Permanently and irrevocably deletes <strong className="text-white/60">all data</strong> associated
              with this workspace — execution logs, vault keys, audit ledger, Redis sessions, and API keys.
              This satisfies <strong className="text-white/60">GDPR Article 17 (Right to Erasure)</strong>.
              This action <span className="text-red-400 font-semibold">cannot be undone</span>.
            </p>
          </div>

          {/* What gets deleted */}
          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-white/35 font-mono">
            {["execution_logs", "vault_keys", "audit_ledger", "redis_sessions", "api_key_registry", "tenant_config"].map(l => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="text-red-500/60">×</span> {l}
              </span>
            ))}
          </div>

          {/* Deletion receipt — shown after success */}
          {dangerStage === "deleted" && dangerReceipt && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                Workspace Deleted — GDPR Receipt
              </div>
              <div className="text-[11px] font-mono text-white/50 space-y-1">
                <p>Redaction ID: <span className="text-green-400">{dangerReceipt.redaction_id}</span></p>
                <p>Workspace: <span className="text-white/60">{dangerReceipt.workspace_id}</span></p>
                <p>Deleted at: <span className="text-white/60">{new Date(dangerReceipt.deleted_at).toLocaleString()}</span></p>
              </div>
              <p className="text-[10px] text-white/30">
                Save this receipt. It serves as your GDPR Art.17 compliance record.
              </p>
            </div>
          )}

          {/* Stage: idle — show the initial button */}
          {dangerStage === "idle" && (
            <button
              id="danger-zone-delete-btn"
              type="button"
              onClick={() => setDangerStage("confirm")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/40 text-red-400 text-sm font-semibold hover:bg-red-500/10 hover:border-red-500/60 transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Workspace Permanently
            </button>
          )}

          {/* Stage: confirm / typing */}
          {(dangerStage === "confirm" || dangerStage === "typing" || dangerStage === "deleting") && (
            <div className="space-y-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <p className="text-xs text-red-300 font-semibold">
                ⚠️ This will permanently erase all tenant data. Type{" "}
                <code className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-red-300">
                  {CONFIRM_PHRASE}
                </code>{" "}
                below to confirm.
              </p>

              {/* Admin secret */}
              <div>
                <label className="text-[11px] text-white/40 font-medium mb-1 block">
                  Admin Secret (STREETMP_ADMIN_SECRET)
                </label>
                <input
                  id="danger-admin-secret"
                  type="password"
                  value={dangerAdminSecret}
                  onChange={e => setDangerAdminSecret(e.target.value)}
                  placeholder="x-admin-secret"
                  disabled={dangerLoading}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="text-[11px] text-white/40 font-medium mb-1 block">
                  Reason (e.g. GDPR erasure request from data subject)
                </label>
                <input
                  id="danger-reason"
                  type="text"
                  value={dangerReason}
                  onChange={e => setDangerReason(e.target.value)}
                  placeholder="Optional — for audit log"
                  disabled={dangerLoading}
                  maxLength={500}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors"
                />
              </div>

              {/* Confirmation phrase input */}
              <div>
                <label className="text-[11px] text-white/40 font-medium mb-1 block">
                  Type the confirmation phrase
                </label>
                <input
                  id="danger-confirm-input"
                  type="text"
                  value={dangerConfirmInput}
                  onChange={e => {
                    setDangerConfirmInput(e.target.value);
                    setDangerStage(e.target.value ? "typing" : "confirm");
                  }}
                  placeholder={CONFIRM_PHRASE}
                  disabled={dangerLoading}
                  autoComplete="off"
                  spellCheck={false}
                  className={`w-full bg-white/5 border rounded-lg px-3 py-2.5 text-sm font-mono placeholder-white/15 focus:outline-none transition-colors ${
                    dangerConfirmInput === CONFIRM_PHRASE
                      ? "border-red-500/60 text-red-300"
                      : "border-white/10 text-white"
                  }`}
                />
              </div>

              <div className="flex gap-3">
                <button
                  id="danger-zone-confirm-delete-btn"
                  type="button"
                  disabled={
                    dangerLoading ||
                    dangerConfirmInput !== CONFIRM_PHRASE ||
                    !dangerAdminSecret.trim()
                  }
                  onClick={async () => {
                    setDangerLoading(true);
                    setDangerStage("deleting");
                    try {
                      const workspaceId = getUserIdFromToken() ?? "current-workspace";
                      const res = await fetch("/api/v1/admin/workspace/delete", {
                        method: "DELETE",
                        headers: {
                          "Content-Type": "application/json",
                          "x-admin-secret": dangerAdminSecret.trim(),
                        },
                        body: JSON.stringify({
                          workspace_id:  workspaceId,
                          confirm_token: CONFIRM_PHRASE,
                          reason:        dangerReason.trim() || "No reason provided",
                        }),
                      });
                      const data = await res.json() as {
                        success:      boolean;
                        redaction_id?: string;
                        deleted_at?:  string;
                        workspace_id?: string;
                        error?:        { message: string };
                      };
                      if (data.success && data.redaction_id) {
                        setDangerReceipt({
                          redaction_id: data.redaction_id,
                          deleted_at:   data.deleted_at ?? new Date().toISOString(),
                          workspace_id: data.workspace_id ?? workspaceId,
                        });
                        setDangerStage("deleted");
                      } else {
                        showToast("error", data.error?.message ?? "Deletion failed.");
                        setDangerStage("confirm");
                      }
                    } catch {
                      showToast("error", "Could not reach the server. Please try again.");
                      setDangerStage("confirm");
                    } finally {
                      setDangerLoading(false);
                    }
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 ${
                    dangerConfirmInput === CONFIRM_PHRASE && dangerAdminSecret.trim()
                      ? "border-red-500 bg-red-500/20 text-red-300 hover:bg-red-500/30"
                      : "border-white/10 bg-white/5 text-white/25 cursor-not-allowed"
                  }`}
                >
                  {dangerLoading ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Erasing all data…
                    </>
                  ) : (
                    <>🗑️ Permanently Delete Workspace</>
                  )}
                </button>
                <button
                  type="button"
                  disabled={dangerLoading}
                  onClick={() => {
                    setDangerStage("idle");
                    setDangerConfirmInput("");
                    setDangerAdminSecret("");
                    setDangerReason("");
                  }}
                  className="px-4 py-2.5 rounded-lg border border-white/10 text-sm text-white/40 hover:text-white/60 hover:border-white/20 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
