"use client";

import { useState } from "react";

type PolicyConditionField = "DATA_CLASS" | "TENANT" | "MODEL" | "TRUST_SCORE" | "JURISDICTION";
type PolicyOperator = "IS" | "IS_NOT" | "GREATER_THAN" | "LESS_THAN" | "CONTAINS";
type PolicyAction = "ALLOW" | "BLOCK" | "FLAG" | "APPLY_STRICT_MODE" | "REQUIRE_APPROVAL" | "REDACT";

interface PolicyCondition {
  id: string;
  field: PolicyConditionField;
  operator: PolicyOperator;
  value: string;
}

interface PolicyRule {
  id: string;
  name: string;
  conditions: PolicyCondition[];
  action: PolicyAction;
  priority: number;
}

const FIELD_LABELS: Record<PolicyConditionField, string> = {
  DATA_CLASS:   "Data Classification",
  TENANT:       "Tenant",
  MODEL:        "AI Model",
  TRUST_SCORE:  "Trust Score",
  JURISDICTION: "Jurisdiction",
};

const FIELD_OPTIONS: Record<PolicyConditionField, string[]> = {
  DATA_CLASS:   ["TOP_SECRET", "CONFIDENTIAL", "INTERNAL", "PUBLIC"],
  TENANT:       ["jpmc", "nhs", "klust", "all"],
  MODEL:        ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-flash", "any"],
  TRUST_SCORE:  ["90", "80", "70", "60", "50"],
  JURISDICTION: ["EU", "US", "APAC", "GLOBAL"],
};

const ACTION_STYLES: Record<PolicyAction, string> = {
  ALLOW:            "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  BLOCK:            "bg-red-500/10 text-red-400 border-red-500/30",
  FLAG:             "bg-amber-500/10 text-amber-400 border-amber-500/30",
  APPLY_STRICT_MODE:"bg-blue-500/10 text-blue-400 border-blue-500/30",
  REQUIRE_APPROVAL: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  REDACT:           "bg-orange-500/10 text-orange-400 border-orange-500/30",
};

const STARTER_RULES: PolicyRule[] = [
  {
    id: "rule-1",
    name: "Financial Data — Strict Mode",
    priority: 1,
    conditions: [{ id: "c1", field: "DATA_CLASS", operator: "IS", value: "TOP_SECRET" }],
    action: "APPLY_STRICT_MODE",
  },
  {
    id: "rule-2",
    name: "Block High-Risk Outputs",
    priority: 2,
    conditions: [{ id: "c2", field: "TRUST_SCORE", operator: "LESS_THAN", value: "60" }],
    action: "BLOCK",
  },
];

function uid() { return "c" + Math.random().toString(36).slice(2, 7); }

