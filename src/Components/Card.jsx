import React from 'react';
import { ChevronRight } from 'lucide-react';

const accentColors = {
  purple: {
    gradient: 'from-purple-500/20 to-purple-900/10',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
    hover: 'hover:border-purple-500/40',
  },
  blue: {
    gradient: 'from-blue-500/20 to-blue-900/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    hover: 'hover:border-blue-500/40',
  },
  emerald: {
    gradient: 'from-emerald-500/20 to-emerald-900/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    hover: 'hover:border-emerald-500/40',
  },
  amber: {
    gradient: 'from-amber-500/20 to-amber-900/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    hover: 'hover:border-amber-500/40',
  },
  pink: {
    gradient: 'from-pink-500/20 to-pink-900/10',
    border: 'border-pink-500/20',
    text: 'text-pink-400',
    hover: 'hover:border-pink-500/40',
  },
};

export default function Card({ 
  title, 
  icon, 
  children, 
  accentColor = 'purple',
  className = '',
  onViewAll
}) {
  const colors = accentColors[accentColor] || accentColors.purple;

  return (
    <div className={`bg-gradient-to-br ${colors.gradient} backdrop-blur-sm border ${colors.border} ${colors.hover} rounded-2xl overflow-hidden transition-all ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-white/5 ${colors.text}`}>
            {icon}
          </div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        {onViewAll && (
          <button 
            onClick={onViewAll}
            className={`flex items-center gap-1 text-sm ${colors.text} hover:opacity-80 transition-opacity`}
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}