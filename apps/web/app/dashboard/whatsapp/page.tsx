"use client";

import { useState } from "react";
import { MessageCircle, Send, BookOpen, BarChart3, CheckCheck, Clock, X, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Campaign {
  id: string;
  campaign_name: string;
  status: string;
  scheduled_at: string | null;
  sent: number;
  read_rate: number;
}

interface DispatchResult {
  phone: string;
  ok: boolean;
  message_id?: string;
  error?: string;
}

interface ApiResponse {
  ok: boolean;
  campaign_id?: string;
  summary?: { total: number; sent: number; failed: number };
  results?: DispatchResult[];
  error?: string;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────
const INITIAL_CAMPAIGNS: Campaign[] = [
  { id: "1", campaign_name: "Enterprise Onboarding Q2", status: "running",   scheduled_at: "2026-04-03T09:00:00Z", sent: 1240, read_rate: 74 },
  { id: "2", campaign_name: "Compliance Reminder — April",  status: "completed", scheduled_at: "2026-04-01T08:00:00Z", sent: 880,  read_rate: 91 },
  { id: "3", campaign_name: "Platform Feature Announce",    status: "scheduled", scheduled_at: "2026-04-05T10:00:00Z", sent: 0,    read_rate: 0  },
  { id: "4", campaign_name: "Renewal Nudge — Tier 2",       status: "draft",     scheduled_at: null,                   sent: 0,    read_rate: 0  },
];

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  running:   { bg: "rgba(16,185,129,0.12)",  color: "rgb(52,211,153)",      label: "Running"   },
  completed: { bg: "rgba(99,102,241,0.12)",  color: "rgb(165,180,252)",     label: "Completed" },
  scheduled: { bg: "rgba(245,158,11,0.12)",  color: "rgb(252,211,77)",      label: "Scheduled" },
  draft:     { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", label: "Draft"    },
  failed:    { bg: "rgba(239,68,68,0.12)",   color: "rgb(252,165,165)",     label: "Failed"    },
};

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string; sub: string; accent: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 200, borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", background: "#0d0d10", padding: "24px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${accent}1a`, border: `1px solid ${accent}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} color={accent} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
}

// ── New Campaign Modal ────────────────────────────────────────────────────────
function NewCampaignModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (c: Campaign) => void }) {
  const [form, setForm] = useState({ campaign_name: "", template_name: "", phone_numbers: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const phones = form.phone_numbers
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (phones.length === 0) {
      setError("Enter at least one phone number.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/whatsapp/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: "00000000-0000-0000-0000-000000000001", // Replace with real org_id from session
          campaign_name: form.campaign_name,
          template_name: form.template_name,
          phone_numbers: phones,
        }),
      });

      const data: ApiResponse = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Dispatch failed");
      } else {
        setResult(data);
        onSuccess({
          id: data.campaign_id ?? Date.now().toString(),
          campaign_name: form.campaign_name,
          status: (data.summary?.failed ?? 0) === phones.length ? "failed" : "completed",
          scheduled_at: new Date().toISOString(),
          sent: data.summary?.sent ?? 0,
          read_rate: 0,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
    color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6,
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(4px)" }}>
      <div style={{ width: "100%", maxWidth: 480, borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", background: "#0d0d10", padding: "32px", position: "relative" }}>
        {/* Close */}
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)" }}>
          <X size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Send size={16} color="rgb(37,211,102)" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>New Campaign</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Dispatch a WhatsApp template</div>
          </div>
        </div>

        {/* Success State */}
        {result ? (
          <div>
            <div style={{ borderRadius: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", padding: "16px", marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "rgb(52,211,153)", marginBottom: 4 }}>Campaign Dispatched!</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                Total: {result.summary?.total} &nbsp;·&nbsp; Sent: {result.summary?.sent} &nbsp;·&nbsp; Failed: {result.summary?.failed}
              </div>
            </div>
            <button onClick={onClose} style={{ width: "100%", padding: "11px", borderRadius: 12, border: "none", background: "rgb(37,211,102)", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={labelStyle}>Campaign Name</label>
              <input required style={inputStyle} placeholder="e.g. Q2 Onboarding Wave" value={form.campaign_name}
                onChange={(e) => setForm({ ...form, campaign_name: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Template Name</label>
              <input required style={inputStyle} placeholder="e.g. onboarding_v1" value={form.template_name}
                onChange={(e) => setForm({ ...form, template_name: e.target.value })} />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>Must match an approved Meta template name exactly.</div>
            </div>
            <div>
              <label style={labelStyle}>Phone Numbers</label>
              <textarea required style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                placeholder="+919876543210, +447911123456, ..."
                value={form.phone_numbers}
                onChange={(e) => setForm({ ...form, phone_numbers: e.target.value })}
              />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>E.164 format. Comma-separated.</div>
            </div>

            {error && (
              <div style={{ borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", padding: "12px", fontSize: 13, color: "rgb(252,165,165)" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ padding: "12px", borderRadius: 12, border: "none", background: loading ? "rgba(37,211,102,0.3)" : "rgb(37,211,102)", color: "#000", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Dispatching...</> : <><Send size={14} /> Dispatch Campaign</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function WhatsAppDashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [showModal, setShowModal] = useState(false);

  const totalSent   = campaigns.reduce((a, c) => a + c.sent, 0);
  const activeCount = campaigns.filter((c) => c.status === "running").length;
  const ratedCamps  = campaigns.filter((c) => c.read_rate > 0);
  const avgReadRate = ratedCamps.length
    ? Math.round(ratedCamps.reduce((a, c) => a + c.read_rate, 0) / ratedCamps.length)
    : 0;

  const handleNewCampaign = (newCampaign: Campaign) => {
    setCampaigns((prev) => [newCampaign, ...prev]);
    setShowModal(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050507", color: "#e8e8e8", fontFamily: "'Inter', system-ui, sans-serif", padding: "40px 48px" }}>
      {showModal && <NewCampaignModal onClose={() => setShowModal(false)} onSuccess={handleNewCampaign} />}

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageCircle size={20} color="rgb(37,211,102)" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>WhatsApp Automation</h1>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Campaign Management & Delivery Intelligence</p>
            </div>
          </div>
          <button onClick={() => setShowModal(true)}
            style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid rgba(37,211,102,0.35)", background: "rgba(37,211,102,0.12)", color: "rgb(37,211,102)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
            <Send size={14} /> New Campaign
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 36 }}>
        <MetricCard icon={Send}       label="Total Sent"       value={totalSent.toLocaleString()} sub="All-time messages dispatched"    accent="rgb(99,102,241)" />
        <MetricCard icon={CheckCheck} label="Avg Read Rate"    value={`${avgReadRate}%`}           sub="Across completed campaigns"      accent="rgb(52,211,153)" />
        <MetricCard icon={BarChart3}  label="Active Campaigns" value={String(activeCount)}         sub="Currently running"               accent="rgb(245,158,11)" />
      </div>

      {/* Table */}
      <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", background: "#0d0d10", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BookOpen size={16} color="rgba(255,255,255,0.4)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Campaign History</span>
          </div>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{campaigns.length} campaigns</span>
        </div>

        {/* Col headers */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {["Campaign", "Status", "Messages Sent", "Read Rate"].map((col) => (
            <span key={col} style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)" }}>{col}</span>
          ))}
        </div>

        {/* Rows */}
        {campaigns.map((campaign, i) => {
          const style  = STATUS_STYLES[campaign.status] ?? STATUS_STYLES.draft;
          const isLast = i === campaigns.length - 1;
          return (
            <div key={campaign.id}
              style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "16px 24px", borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)", alignItems: "center", transition: "background 0.15s", cursor: "default" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", marginBottom: 2 }}>{campaign.campaign_name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={10} />
                  {campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Not scheduled"}
                </div>
              </div>
              <div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: style.bg, color: style.color, fontSize: 11, fontWeight: 600 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: style.color, display: "inline-block" }} />
                  {style.label}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: campaign.sent > 0 ? "#fff" : "rgba(255,255,255,0.3)" }}>
                {campaign.sent > 0 ? campaign.sent.toLocaleString() : "—"}
              </div>
              <div>
                {campaign.read_rate > 0 ? (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "rgb(52,211,153)" }}>{campaign.read_rate}%</div>
                    <div style={{ marginTop: 4, height: 3, borderRadius: 99, background: "rgba(52,211,153,0.12)", width: 80 }}>
                      <div style={{ height: "100%", borderRadius: 99, background: "rgb(52,211,153)", width: `${campaign.read_rate}%` }} />
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
        Connected to Meta WhatsApp Business API · Delivery receipts via X-Hub-Signature-256 verified webhook
      </p>
    </div>
  );
}
