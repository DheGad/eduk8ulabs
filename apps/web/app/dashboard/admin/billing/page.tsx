"use client";

import { useState } from "react";
import { ApiError } from "@/lib/apiClient"; // Assuming apiClient used for fetches if we had them

// ================================================================
// MOCK DATA & TYPES
// ================================================================

type Invoice = {
  id: string;
  date: string;
  amount: string;
  status: "Paid" | "Open" | "Failed";
  downloadUrl: string;
};

const MOCK_INVOICES: Invoice[] = []; // Change to [] to test Empty State

// ================================================================
// MICRO-COMPONENTS
// ================================================================

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-emerald-500/20 bg-emerald-950/40 p-6 shadow-[0_0_40px_-10px_rgba(16,185,129,0.2)]">
        <h3 className="mb-4 text-lg font-light text-emerald-50 tracking-tight">{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ================================================================
// PAGE
// ================================================================

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState("Pro");
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handlePlanChange(newPlan: string) {
    setLoading(true);
    // Simulating API call to change plan
    setTimeout(() => {
      setCurrentPlan(newPlan);
      setLoading(false);
    }, 1000);
  }

  async function handleCancelSubscription() {
    setLoading(true);
    // Simulating API call to cancel subscription
    setTimeout(() => {
      setCurrentPlan("Free");
      setIsCancelModalOpen(false);
      setLoading(false);
    }, 1500);
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extralight text-emerald-50 tracking-tight">Billing Management</h1>
        <p className="text-sm text-emerald-100/60 mt-2">Manage your subscription, plans, and invoices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Subscription Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-emerald-500/20 bg-black/60 backdrop-blur-md p-6 shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] relative overflow-hidden">
            <h2 className="text-lg font-medium text-emerald-400 mb-4">Current Subscription</h2>
            
            <div className="flex items-end gap-3 mb-6">
              <span className="text-4xl font-light text-white">{currentPlan}</span>
              <span className="text-emerald-500/80 text-sm mb-1">Plan</span>
            </div>

            <div className="space-y-3">
              <button
                disabled={loading || currentPlan === "Pro"}
                onClick={() => handlePlanChange("Pro")}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/40"
              >
                {loading && currentPlan !== "Pro" ? "Upgrading..." : "Upgrade to Pro"}
              </button>
              
              <button
                disabled={loading || currentPlan === "Starter"}
                onClick={() => handlePlanChange("Starter")}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-emerald-100/80 transition-all duration-200 disabled:opacity-40 focus:outline-none border border-emerald-900/50 bg-emerald-950/30 hover:bg-emerald-900/50 hover:text-white"
              >
                Downgrade to Starter
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-emerald-900/30">
              <button
                onClick={() => setIsCancelModalOpen(true)}
                disabled={loading || currentPlan === "Free"}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-red-400 border border-red-900/30 bg-red-950/20 hover:bg-red-900/40 hover:text-red-300 transition-all disabled:opacity-40"
              >
                Cancel Subscription
              </button>
            </div>
          </div>
        </div>

        {/* Invoice History */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-emerald-500/20 bg-black/60 backdrop-blur-md p-6 shadow-[0_0_30px_-10px_rgba(16,185,129,0.1)] h-full">
            <h2 className="text-lg font-medium text-emerald-400 mb-6">Invoice History</h2>
            
            {invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-emerald-900/50 bg-emerald-950/10">
                <svg className="w-12 h-12 text-emerald-800 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-emerald-100/80 font-medium">No invoices found</h3>
                <p className="text-sm text-emerald-500/50 mt-1">You haven't made any payments yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-emerald-100/80">
                  <thead className="text-xs text-emerald-500/80 uppercase bg-emerald-950/30 border-b border-emerald-900/50">
                    <tr>
                      <th className="px-4 py-3 font-medium">Invoice ID</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-emerald-900/20 hover:bg-emerald-900/10 transition-colors">
                        <td className="px-4 py-4 font-mono text-xs">{inv.id}</td>
                        <td className="px-4 py-4">{inv.date}</td>
                        <td className="px-4 py-4">{inv.amount}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-semibold tracking-wide ${
                            inv.status === "Paid" ? "bg-emerald-500/20 text-emerald-400" :
                            inv.status === "Open" ? "bg-amber-500/20 text-amber-400" :
                            "bg-red-500/20 text-red-400"
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <a href={inv.downloadUrl} className="text-emerald-400 hover:text-emerald-300 transition-colors">Download</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Subscription?">
        <p className="text-sm text-emerald-100/70 mb-6">
          Are you sure you want to cancel your subscription? You will lose access to Pro features at the end of your current billing cycle. This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button 
            onClick={() => setIsCancelModalOpen(false)}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-emerald-100/70 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-900/50 transition-colors disabled:opacity-50"
          >
            Keep Plan
          </button>
          <button 
            onClick={handleCancelSubscription}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600/80 hover:bg-red-500 border border-red-500/50 transition-colors shadow-lg shadow-red-900/20 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : null}
            Yes, Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
