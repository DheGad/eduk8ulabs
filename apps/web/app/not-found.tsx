import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 selection:bg-[#10b981]/30">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid-sm opacity-[0.03] pointer-events-none" />
      
      {/* Glow Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#10b981]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-[#111111]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 mb-2">
          <svg className="w-8 h-8 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">404 - Node Offline</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            The route you are looking for does not exist in this environment.
          </p>
        </div>

        <div className="pt-4">
          <Link 
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[#10b981] hover:bg-[#059669] text-[#0a0a0a] font-semibold transition-all duration-200 shadow-lg shadow-[#10b981]/20 active:scale-[0.98]"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="pt-6 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-widest text-gray-600 font-mono">
            STREETMP-OS-V35 // ERROR_NODE_404
          </p>
        </div>
      </div>
    </div>
  );
}
