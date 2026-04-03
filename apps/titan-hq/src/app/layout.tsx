import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Titan HQ 3.0",
  description: "Sovereign Sidecar for Business Operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased min-h-screen bg-zinc-950 text-zinc-300 flex`}>
        {/* WordPress Style Sidebar */}
        <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex-shrink-0 min-h-screen flex flex-col">
          <div className="p-6 border-b border-zinc-800 bg-zinc-950/50">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-blue-500">◈</span> Titan HQ 
            </h1>
            <p className="text-xs text-zinc-500 mt-1 font-mono tracking-widest uppercase">Sidecar 3.0</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 mt-4 px-3">Business</div>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md bg-blue-500/10 text-blue-400 font-medium text-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              Dashboard
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 text-zinc-400 text-sm transition-colors cursor-not-allowed">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
              Organizations
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 text-zinc-400 text-sm transition-colors cursor-not-allowed">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Staff Tracker
            </a>

            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 mt-8 px-3">Intelligence</div>
            <a href="#workspace" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 text-zinc-400 text-sm transition-colors">
              {/* Paperclip / AI Workspace icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              AI Workspace
            </a>
            <a href="#compliance" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 text-zinc-400 text-sm transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
              Compliance
            </a>

            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 mt-8 px-3">Troubleshooting</div>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 text-zinc-400 text-sm transition-colors cursor-not-allowed">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              Log Hunter
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800 text-zinc-400 text-sm transition-colors cursor-not-allowed">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Infra Pulse
            </a>
          </nav>
          
          <div className="p-4 border-t border-zinc-800 mt-auto bg-zinc-950/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs uppercase" suppressHydrationWarning>
                S
              </div>
              <div className="flex-1 overflow-hidden" suppressHydrationWarning>
                <div className="text-sm font-medium text-zinc-200 truncate">SUPER ADMIN</div>
                <div className="text-xs text-emerald-500 truncate">Bridge Online</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
