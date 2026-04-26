import React from 'react';

/**
 * Decorative gold-leaf ornaments for the Onyx & Gold theme.
 * Pure SVG, no external assets. Use `variant` to pick layout.
 *  - "frame"   : two mirrored sprigs flanking a centred logo/title
 *  - "corner"  : single sprig anchored to a corner (use rotate prop)
 *  - "divider" : thin horizontal flourish (good between sections)
 */

const Sprig = ({ className = '', style }) => (
  <svg
    viewBox="0 0 120 80"
    className={className}
    style={style}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="goldLeafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F4E4A6" />
        <stop offset="50%" stopColor="#D4AF37" />
        <stop offset="100%" stopColor="#A8842A" />
      </linearGradient>
    </defs>
    {/* Main stem */}
    <path d="M8 70 Q 40 55 60 40 T 112 12" stroke="url(#goldLeafGrad)" strokeWidth="1.2" strokeLinecap="round" />
    {/* Leaves left side */}
    <path d="M22 64 Q 14 58 10 50 Q 18 52 24 60 Z" fill="url(#goldLeafGrad)" opacity="0.9" />
    <path d="M40 54 Q 30 50 26 40 Q 36 44 42 52 Z" fill="url(#goldLeafGrad)" opacity="0.85" />
    <path d="M60 40 Q 50 38 44 28 Q 56 32 62 38 Z" fill="url(#goldLeafGrad)" opacity="0.9" />
    {/* Leaves right side */}
    <path d="M72 32 Q 80 24 92 22 Q 86 32 76 36 Z" fill="url(#goldLeafGrad)" opacity="0.85" />
    <path d="M92 20 Q 100 14 112 14 Q 106 24 96 26 Z" fill="url(#goldLeafGrad)" opacity="0.9" />
    {/* Buds */}
    <circle cx="20" cy="68" r="1.5" fill="url(#goldLeafGrad)" />
    <circle cx="50" cy="48" r="1.2" fill="url(#goldLeafGrad)" />
    <circle cx="78" cy="30" r="1.3" fill="url(#goldLeafGrad)" />
    <circle cx="108" cy="14" r="1.5" fill="url(#goldLeafGrad)" />
  </svg>
);

const Divider = ({ className = '' }) => (
  <svg viewBox="0 0 240 18" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="goldDivider" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#D4AF37" stopOpacity="0" />
        <stop offset="50%" stopColor="#D4AF37" stopOpacity="1" />
        <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
      </linearGradient>
    </defs>
    <line x1="0" y1="9" x2="240" y2="9" stroke="url(#goldDivider)" strokeWidth="0.8" />
    <circle cx="120" cy="9" r="3" fill="#D4AF37" />
    <circle cx="120" cy="9" r="1.2" fill="#0A0A0A" />
    <path d="M104 9 L 116 9 M124 9 L 136 9" stroke="#D4AF37" strokeWidth="0.6" />
  </svg>
);

const GoldLeafDecor = ({ variant = 'frame', className = '' }) => {
  if (variant === 'divider') {
    return <Divider className={`mx-auto ${className}`} />;
  }
  if (variant === 'corner') {
    return <Sprig className={className} />;
  }
  // frame: two mirrored sprigs
  return (
    <div className={`flex items-center justify-center gap-6 ${className}`} aria-hidden="true">
      <Sprig className="w-20 h-14 -scale-x-100 opacity-80" />
      <Sprig className="w-20 h-14 opacity-80" />
    </div>
  );
};

export default GoldLeafDecor;
