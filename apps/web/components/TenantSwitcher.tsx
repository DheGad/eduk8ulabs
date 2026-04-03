"use client";

import { Building2, GraduationCap, Shield } from "lucide-react";

export type TenantType = "FINANCE" | "EDUCATION" | "DEFENSE" | "EU_CORP";

export interface TenantConfig {
  id: string;
  type: TenantType;
  label: string;
  icon: React.ElementType;
  themeColor: string;
  description: string;
}

export const TENANTS: Record<TenantType, TenantConfig> = {
  FINANCE: {
    id: "jpmc-global",
    type: "FINANCE",
    label: "JPMC (Finance)",
    icon: Building2,
    themeColor: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    description: "Regulatory Compliance Logs & Strict Guardrails",
  },
  EDUCATION: {
    id: "stanford-edu",
    type: "EDUCATION",
    label: "Stanford (Education)",
    icon: GraduationCap,
    themeColor: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    description: "Student AI Integrity Metrics & COPPA Rules",
  },
  DEFENSE: {
    id: "pentagon-dod",
    type: "DEFENSE",
    label: "Pentagon (Defense)",
    icon: Shield,
    themeColor: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    description: "ITAR Compliance & Air-Gapped Deployment",
  },
  EU_CORP: {
    id: "deutsche-bank",
    type: "EU_CORP",
    label: "Deutsche Bank (EU)",
    icon: Building2,
    themeColor: "text-violet-400 border-violet-500/30 bg-violet-500/10",
    description: "EU Data Residency & GDPR Geofencing",
  },
};

interface TenantSwitcherProps {
  selectedTenant: TenantType;
  onSelect: (tenant: TenantType) => void;
}

export function TenantSwitcher({ selectedTenant, onSelect }: TenantSwitcherProps) {
  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
      <div className="text-sm font-medium text-zinc-400">Active Organization Context</div>
      <div className="flex gap-2">
        {(Object.keys(TENANTS) as TenantType[]).map((key) => {
          const tenant = TENANTS[key];
          const isActive = selectedTenant === key;
          const Icon = tenant.icon;

          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm transition-all duration-200 border ${
                isActive
                  ? tenant.themeColor
                  : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-semibold">{tenant.label}</span>
            </button>
          );
        })}
      </div>
      <div className="text-xs text-zinc-500 italic mt-1">
        Context: {TENANTS[selectedTenant].description}
      </div>
    </div>
  );
}
