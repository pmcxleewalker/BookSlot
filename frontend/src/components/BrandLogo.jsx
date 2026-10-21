import React from 'react';

// BookSlot mark: a calendar with a booked (coral) slot.
export const BrandMark = ({ size = 32, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
    <rect width="64" height="64" rx="16" fill="#0A0A0A" />
    <rect x="21" y="9" width="5" height="10" rx="2.5" fill="#FFFFFF" />
    <rect x="38" y="9" width="5" height="10" rx="2.5" fill="#FFFFFF" />
    <g fill="#FFFFFF" opacity="0.35">
      <rect x="12" y="23" width="12" height="9" rx="2.5" />
      <rect x="26" y="23" width="12" height="9" rx="2.5" />
      <rect x="40" y="23" width="12" height="9" rx="2.5" />
      <rect x="12" y="35" width="12" height="9" rx="2.5" />
      <rect x="12" y="47" width="12" height="9" rx="2.5" />
      <rect x="26" y="47" width="12" height="9" rx="2.5" />
    </g>
    <rect x="26" y="35" width="26" height="21" rx="4" fill="#E34A33" />
    <path d="M32.5 45.5 L37 50 L45.5 41.5" fill="none" stroke="#FFFFFF" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Mark + wordmark. `light` = for dark backgrounds.
const BrandLogo = ({ size = 32, light = false, className = '', textClassName = 'text-xl' }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <BrandMark size={size} className={light ? 'ring-1 ring-white/15 rounded-[25%]' : ''} />
    <span className={`font-bold tracking-tight ${textClassName} ${light ? 'text-white' : 'text-[#0A0A0A]'}`}>
      Book<span className="text-[#E34A33]">Slot</span>
    </span>
  </span>
);

export default BrandLogo;
