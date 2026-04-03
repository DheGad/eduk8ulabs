import React from 'react';
import Link from 'next/link';

interface EmptyStateProps {
  // New signature
  title?: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  
  // Legacy signature backward compatibility
  headline?: string;
  icon?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    id?: string;
  };
}

export function EmptyState({ title, headline, description, actionText, actionHref, icon, action }: EmptyStateProps) {
  const displayTitle = title || headline;
  const displayActionText = actionText || action?.label;
  const displayActionHref = actionHref || action?.href;
  const displayActionOnClick = action?.onClick;

  const buttonContent = (
    <button onClick={displayActionOnClick} className="relative inline-flex items-center justify-center px-6 py-3 rounded-lg overflow-hidden group w-full sm:w-auto">
      {/* Button Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#10b981] to-[#059669] transition-transform duration-300 group-hover:scale-[1.05]" />
      
      {/* Button Content */}
      <span className="relative z-10 font-semibold text-[#0a0a0a] flex items-center gap-2">
        {displayActionText}
        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </span>
    </button>
  );

  return (
    <div className="w-full flex items-center justify-center p-8">
      <div className="max-w-md w-full relative">
        {/* Subtle Glow Behind Card */}
        <div className="absolute inset-0 bg-[#10b981]/5 blur-[60px] rounded-full pointer-events-none" />
        
        <div className="relative bg-[#0a0a0a]/80 backdrop-blur-xl border border-dashed border-white/20 rounded-2xl p-10 text-center shadow-lg transform transition-all hover:border-white/30">
          <div className="mx-auto w-16 h-16 rounded-xl bg-[#111111] border border-white/10 flex items-center justify-center mb-6 shadow-inner">
            {icon ? (
              <span className="text-2xl">{icon === 'sparkle' ? '✨' : icon === 'grid' ? '🔲' : icon === 'key' ? '🔑' : '✨'}</span>
            ) : (
              <svg className="w-8 h-8 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
            {displayTitle}
          </h3>
          <p className="text-sm text-gray-400 mb-8 leading-relaxed max-w-[280px] mx-auto">
            {description}
          </p>
          
          {displayActionHref ? (
            <Link href={displayActionHref}>{buttonContent}</Link>
          ) : (
            buttonContent
          )}
        </div>
      </div>
    </div>
  );
}

