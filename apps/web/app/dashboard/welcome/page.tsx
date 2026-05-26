"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Chrome, Users, ShieldCheck, ArrowRight, Rocket } from "lucide-react";

// ── Step definitions ──────────────────────────────────────────────
const STEPS = [
  {
    id: "extension",
    number: 1,
    icon: <Chrome className="w-5 h-5" />,
    title: "Install the Browser Extension",
    description:
      "Add StreetMP to Chrome or Edge in 60 seconds. It silently monitors AI usage and enforces your security policy — no VPN, no IT ticket needed.",
    primaryAction: "Add to Chrome — It's Free",
    primaryHref:
      "https://chrome.google.com/webstore/detail/streetmp-os",
    secondaryAction: "MDM Enterprise Deployment →",
    secondaryHref: "/docs/mdm-deployment",
    completionKey: "onboarding_step1_done",
  },
  {
    id: "team",
    number: 2,
    icon: <Users className="w-5 h-5" />,
    title: "Invite Your Team",
    description:
      "Invite teammates so they are automatically protected the moment they sign in. You can add more people later from Settings.",
    primaryAction: "Invite People →",
    primaryHref: "/dashboard/settings/organization",
    secondaryAction: "Skip for now",
    secondaryHref: null,
    completionKey: "onboarding_step2_done",
  },
  {
    id: "policy",
    number: 3,
    icon: <ShieldCheck className="w-5 h-5" />,
    title: "Set Your First AI Policy",
    description:
      "Choose what StreetMP should protect. Enable PII blocking with one click — names, emails, and IDs are removed before they reach any AI tool.",
    primaryAction: "Create a Policy →",
    primaryHref: "/dashboard/security/dlp",
    secondaryAction: "Use recommended defaults",
    secondaryHref: null,
    completionKey: "onboarding_step3_done",
  },
];

// ── Trust badges ──────────────────────────────────────────────────
const TRUST_ITEMS = [
  "SOC 2 Type II",
  "GDPR Ready",
  "Zero data retention",
  "End-to-end encrypted",
];

