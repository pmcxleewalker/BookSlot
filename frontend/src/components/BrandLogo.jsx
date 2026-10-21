import React from 'react';

export const BRAND = '#3730A3';

// BookSlot mark: a "B" built from a stem and two appointment blocks.
export const BrandMark = ({ size = 32, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden="true">
    <rect width="100" height="100" rx="24" fill={BRAND} />
    <rect x="27" y="22" width="12" height="56" rx="6" fill="#FFFFFF" />
    <rect x="43" y="22" width="26" height="25" rx="12.5" fill="#FFFFFF" />
    <rect x="43" y="53" width="32" height="25" rx="12.5" fill="#FFFFFF" />
  </svg>
);

// Mark + wordmark. `light` = for dark backgrounds.
const BrandLogo = ({ size = 32, light = false, className = '', textClassName = 'text-xl' }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <BrandMark size={size} />
    <span className={`font-semibold tracking-[-0.025em] ${textClassName} ${light ? 'text-white' : 'text-[#0B1220]'}`}
      style={{ fontFamily: "'Inter', 'Manrope', system-ui, sans-serif" }}>
      BookSlot
    </span>
  </span>
);

export default BrandLogo;
