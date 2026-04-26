// Theme presets — premium colour systems for tenants.
// A preset is the *floor*: tenants can still override individual colours via Branding.

export const THEME_PRESETS = {
  default: {
    key: 'default',
    name: 'Champagne & Blush',
    description: 'The signature BookSlot look — warm cream surfaces, blush primary, antique gold accents.',
    swatch: ['#FAF7F3', '#C4898E', '#D4A373', '#2C2A29'],
    mode: 'light',
    colors: {
      primary: '#C4898E',
      secondary: '#2C2A29',
      accent: '#D4A373',
    },
    tokens: {
      // Shell / layout
      shellBg: '#FDFCFA',
      sidebarBg: '#F7F3EE',
      sidebarBorder: '#E5DFD9',
      topbarBg: 'rgba(255,255,255,0.8)',
      topbarBorder: '#F0EBE6',
      surface: '#FFFFFF',
      surfaceMuted: '#FAF8F6',
      surfaceBorder: '#EDE8E3',
      // Type
      headingFont: "'Cormorant Garamond', serif",
      scriptFont: "'Cormorant Garamond', serif",
      bodyFont: "'Inter', system-ui, sans-serif",
      textPrimary: '#2C2A29',
      textSecondary: '#706B68',
      textMuted: '#9E948F',
      // Public booking hero
      heroBg: 'linear-gradient(180deg, #E8C5C822 0%, #FAF7F3 40%)',
      decor: false,
    },
  },
  onyx_gold: {
    key: 'onyx_gold',
    name: 'Onyx & Gold',
    description: 'Rich black canvas, antique-gold leaf, and serif typography. Perfect for premium luxury salons.',
    swatch: ['#0A0A0A', '#1A1A1A', '#D4AF37', '#E9D29A'],
    mode: 'dark',
    colors: {
      primary: '#D4AF37',     // antique gold
      secondary: '#0A0A0A',   // onyx
      accent: '#E9D29A',      // pale champagne gold
    },
    tokens: {
      // Shell / layout
      shellBg: '#0A0A0A',
      sidebarBg: '#0F0F0F',
      sidebarBorder: '#1F1B14',
      topbarBg: 'rgba(10,10,10,0.85)',
      topbarBorder: '#1F1B14',
      surface: '#141414',
      surfaceMuted: '#1A1A1A',
      surfaceBorder: '#2A2218',
      // Type
      headingFont: "'Cinzel', 'Cormorant Garamond', serif",
      scriptFont: "'Allura', 'Cormorant Garamond', serif",
      bodyFont: "'Inter', system-ui, sans-serif",
      textPrimary: '#F5EFE0',
      textSecondary: '#B8AE99',
      textMuted: '#8A8275',
      // Public booking hero
      heroBg: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.18) 0%, rgba(10,10,10,0) 60%), #0A0A0A',
      decor: true, // render gold-leaf decoration
    },
  },
};

/**
 * Resolve theme tokens for a tenant.
 * Falls back to the default preset if none set, then layers in the tenant's
 * custom colour overrides (primary/secondary/accent) on top.
 */
export const resolveTheme = (tenant) => {
  const presetKey = tenant?.branding?.theme_preset || 'default';
  const preset = THEME_PRESETS[presetKey] || THEME_PRESETS.default;
  const b = tenant?.branding || {};
  return {
    ...preset,
    colors: {
      primary: b.primary_color || preset.colors.primary,
      secondary: b.secondary_color || preset.colors.secondary,
      accent: b.accent_color || preset.colors.accent,
    },
    tokens: preset.tokens,
    isDark: preset.mode === 'dark',
    presetKey: preset.key,
  };
};