export default function PolicyBuilderPage() {
  const [rules, setRules] = useState<PolicyRule[]>(STARTER_RULES);
  const [saved, setSaved] = useState(false);

  const addRule = () => {
    const newRule: PolicyRule = {
      id:         "rule-" + Date.now(),
      name:       `New Policy Rule ${rules.length + 1}`,
      priority:   rules.length + 1,
      conditions: [{ id: uid(), field: "DATA_CLASS", operator: "IS", value: "CONFIDENTIAL" }],
      action:     "FLAG",
    };
    setRules(r => [...r, newRule]);
  };

  const updateRule = (ruleId: string, patch: Partial<PolicyRule>) => {
    setRules(rules => rules.map(r => r.id === ruleId ? { ...r, ...patch } : r));
  };

  const addCondition = (ruleId: string) => {
    setRules(rules => rules.map(r => r.id === ruleId
      ? { ...r, conditions: [...r.conditions, { id: uid(), field: "DATA_CLASS", operator: "IS", value: "PUBLIC" }] }
      : r));
  };

  const updateCondition = (ruleId: string, condId: string, patch: Partial<PolicyCondition>) => {
    setRules(rules => rules.map(r => r.id === ruleId
      ? { ...r, conditions: r.conditions.map(c => c.id === condId ? { ...c, ...patch } : c) }
      : r));
  };

  const removeCondition = (ruleId: string, condId: string) => {
    setRules(rules => rules.map(r => r.id === ruleId
      ? { ...r, conditions: r.conditions.filter(c => c.id !== condId) }
      : r));
  };

  const removeRule = (ruleId: string) => setRules(r => r.filter(x => x.id !== ruleId));

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    console.info("[V38:PolicyBuilder] Exported rules:", JSON.stringify(rules, null, 2));
  };

  const select = "bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-blue-500/50 focus:outline-none appearance-none";

  return (
    <div className="min-h-screen bg-[#0F172A] p-8 space-y-6 animate-in fade-in" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">No-Code Policy Builder</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Build V12 PAC rules visually. Each rule is compiled to a Policy-as-Code specification applied at execution time.
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs transition-all flex items-center gap-2
            ${saved ? "bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.25)]"}`}
        >
          {saved ? "✓ Policy Deployed" : "Deploy Policy"}
        </button>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.map((rule, ruleIndex) => (
          <div key={rule.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            {/* Rule Header */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
                {ruleIndex + 1}
              </div>
              <input
                className="flex-1 bg-transparent border-b border-slate-700 focus:border-blue-500 text-sm font-semibold text-white focus:outline-none pb-1"
                value={rule.name}
                onChange={e => updateRule(rule.id, { name: e.target.value })}
              />
              <button onClick={() => removeRule(rule.id)} className="text-slate-600 hover:text-red-400 transition-colors text-xs">remove</button>
            </div>

            {/* Conditions */}
            <div className="space-y-2 pl-10">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">IF</p>
              {rule.conditions.map((cond, ci) => (
                <div key={cond.id} className="flex items-center gap-2 flex-wrap">
                  {ci > 0 && <span className="text-[10px] font-bold text-slate-500 uppercase w-8">AND</span>}
                  <select
                    className={select}
                    value={cond.field}
                    onChange={e => updateCondition(rule.id, cond.id, { field: e.target.value as PolicyConditionField })}
                  >
                    {(Object.keys(FIELD_LABELS) as PolicyConditionField[]).map(f => (
                      <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                    ))}
                  </select>
                  <select
                    className={select}
                    value={cond.operator}
                    onChange={e => updateCondition(rule.id, cond.id, { operator: e.target.value as PolicyOperator })}
                  >
                    {(["IS", "IS_NOT", "GREATER_THAN", "LESS_THAN", "CONTAINS"] as PolicyOperator[]).map(op => (
                      <option key={op} value={op}>{op.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <select
                    className={select}
                    value={cond.value}
                    onChange={e => updateCondition(rule.id, cond.id, { value: e.target.value })}
                  >
                    {(FIELD_OPTIONS[cond.field] ?? []).map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  {rule.conditions.length > 1 && (
                    <button onClick={() => removeCondition(rule.id, cond.id)} className="text-slate-600 hover:text-red-400 text-xs">✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => addCondition(rule.id)} className="text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors">+ Add condition</button>
            </div>

            {/* Action */}
            <div className="pl-10 flex items-center gap-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">THEN</p>
              <div className="flex flex-wrap gap-2">
                {(["ALLOW", "BLOCK", "FLAG", "APPLY_STRICT_MODE", "REQUIRE_APPROVAL", "REDACT"] as PolicyAction[]).map(action => (
                  <button
                    key={action}
                    onClick={() => updateRule(rule.id, { action })}
                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all
                      ${rule.action === action
                        ? ACTION_STYLES[action]
                        : "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"}`}
                  >
                    {action.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* V12 PAC Preview */}
            <div className="pl-10">
              <details className="group">
                <summary className="text-[10px] font-bold text-slate-600 uppercase tracking-widest cursor-pointer hover:text-slate-400 transition-colors">
                  View V12 PAC Code
                </summary>
                <pre className="mt-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-[10px] font-mono text-emerald-300/80 overflow-x-auto">
{`// V12 Policy-as-Code (auto-generated)
rule "${rule.name}" {
  priority: ${rule.priority}
  when: ${rule.conditions.map(c => `${c.field} ${c.operator} "${c.value}"`).join(" AND ")}
  then: ${rule.action}
}`}
                </pre>
              </details>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addRule}
        className="w-full py-4 rounded-2xl border border-dashed border-slate-700 text-sm text-slate-500 hover:border-blue-500/40 hover:text-blue-400 transition-all font-medium"
      >
        + Add Policy Rule
      </button>
    </div>
  );
}
