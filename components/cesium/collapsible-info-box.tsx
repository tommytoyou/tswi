'use client';

import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleInfoBoxProps {
  title: string;
  subtitle?: string;
  indicatorColor?: string;
  indicatorPulse?: boolean;
  defaultCollapsed?: boolean;
  children: ReactNode;
  className?: string;
}

export function CollapsibleInfoBox({
  title,
  subtitle,
  indicatorColor = '#22c55e',
  indicatorPulse = false,
  defaultCollapsed = true,
  children,
  className = '',
}: CollapsibleInfoBoxProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 ${className}`}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center gap-2 p-3 hover:bg-slate-800/50 transition-colors rounded-lg"
      >
        <div
          className={`w-3 h-3 rounded-full flex-shrink-0 ${indicatorPulse ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: indicatorColor }}
        />
        <div className="flex-1 text-left">
          <span className="text-sm font-semibold text-white">{title}</span>
          {subtitle && (
            <span className="text-xs text-slate-500 ml-2">{subtitle}</span>
          )}
        </div>
        <div className="text-slate-400">
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {/* Content - collapsible */}
      {!isCollapsed && (
        <div className="px-3 pb-3 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}
