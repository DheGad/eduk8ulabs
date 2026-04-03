"use client";

import React from 'react';
import Link from 'next/link';

const STEPS = [
  {
    number: 1,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    title: "Generate your secure API Key",
    description: "Create your personal credential to start routing AI requests safely through StreetMP OS. It only takes a few seconds.",
    action: "Generate Key →",
    href: "/dashboard/admin/keys",
    highlight: true,
  },
  {
    number: 2,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
      </svg>
    ),
    title: "Connect your AI tools in one line",
    description: "Point your existing OpenAI, Anthropic, or any AI app to our endpoint. No code changes needed — just swap the URL.",
    action: "View Setup Guide →",
    href: "/dashboard/developer/integration",
  },
  {
    number: 3,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
    title: "Watch your security dashboard light up",
    description: "Every AI request is tracked, audited, and protected in real-time. Your compliance log fills up automatically.",
    action: "Open Dashboard →",
    href: "/dashboard",
  },
];

export default function WelcomePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 selection:bg-emerald-500/20 transition-colors duration-300"
      style={{ background: "var(--bg-canvas)" }}
    >

      {/* Subtle background glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(5,150,105,0.06) 0%, transparent 70%)" }}
      />

      <main className="relative z-10 max-w-xl w-full">

        {/* Header */}
        <header className="text-center mb-10">
          {/* Brand badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full text-xs font-semibold uppercase tracking-wider border"
            style={{
              background: "var(--emerald-glow)",
              borderColor: "rgba(5,150,105,0.25)",
              color: "var(--brand-primary)"
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "var(--brand-primary)" }}
            />
            Getting Started
          </div>

          <h1
            className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 leading-none"
            style={{ color: "var(--text-primary)" }}
          >
            Welcome to<br />
            <span style={{ color: "var(--brand-primary)" }}>StreetMP OS</span>
          </h1>

          <p className="text-base leading-relaxed max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
            Your enterprise AI security platform is ready. Follow these 3 steps to go live — no technical knowledge needed.
          </p>
        </header>

        {/* Steps */}
        <section className="space-y-4 mb-8">
          {STEPS.map((step) => (
            <Link href={step.href} key={step.number} className="group block no-underline">
              <div
                className="relative flex items-start gap-5 p-5 rounded-2xl border transition-all duration-200"
                style={{
                  background: step.highlight ? "rgba(5,150,105,0.04)" : "var(--bg-panel)",
                  borderColor: step.highlight ? "rgba(5,150,105,0.30)" : "var(--border-subtle)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {/* Step number + icon */}
                <div
                  className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center font-bold text-lg transition-all duration-200 group-hover:scale-105"
                  style={{
                    background: step.highlight ? "var(--brand-primary)" : "var(--bg-raised)",
                    color: step.highlight ? "#ffffff" : "var(--text-muted)",
                    border: step.highlight ? "none" : "1px solid var(--border-default)",
                  }}
                >
                  <span style={{ color: step.highlight ? "white" : "var(--brand-primary)" }}>
                    {step.icon}
                  </span>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "var(--text-dimmed)" }}
                    >
                      Step {step.number}
                    </span>
                  </div>
                  <h3
                    className="text-[15px] font-semibold leading-snug mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="text-[13px] leading-relaxed"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {step.description}
                  </p>
                </div>

                {/* Arrow */}
                <div
                  className="shrink-0 self-center rounded-lg w-8 h-8 flex items-center justify-center transition-all duration-200 group-hover:translate-x-0.5"
                  style={{
                    background: "var(--bg-raised)",
                    color: "var(--text-dimmed)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </section>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/dashboard/admin/keys"
            id="welcome-get-started-btn"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-base text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 w-full sm:w-auto"
            style={{
              background: "linear-gradient(135deg, var(--brand-primary) 0%, #047857 100%)",
              boxShadow: "0 4px 20px rgba(5,150,105,0.30)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Get Started Now
          </Link>

          <p className="text-xs mt-4" style={{ color: "var(--text-dimmed)" }}>
            Already set up?{" "}
            <Link
              href="/dashboard"
              id="welcome-go-dashboard-link"
              className="font-semibold underline underline-offset-2 transition-colors"
              style={{ color: "var(--brand-primary)" }}
            >
              Go to Dashboard
            </Link>
          </p>
        </div>

      </main>
    </div>
  );
}
