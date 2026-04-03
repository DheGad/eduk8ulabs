import React from "react";
import Link from "next/link";
import { CheckCircle, ShieldAlert, Cpu } from "lucide-react";

interface VerifiedByStreetMPProps {
  proofId?: string;
  theme?: "dark" | "light";
  className?: string;
}

/**
 * VerifiedByStreetMP (The Kingmaker Component)
 * 
 * A drop-in React component for enterprise clients to display on their own UIs.
 * This proves to their end-users that the AI response was generated deterministically 
 * within the StreetMP OS Glass Box.
 */
export const VerifiedByStreetMP: React.FC<VerifiedByStreetMPProps> = ({ 
  proofId, 
  theme = "dark",
  className = "" 
}) => {
  
  const isDark = theme === "dark";

  // Fallback for unauthorized/invalid executions
  if (!proofId) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-medium transition-colors ${
        isDark 
          ? "bg-red-500/10 border-red-500/20 text-red-400" 
          : "bg-red-50 border-red-200 text-red-600"
      } ${className}`}>
        <ShieldAlert className="w-3.5 h-3.5" />
        <span>Unverified AI Output</span>
      </div>
    );
  }

  // The Cryptographically Valid Badge
  return (
    <Link 
      href={`https://streetmp.com/v/${proofId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border text-xs font-mono font-medium transition-all hover:scale-[1.02] active:scale-[0.98] ${
        isDark 
          ? "bg-black/40 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.05)]" 
          : "bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 shadow-sm"
      } ${className}`}
      title="View Cryptographic Proof of Execution Ledger"
    >
      <div className="relative flex items-center justify-center">
        <Cpu className="w-3.5 h-3.5 opacity-70 absolute animate-ping duration-1000" />
        <CheckCircle className="w-3.5 h-3.5 z-10 bg-black rounded-full" />
      </div>
      
      <span className="flex items-center gap-1.5 tracking-tight">
        Verified by <span className={`font-bold tracking-widest ${isDark ? "text-white" : "text-black"}`}>STREETMP OS</span>
      </span>

      <div className={`w-px h-3 ${isDark ? "bg-white/20" : "bg-black/10"}`} />
      
      <span className="opacity-60 truncate max-w-[80px]">
        {proofId.substring(0, 8)}
      </span>
    </Link>
  );
};

export default VerifiedByStreetMP;
