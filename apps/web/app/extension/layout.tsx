import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Extension Activation | StreetMP OS",
  description: "Install and activate the StreetMP OS Enterprise Extension for browser protection.",
};

export default function ExtensionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col selection:bg-emerald-500/20 antialiased">
      {/* Navbar */}
      <nav className="h-16 border-b border-white/[0.04] bg-[#050508]/80 backdrop-blur-md flex items-center px-6 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black tracking-tighter text-white">StreetMP</span>
          <span className="text-lg font-medium tracking-tighter text-emerald-400">Extension</span>
        </div>
        <div className="ml-auto text-[10px] font-mono text-zinc-500 uppercase tracking-widest border border-white/10 rounded-full px-3 py-1">
          Enterprise Setup
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="w-full max-w-2xl relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}