export default function WelcomePage() {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [activeStep, setActiveStep] = useState(0);

  // Load completion state from localStorage
  useEffect(() => {
    const completed = new Set<string>();
    STEPS.forEach((step) => {
      if (localStorage.getItem(step.completionKey) === "true") {
        completed.add(step.id);
      }
    });
    setCompletedSteps(completed);
    // Set active step to first incomplete
    const firstIncomplete = STEPS.findIndex((s) => !completed.has(s.id));
    setActiveStep(firstIncomplete === -1 ? STEPS.length - 1 : firstIncomplete);
  }, []);

  const markDone = (stepId: string, key: string) => {
    localStorage.setItem(key, "true");
    setCompletedSteps((prev) => new Set([...prev, stepId]));
  };

  const allDone = completedSteps.size >= STEPS.length;
  const progress = Math.round((completedSteps.size / STEPS.length) * 100);

  const handleFinish = () => {
    localStorage.setItem("onboarding_completed", "true");
    localStorage.setItem("v100-walkthrough-done", "true");
    window.location.href = "/dashboard";
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 selection:bg-emerald-500/20"
      style={{ background: "var(--bg-canvas)" }}
    >
      {/* Background glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(5,150,105,0.05) 0%, transparent 70%)",
        }}
      />

      <main className="relative z-10 w-full max-w-2xl">

        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="text-center mb-10">
          {/* Brand badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full text-xs font-semibold border"
            style={{
              background: "rgba(5,150,105,0.07)",
              borderColor: "rgba(5,150,105,0.20)",
              color: "var(--brand-primary)",
            }}
          >
            <Rocket className="w-3 h-3" />
            Getting Started — 5 minutes to full protection
          </div>

          <h1
            className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 leading-none"
            style={{ color: "var(--text-primary)" }}
          >
            Welcome to{" "}
            <span style={{ color: "var(--brand-primary)" }}>StreetMP OS</span>
          </h1>

          <p
            className="text-base leading-relaxed max-w-md mx-auto"
            style={{ color: "var(--text-muted)" }}
          >
            Your team can use any AI tool safely. Follow these 3 steps to
            activate protection — no technical setup required.
          </p>
        </header>

        {/* ── Progress Bar ───────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--text-muted)" }}
            >
              {completedSteps.size} of {STEPS.length} steps complete
            </span>
            <span
              className="text-xs font-bold"
              style={{ color: "var(--brand-primary)" }}
            >
              {progress}%
            </span>
          </div>
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-raised)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, var(--brand-primary), #047857)",
              }}
            />
          </div>
        </div>

        {/* ── Steps ──────────────────────────────────────────────── */}
        <section className="space-y-3 mb-8">
          {STEPS.map((step, idx) => {
            const done = completedSteps.has(step.id);
            const isActive = idx === activeStep;

            return (
              <div
                key={step.id}
                className="rounded-2xl border transition-all duration-200"
                style={{
                  background: isActive
                    ? "rgba(5,150,105,0.04)"
                    : "var(--bg-panel)",
                  borderColor: isActive
                    ? "rgba(5,150,105,0.28)"
                    : done
                    ? "rgba(5,150,105,0.12)"
                    : "var(--border-subtle)",
                }}
              >
                {/* Step header — always visible */}
                <button
                  className="w-full flex items-center gap-4 p-5 text-left"
                  onClick={() => setActiveStep(isActive ? -1 : idx)}
                >
                  {/* Number / Check icon */}
                  <div
                    className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center transition-all"
                    style={{
                      background: done
                        ? "rgba(5,150,105,0.15)"
                        : isActive
                        ? "var(--brand-primary)"
                        : "var(--bg-raised)",
                      border: done
                        ? "1px solid rgba(5,150,105,0.25)"
                        : "none",
                      color: done
                        ? "#10b981"
                        : isActive
                        ? "#ffffff"
                        : "var(--text-dimmed)",
                    }}
                  >
                    {done ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      step.icon
                    )}
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "var(--text-dimmed)" }}
                      >
                        Step {step.number}
                      </span>
                      {done && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                          · Complete
                        </span>
                      )}
                    </div>
                    <p
                      className="text-[15px] font-semibold leading-snug mt-0.5"
                      style={{
                        color: done
                          ? "var(--text-muted)"
                          : "var(--text-primary)",
                        textDecoration: done ? "line-through" : "none",
                        opacity: done ? 0.6 : 1,
                      }}
                    >
                      {step.title}
                    </p>
                  </div>

                  {/* Expand arrow */}
                  <span
                    className={`text-lg transition-transform duration-200 ${
                      isActive ? "rotate-90" : ""
                    }`}
                    style={{ color: "var(--text-dimmed)" }}
                  >
                    ›
                  </span>
                </button>

                {/* Expanded content */}
                {isActive && (
                  <div className="px-5 pb-5 pt-0">
                    <p
                      className="text-sm leading-relaxed mb-5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {step.description}
                    </p>

                    <div className="flex flex-wrap gap-3">
                      {/* Primary CTA */}
                      <a
                        href={step.primaryHref}
                        target={
                          step.primaryHref.startsWith("http")
                            ? "_blank"
                            : "_self"
                        }
                        rel="noopener noreferrer"
                        onClick={() =>
                          markDone(step.id, step.completionKey)
                        }
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
                        style={{
                          background:
                            "linear-gradient(135deg, var(--brand-primary), #047857)",
                          boxShadow: "0 2px 12px rgba(5,150,105,0.25)",
                        }}
                      >
                        {step.primaryAction}
                        <ArrowRight className="w-4 h-4" />
                      </a>

                      {/* Secondary CTA */}
                      {step.secondaryHref ? (
                        <Link
                          href={step.secondaryHref}
                          className="inline-flex items-center px-5 py-2.5 rounded-xl font-medium text-sm transition-all hover:opacity-80"
                          style={{
                            color: "var(--text-muted)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          {step.secondaryAction}
                        </Link>
                      ) : (
                        <button
                          onClick={() =>
                            markDone(step.id, step.completionKey)
                          }
                          className="inline-flex items-center px-5 py-2.5 rounded-xl font-medium text-sm transition-all hover:opacity-80"
                          style={{
                            color: "var(--text-muted)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          {step.secondaryAction}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ── Final CTA ──────────────────────────────────────────── */}
        <div className="text-center space-y-4">
          {allDone ? (
            <button
              onClick={handleFinish}
              id="welcome-go-dashboard-btn"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-base text-white transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-primary) 0%, #047857 100%)",
                boxShadow: "0 4px 20px rgba(5,150,105,0.30)",
              }}
            >
              Go to Dashboard →
            </button>
          ) : (
            <Link
              href="/dashboard"
              id="welcome-skip-link"
              onClick={() => {
                localStorage.setItem("onboarding_completed", "true");
                localStorage.setItem("v100-walkthrough-done", "true");
              }}
              className="text-sm font-medium transition-colors"
              style={{ color: "var(--text-dimmed)" }}
            >
              Skip setup and go to dashboard →
            </Link>
          )}
        </div>

        {/* ── Trust bar ──────────────────────────────────────────── */}
        <div className="mt-12 pt-8 flex flex-wrap items-center justify-center gap-4"
          style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {TRUST_ITEMS.map((item) => (
            <div
              key={item}
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: "var(--text-dimmed)" }}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              {item}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
