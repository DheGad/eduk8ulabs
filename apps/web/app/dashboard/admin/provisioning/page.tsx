"use client";

import React, { useState } from "react";
import { ShieldCheck, Server, Key, Mail, CheckCircle, AlertTriangle } from "lucide-react";

interface PendingTenant {
  tenant_id: string;
  name: string;
  industry: string;
  employee_count: string;
  stripe_tier: string;
  status: "PENDING_APPROVAL" | "ACTIVE";
}

export default function AdminProvisioningPage() {
  const [tenants, setTenants] = useState<PendingTenant[]>([
    {
      tenant_id: "acme-corp",
      name: "Acme Healthcare Systems",
      industry: "Healthcare (HIPAA)",
      employee_count: "500-1000",
      stripe_tier: "Enterprise ($2000/mo)",
      status: "PENDING_APPROVAL",
    },
    {
      tenant_id: "fintech-trust",
      name: "Fintech Trust Bank",
      industry: "Financial (PCI-DSS)",
      employee_count: "1000-5000",
      stripe_tier: "Enterprise ($5000/mo)",
      status: "PENDING_APPROVAL",
    }
  ]);
  const [isProvisioning, setIsProvisioning] = useState<string | null>(null);

  const handleProvision = async (tenantId: string) => {
    setIsProvisioning(tenantId);
    
    // Simulate V18 API Key Generation & V99 Email Dispatch via backend proxy
    setTimeout(() => {
      setTenants(prev => prev.map(t => t.tenant_id === tenantId ? { ...t, status: "ACTIVE" } : t));
      setIsProvisioning(null);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-sans relative overflow-hidden">
      {/* ── Background Emerald Glass Effects ── */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[150px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-teal-800/20 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-10 border-b border-emerald-500/20 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            Admin Provisioning
          </h1>
          <p className="text-sm text-emerald-100/60 mt-2 font-mono uppercase tracking-widest">
            Pending Tenant Gatekeeper | God-Mode Clearance
          </p>
        </div>
        <div className="px-4 py-2 bg-emerald-900/30 border border-emerald-500/30 rounded-lg backdrop-blur-md flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold text-emerald-300">SYSTEM: ONLINE</span>
        </div>
      </div>

      {/* ── Pending Queue Table ── */}
      <div className="bg-emerald-950/20 backdrop-blur-2xl border border-emerald-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-900/10">
        <div className="px-6 py-4 border-b border-emerald-500/20 bg-emerald-900/10 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-emerald-50">Activation Queue</h2>
        </div>

        <div className="p-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-emerald-900/10 text-emerald-300/80 text-xs uppercase tracking-wider font-mono">
                <th className="px-6 py-4 font-medium">Tenant Name</th>
                <th className="px-6 py-4 font-medium">Industry</th>
                <th className="px-6 py-4 font-medium">Headcount</th>
                <th className="px-6 py-4 font-medium">Stripe Tier</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-500/10">
              {tenants.map((t) => (
                <tr key={t.tenant_id} className="hover:bg-emerald-900/5 transition-colors group">
                  <td className="px-6 py-5">
                    <p className="font-bold text-emerald-50 text-sm">{t.name}</p>
                    <p className="text-xs text-emerald-500/60 font-mono mt-1">{t.tenant_id}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-md bg-emerald-900/30 text-emerald-400 border border-emerald-500/20">
                      {t.industry}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-sm text-emerald-100/80 font-mono">
                    {t.employee_count}
                  </td>
                  <td className="px-6 py-5 text-sm text-emerald-100/80 font-mono">
                    {t.stripe_tier}
                  </td>
                  <td className="px-6 py-5 text-right">
                    {t.status === "PENDING_APPROVAL" ? (
                      <button
                        onClick={() => handleProvision(t.tenant_id)}
                        disabled={isProvisioning === t.tenant_id}
                        className={`inline-flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 ${
                          isProvisioning === t.tenant_id
                            ? "bg-emerald-600/50 text-emerald-100 cursor-not-allowed"
                            : "bg-emerald-500 hover:bg-emerald-400 text-[#050505] shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transform hover:-translate-y-0.5"
                        }`}
                      >
                        {isProvisioning === t.tenant_id ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-emerald-100 border-t-transparent animate-spin" />
                            Provisioning...
                          </>
                        ) : (
                          <>
                            <Key className="w-4 h-4" />
                            Verify & Provision
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-900/30 border border-emerald-500/30 rounded-lg text-emerald-400 font-mono text-xs font-bold uppercase">
                        <CheckCircle className="w-4 h-4" />
                        ACTIVE
                        <Mail className="w-3 h-3 ml-2 text-emerald-500" />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tenants.every(t => t.status === "ACTIVE") && (
            <div className="px-6 py-12 text-center text-emerald-500/50 font-mono text-sm uppercase tracking-widest">
              Queue is empty. All tenants operational.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
