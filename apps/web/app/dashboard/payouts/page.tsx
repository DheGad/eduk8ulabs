"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getOnboardingLink,
  getPayoutBalance,
  type PayoutBalanceResponse,
} from "@/lib/apiClient";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100); // Convert cents to dollars
}

export default function PayoutsPage() {
  const [balance, setBalance] = useState<PayoutBalanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const data = await getPayoutBalance();
      setBalance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payout info.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const handleOnboard = async () => {
    setIsOnboarding(true);
    try {
      const url = await getOnboardingLink("US");
      // Redirect to Stripe Connect onboarding
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start onboarding.");
      setIsOnboarding(false);
    }
  };

  const totalAvailable = balance?.available.reduce((sum, b) => sum + b.amount, 0) ?? 0;
  const totalPending = balance?.pending.reduce((sum, b) => sum + b.amount, 0) ?? 0;
  const primaryCurrency = balance?.available[0]?.currency ?? balance?.pending[0]?.currency ?? "usd";

  return (
    <div className="min-h-screen bg-black/95 p-8 text-white">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 border-b border-white/10 pb-6">
          <h1 className="text-3xl font-light tracking-tight text-white mb-2">Payouts</h1>
          <p className="text-sm text-zinc-400">
            Manage your earnings from validated Smart Escrow contracts.
          </p>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
            <button
              onClick={() => { setError(null); setIsLoading(true); fetchBalance(); }}
              className="ml-4 text-xs underline text-red-300 hover:text-red-200"
            >
              Retry
            </button>
          </div>
        ) : !balance?.payouts_enabled ? (
          // ── Not Onboarded State ────────────────────────────────────
          <div className="rounded-2xl border border-dashed border-white/10 bg-black p-10 flex flex-col items-center gap-6 text-center">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl">
              💳
            </div>
            <div>
              <h2 className="text-xl font-medium text-white mb-2">
                Start Receiving Payments
              </h2>
              <p className="text-sm text-zinc-400 max-w-md">
                Link your bank account via Stripe to receive escrow payouts 
                when clients approve your AI-generated deliverables.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleOnboard}
                disabled={isOnboarding}
                className="rounded-full bg-emerald-500 px-8 py-3 text-sm font-semibold text-black transition-all hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isOnboarding ? "Redirecting to Stripe..." : "Link Bank Account to Start Earning"}
              </button>
              <p className="text-xs text-zinc-600">
                Secured by Stripe Connect Express. We never see your bank details.
              </p>
            </div>
          </div>
        ) : (
          // ── Onboarded State ────────────────────────────────────────
          <div className="flex flex-col gap-6">
            {/* Account badge */}
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-sm text-emerald-400 font-medium">Stripe Connect Active</span>
              {balance.stripe_account_id && (
                <span className="ml-auto font-mono text-xs text-zinc-500">
                  {balance.stripe_account_id}
                </span>
              )}
            </div>

            {/* Balance cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black p-6">
                <span className="text-xs text-zinc-500 uppercase tracking-widest">
                  Available to Pay Out
                </span>
                <span className="text-4xl font-light text-white font-mono">
                  {formatCurrency(totalAvailable, primaryCurrency)}
                </span>
                <p className="text-xs text-zinc-600">
                  Ready for instant transfer to your bank.
                </p>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black p-6">
                <span className="text-xs text-zinc-500 uppercase tracking-widest">
                  Pending
                </span>
                <span className="text-4xl font-light text-amber-400 font-mono">
                  {formatCurrency(totalPending, primaryCurrency)}
                </span>
                <p className="text-xs text-zinc-600">
                  Funds being processed by Stripe (2–7 days).
                </p>
              </div>
            </div>

            {/* Per-currency breakdown if multi-currency */}
            {(balance.available.length > 1 || balance.pending.length > 1) && (
              <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">
                  Multi-Currency Breakdown
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-600 text-xs">
                      <td className="pb-2">Currency</td>
                      <td className="pb-2 text-right">Available</td>
                      <td className="pb-2 text-right">Pending</td>
                    </tr>
                  </thead>
                  <tbody>
                    {balance.available.map((b) => (
                      <tr key={b.currency} className="border-t border-white/5">
                        <td className="py-2 font-mono uppercase text-zinc-300">{b.currency}</td>
                        <td className="py-2 text-right text-white">{formatCurrency(b.amount, b.currency)}</td>
                        <td className="py-2 text-right text-amber-400">
                          {formatCurrency(
                            balance.pending.find((p) => p.currency === b.currency)?.amount ?? 0,
                            b.currency
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={fetchBalance}
                className="rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-sm text-zinc-300 hover:bg-white/10 transition-all"
              >
                Refresh Balance
              </button>
              <button
                onClick={handleOnboard}
                className="rounded-full border border-white/10 px-6 py-2.5 text-sm text-zinc-400 hover:text-white transition-all"
              >
                Manage Stripe Account ↗
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
