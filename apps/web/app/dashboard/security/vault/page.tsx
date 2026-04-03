"use client";

import React, { useState, useEffect } from "react";

/**
 * @file page.tsx
 * @description V47 Sovereign Data Vaults Dashboard
 * Strict Obsidian & Emerald Aesthetics enforced.
 */

export default function SovereignVaultPage() {
  const [mounted, setMounted] = useState(false);
  const [activeLock, setActiveLock] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans p-8">
      {/* Header */}
      <div className="mb-8 border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            <span className="text-emerald-400">V47</span>
            Sovereign Data Vaults
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Hold Your Own Key (HYOK) Cryptographic Storage Architecture.
          </p>
        </div>
        
        {/* Metric Block */}
        <div className="flex flex-col sm:flex-row items-end gap-6 md:gap-8 border-l border-white/10 pl-8">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Active Client Keys</p>
            <div className="flex items-center gap-2 justify-end mt-1">
              <p className="text-lg font-bold text-white uppercase tracking-widest">1</p>
            </div>
          </div>
          <div className="w-px h-8 bg-white/10 hidden sm:block" />
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Unencrypted Plaintext in Storage</p>
            <p className="text-xl font-mono text-emerald-400 mt-1">0 Bytes</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Span (2 cols): Cryptographic Key Manager Visualizer */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">
              <span className="text-emerald-500 inline-block mr-2 text-lg leading-none align-middle">🗄️</span> 
              Cryptographic Key Manager
            </h2>
            <button 
              onClick={() => setActiveLock(!activeLock)}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs font-mono text-white transition-all"
            >
              [ SIMULATE KMS REVOKE ]
            </button>
          </div>
          
          <div className="bg-black border border-white/10 rounded-md p-6 h-[400px] flex flex-col items-center justify-center relative overflow-hidden shadow-[inset_0_0_40px_rgba(0,0,0,1)]">
             {/* Background security perimeter */}
             <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/10 via-black to-black opacity-80" />
             
             <div className="z-10 w-full max-w-2xl relative flex flex-col items-center">
                
                {/* Visual Vault Mechanism */}
                <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center relative transition-all duration-1000 ${activeLock ? 'border-emerald-500/80 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.3)]'}`}>
                   
                   {/* Inner ring */}
                   <div className={`absolute inset-2 rounded-full border border-dashed transition-all duration-[3000ms] ${activeLock ? 'border-emerald-400/50 animate-[spin_10s_linear_infinite]' : 'border-red-400/50'}`} />
                   
                   {/* Keyhole Core */}
                   <div className={`w-12 h-16 flex flex-col items-center justify-center ${activeLock ? 'text-emerald-400' : 'text-red-400'}`}>
                      <span className="text-4xl">🔐</span>
                   </div>
                </div>

                <div className="mt-8 flex flex-col items-center">
                   <span className={`text-[10px] font-bold tracking-widest px-4 py-1 rounded border shadow-lg transition-all ${activeLock ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' : 'text-red-400 border-red-500/40 bg-red-500/10'}`}>
                     {activeLock ? "AES-256-GCM SEALED" : "KMS KEY REVOKED - DECRYPTION IMPOSSIBLE"}
                   </span>
                </div>

                {/* Simulated Redis Cache Below */}
                <div className="mt-12 w-full px-8 opacity-70">
                   <div className="border border-white/10 bg-[#050505] p-3 rounded flex flex-col gap-2 relative">
                      <div className="absolute -top-2.5 left-4 bg-black px-2 text-[8px] font-mono text-zinc-500">LOCAL REDIS CACHE</div>
                      
                      <div className="flex items-center gap-4">
                         <span className="text-[10px] text-zinc-500 font-mono w-24">trace_log_1</span>
                         <span className={`font-mono text-xs truncate ${activeLock ? 'text-emerald-500/60' : 'text-red-500/40 blur-[2px]'}`}>
                           {activeLock ? "0xD2F19E3...A49C [ENCRYPTED]" : "0xD2F19E3...A49C [SHREDDED]"}
                         </span>
                      </div>
                      <div className="flex items-center gap-4">
                         <span className="text-[10px] text-zinc-500 font-mono w-24">audit_hash_v3</span>
                         <span className={`font-mono text-xs truncate ${activeLock ? 'text-emerald-500/60' : 'text-red-500/40 blur-[2px]'}`}>
                           {activeLock ? "0x77B41EE...F002 [ENCRYPTED]" : "0x77B41EE...F002 [SHREDDED]"}
                         </span>
                      </div>
                   </div>
                </div>
             </div>
             
          </div>
        </div>

        {/* Right Span (1 col): System Storage Protocol */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">
            System Storage Protocol
          </h2>
          
          <div className="bg-[#050505] border border-white/10 rounded-md p-6 h-[400px] flex flex-col justify-between">
            <div className="space-y-6">
               <div className="space-y-2">
                 <div className="flex items-center justify-between">
                   <p className="text-sm text-white font-medium">Encryption Metric</p>
                   <span className="text-[10px] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded shadow-[0_0_5px_rgba(16,185,129,0.2)]">AES-256-GCM</span>
                 </div>
                 <p className="text-xs text-zinc-500">Standard cryptographic sealing across all StreetMP physical volumes.</p>
               </div>
               
               <div className="space-y-2">
                 <div className="flex items-center justify-between">
                   <p className="text-sm text-white font-medium">Client Key Control</p>
                   <span className="text-[10px] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded shadow-[0_0_5px_rgba(16,185,129,0.2)]">STRICT</span>
                 </div>
                 <p className="text-xs text-zinc-500">Keys never leave the client enclave. Node process holds logic strictly in cache.</p>
               </div>
               
               <div className="space-y-2">
                 <div className="flex items-center justify-between">
                   <p className="text-sm text-white font-medium">Auto-Destruct Protocol</p>
                   <span className="text-[10px] text-white/50 border border-white/10 bg-white/5 px-2 py-0.5 rounded">IDLE</span>
                 </div>
                 <p className="text-xs text-zinc-500">Data completely irretrievable upon programmatic Client KMS revoke signal.</p>
               </div>
            </div>
            
            <div className="mt-8 pt-4 border-t border-white/10 font-mono text-[9px] text-zinc-600 space-y-1">
              <p>v47.vault.engine_loaded()...</p>
              <p>aes_256_gcm.intercept_active()...</p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
