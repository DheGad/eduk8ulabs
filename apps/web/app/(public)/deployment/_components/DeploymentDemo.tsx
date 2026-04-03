"use client";

import { useState } from "react";

// ── Code Snippets ─────────────────────────────────────────────────────────────

const SNIPPETS = {
  python: {
    label: "Python",
    icon: "🐍",
    before: `from openai import OpenAI

client = OpenAI(
    api_key="sk-your-openai-key",
    base_url="https://api.openai.com/v1",  # ← change this
)`,
    after: `from openai import OpenAI

client = OpenAI(
    api_key="sk-your-openai-key",
    base_url="https://api.streetmp.com/v1/proxy",  # ✅ done
    default_headers={
        "x-streetmp-key": "sk_live_••••••••••••••••",
    },
)`,
  },
  node: {
    label: "Node.js",
    icon: "🟩",
    before: `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",  // ← change this
});`,
    after: `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.streetmp.com/v1/proxy",  // ✅ done
  defaultHeaders: {
    "x-streetmp-key": process.env.STREETMP_KEY,
  },
});`,
  },
  curl: {
    label: "cURL",
    icon: "🔧",
    before: `curl https://api.openai.com/v1/chat/completions \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o","messages":[...]}'`,
    after: `curl https://api.streetmp.com/v1/proxy/chat/completions \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H "x-streetmp-key: $STREETMP_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o","messages":[...]}'`,
  },
};

type Lang = keyof typeof SNIPPETS;

// ── Syntax Highlighter ────────────────────────────────────────────────────────
// Minimal inline highlighter — no external dependency.

function highlight(code: string): React.ReactNode[] {
  const lines = code.split("\n");
  return lines.map((line, idx) => {
    const isAdded    = line.includes("✅") || line.includes("streetmp.com") || line.includes("x-streetmp-key") || line.includes("STREETMP_KEY");
    const isComment  = line.trim().startsWith("#") || line.trim().startsWith("//");
    const isRemoved  = line.includes("← change this");
    const isKey      = /^(import|from|const|let|var|async|await|def|curl)\b/.test(line.trim());

    let className = "text-zinc-300";
    if (isAdded)   className = "text-emerald-400 bg-emerald-500/[0.08]";
    else if (isRemoved) className = "text-red-400/70 line-through decoration-red-500/40";
    else if (isComment) className = "text-zinc-500";
    else if (isKey)     className = "text-violet-400";

    return (
      <div key={idx} className={`leading-[1.75] px-1 rounded-sm ${className}`}>
        {line || " "}
      </div>
    );
  });
}

// ── Copy Button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS or older browsers
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
        copied
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
          : "border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white hover:border-white/20 hover:bg-white/[0.07]"
      }`}
      aria-label="Copy code snippet"
    >
      {copied ? (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

// ── Code Block ────────────────────────────────────────────────────────────────

function CodeBlock({
  code,
  label,
  glow = false,
}: {
  code: string;
  label: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-2xl border overflow-hidden transition-all duration-300 ${
        glow
          ? "border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]"
          : "border-white/[0.07]"
      }`}
    >
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${
          glow
            ? "border-emerald-500/20 bg-emerald-500/[0.05]"
            : "border-white/[0.06] bg-white/[0.02]"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${glow ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)] animate-pulse" : "bg-red-500/70"}`} />
          <span className={`text-[11px] font-bold uppercase tracking-widest ${glow ? "text-emerald-400" : "text-zinc-500"}`}>
            {label}
          </span>
        </div>
        <CopyButton text={code} />
      </div>
      <div className="bg-zinc-950/60 px-5 py-5 overflow-x-auto">
        <pre className="text-xs font-mono leading-relaxed">
          {highlight(code)}
        </pre>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DeploymentDemo() {
  const [activeLang, setActiveLang] = useState<Lang>("python");
  const snippet = SNIPPETS[activeLang];

  return (
    <div className="flex flex-col gap-8">
      {/* Language picker */}
      <div className="flex items-center gap-1.5 self-start rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
        {(Object.keys(SNIPPETS) as Lang[]).map((lang) => (
          <button
            key={lang}
            onClick={() => setActiveLang(lang)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              activeLang === lang
                ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            <span>{SNIPPETS[lang].icon}</span>
            {SNIPPETS[lang].label}
          </button>
        ))}
      </div>

      {/* Before / After code blocks */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500/70" />
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Before — Exposed</span>
          </div>
          <CodeBlock code={snippet.before} label="Before" glow={false} />
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center lg:flex-col lg:pt-10">
          <div className="flex items-center gap-1 text-emerald-500 font-black text-xl lg:rotate-90">
            →
          </div>
          <div className="hidden lg:block text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-1">
            Change
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">After — Protected</span>
          </div>
          <CodeBlock code={snippet.after} label="After — Protected ✅" glow={true} />
        </div>
      </div>

      {/* Bottom stat strip */}
      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </div>
          <span className="text-sm font-semibold text-emerald-300">
            V71 Firewall + NeMo Guard + V13 Merkle Ledger now active on every request
          </span>
        </div>
        <span className="text-xs font-mono text-zinc-500 shrink-0">latency_added: &lt; 50ms</span>
      </div>
    </div>
  );
}
