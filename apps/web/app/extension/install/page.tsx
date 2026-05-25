"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Chrome, Shield, ArrowRight, Download, CheckCircle2, AlertCircle } from "lucide-react";

const CWS_URL = process.env.NEXT_PUBLIC_EXTENSION_CWS_URL ||
  "https://chromewebstore.google.com/detail/streetmp-ai-privacy-shield";

export default function InstallExtensionPage() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenant") || "";
  const [browser, setBrowser] = useState("Detecting...");
  const [isChrome, setIsChrome] = useState(false);
  const [browserName, setBrowserName] = useState("your browser");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (ua.includes("Edg/")) {
      setBrowser("Microsoft Edge"); setBrowserName("Edge"); setIsChrome(true);
    } else if (ua.includes("Brave") || (ua.includes("Chrome") && (navigator as any).brave)) {
      setBrowser("Brave Browser"); setBrowserName("Brave"); setIsChrome(true);
    } else if (ua.includes("Chrome") && !ua.includes("OPR")) {
      setBrowser("Google Chrome"); setBrowserName("Chrome"); setIsChrome(true);
    } else if (ua.includes("Firefox")) {
      setBrowser("Mozilla Firefox"); setBrowserName("Firefox"); setIsChrome(false);
    } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
      setBrowser("Apple Safari"); setBrowserName("Safari"); setIsChrome(false);
    } else {
      setBrowser("Unknown Browser"); setBrowserName("your browser"); setIsChrome(false);
    }
  }, []);

  const activateUrl = `/extension/activate${tenantId ? `?tenant=${tenantId}` : ""}`;

  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
        <Shield size={32} className="text-emerald-400" />
      </div>

      <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4 text-center">
        Install the Enterprise Shield
      </h1>
      <p className="text-base text-zinc-400 text-center max-w-lg mb-10 leading-relaxed">
        The StreetMP OS extension runs directly in your browser to intercept, sanitize, and secure data before it ever reaches public AI models.
      </p>

      <div className="w-full rounded-2xl border border-white/[0.06] bg-[#08080e] p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-white/[0.04] mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center shrink-0">
              <Chrome size={24} className={isChrome ? "text-emerald-400" : "text-zinc-500"} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">Browser Detected</h3>
              <p className="text-xs text-zinc-400">{browser}</p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            {isChrome ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-mono font-bold text-emerald-400">
                <CheckCircle2 size={12} /> ✓ Chrome Web Store Compatible
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-orange-500/30 bg-orange-500/10 text-[10px] font-mono font-bold text-orange-400">
                <AlertCircle size={12} /> Chrome or Edge Required
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-6 h-6 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-zinc-400">1</div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Add to your browser</h4>
              <p className="text-xs text-zinc-500">Install the extension from the Chrome Web Store. It takes less than 5 seconds.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-6 h-6 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-zinc-400">2</div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Pin for easy access</h4>
              <p className="text-xs text-zinc-500">Click the puzzle icon and pin the StreetMP shield to your toolbar.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-6 h-6 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-zinc-400">3</div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Activate your device</h4>
              <p className="text-xs text-zinc-500">Return here to pair the extension with your enterprise organization.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {isChrome ? (
            <a
              href={CWS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-all bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
            >
              <Download size={16} /> Install Extension
            </a>
          ) : (
            <div className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
              <p className="text-xs text-zinc-400 text-center leading-relaxed">
                {browserName} isn\'t supported. Open this page in
                {" "}<strong className="text-white">Google Chrome</strong> or
                {" "}<strong className="text-white">Microsoft Edge</strong>, or ask your IT admin for the MDM deployment package.
              </p>
            </div>
          )}
          <Link
            href={activateUrl}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-black hover:bg-emerald-400 active:scale-[0.98] transition-all"
          >
            I\'ve Installed It <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
