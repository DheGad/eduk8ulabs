import { TrustFlowVisualizer } from "@/components/dashboard/TrustFlowVisualizer";

export default function GlobalNetworkPage() {
  return (
    <div className="min-h-screen bg-[#0F172A] p-8 space-y-6 animate-in fade-in" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Global ZK Network</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          V32 Zero-Knowledge Learning Engine. Ingesting global telemetry without logging payloads to optimize routing weights.
        </p>
      </div>

      {/* V34 Glass Box Visualizer Embedded at the Top */}
      <TrustFlowVisualizer />

      {/* Stats Below */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Executions Learned", value: "24,809", delta: "+500 last min" },
          { label: "Routing Efficiency", value: "+18.4%", delta: "Latency reduced" },
          { label: "Data Leakage", value: "0 Bytes", delta: "100% Immutable ZK" },
        ].map(s => (
          <div key={s.label} className="p-5 rounded-xl border border-slate-800 bg-slate-900/50">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-3xl font-bold text-white mb-2">{s.value}</p>
            <p className="text-xs text-emerald-400 font-medium">{s.delta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
