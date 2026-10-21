import React, { createContext, useContext, useState, useEffect } from 'react';

// Available themes for tenants to choose from
export const themes = {
  default: {
    id: 'default',
    name: 'Classic Light',
    description: 'Clean, professional light theme',
    colors: {
      background: '#FFFFFF',
      backgroundSecondary: '#FAFAFA',
      text: '#0A0A0A',
      textSecondary: '#666666',
      accent: '#3730A3',
      border: '#E5E5E5',
      sidebar: '#FFFFFF',
      sidebarText: '#666666',
      sidebarActive: '#0A0A0A',
      card: '#FFFFFF',
      buttonPrimary: '#121212',
      buttonPrimaryText: '#FFFFFF'
    },
    hasBorder: false
  },
  elite: {
    id: 'elite',
    name: 'Elite Gold',
    description: 'Luxurious black & gold theme',
    colors: {
      background: '#0A0A0A',
      backgroundSecondary: '#141414',
      text: '#FFFFFF',
      textSecondary: '#B8B8B8',
      accent: '#D4AF37',
      border: '#2A2A2A',
      sidebar: '#0A0A0A',
      sidebarText: '#B8B8B8',
      sidebarActive: '#D4AF37',
      card: '#141414',
      buttonPrimary: '#D4AF37',
      buttonPrimaryText: '#0A0A0A'
    },
    hasBorder: true,
    borderStyle: 'elite-gold-waves'
  },
  modern: {
    id: 'modern',
    name: 'Modern Dark',
    description: 'Sleek dark mode theme',
    colors: {
      background: '#1A1A2E',
      backgroundSecondary: '#16213E',
      text: '#EAEAEA',
      textSecondary: '#A0A0A0',
      accent: '#E94560',
      border: '#2A2A4A',
      sidebar: '#16213E',
      sidebarText: '#A0A0A0',
      sidebarActive: '#E94560',
      card: '#16213E',
      buttonPrimary: '#E94560',
      buttonPrimaryText: '#FFFFFF'
    },
    hasBorder: false
  },
  nature: {
    id: 'nature',
    name: 'Natural Spa',
    description: 'Calming earth tones',
    colors: {
      background: '#FAF8F5',
      backgroundSecondary: '#F5F0E8',
      text: '#2D3436',
      textSecondary: '#636E72',
      accent: '#6B8E23',
      border: '#E0D8CC',
      sidebar: '#FAF8F5',
      sidebarText: '#636E72',
      sidebarActive: '#6B8E23',
      card: '#FFFFFF',
      buttonPrimary: '#6B8E23',
      buttonPrimaryText: '#FFFFFF'
    },
    hasBorder: false
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Blue',
    description: 'Fresh coastal vibes',
    colors: {
      background: '#F8FFFE',
      backgroundSecondary: '#E8F4F8',
      text: '#1A365D',
      textSecondary: '#4A5568',
      accent: '#0077B6',
      border: '#BEE3F8',
      sidebar: '#F8FFFE',
      sidebarText: '#4A5568',
      sidebarActive: '#0077B6',
      card: '#FFFFFF',
      buttonPrimary: '#0077B6',
      buttonPrimaryText: '#FFFFFF'
    },
    hasBorder: false
  },
  rose: {
    id: 'rose',
    name: 'Rose Elegance',
    description: 'Soft feminine aesthetic',
    colors: {
      background: '#FFF9F9',
      backgroundSecondary: '#FFF0F3',
      text: '#4A3728',
      textSecondary: '#8B7355',
      accent: '#C77D8E',
      border: '#F5D5DC',
      sidebar: '#FFF9F9',
      sidebarText: '#8B7355',
      sidebarActive: '#C77D8E',
      card: '#FFFFFF',
      buttonPrimary: '#C77D8E',
      buttonPrimaryText: '#FFFFFF'
    },
    hasBorder: false
  },
  champagne: {
    id: 'champagne',
    name: 'Champagne',
    description: 'Warm neutrals, soft and elegant',
    colors: {
      background: '#FBF8F4',
      backgroundSecondary: '#F4EDE5',
      text: '#3E2F25',
      textSecondary: '#8A7364',
      accent: '#9A7B66',
      border: '#E8DDD2',
      sidebar: '#FBF8F4',
      sidebarText: '#8A7364',
      sidebarActive: '#5E4636',
      card: '#FFFFFF',
      buttonPrimary: '#9A7B66',
      buttonPrimaryText: '#FFFFFF'
    },
    hasBorder: false
  }
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('default');
  const theme = themes[currentTheme] || themes.default;

  // Function to set theme - called when tenant data loads
  const setTheme = (themeName) => {
    const validTheme = themes[themeName] ? themeName : 'default';
    setCurrentTheme(validTheme);
  };

  useEffect(() => {
    // Apply CSS variables for the current theme
    const root = document.documentElement;
    const colors = theme.colors;
    
    root.style.setProperty('--theme-background', colors.background);
    root.style.setProperty('--theme-background-secondary', colors.backgroundSecondary);
    root.style.setProperty('--theme-text', colors.text);
    root.style.setProperty('--theme-text-secondary', colors.textSecondary);
    root.style.setProperty('--theme-accent', colors.accent);
    root.style.setProperty('--theme-border', colors.border);
    root.style.setProperty('--theme-sidebar', colors.sidebar);
    root.style.setProperty('--theme-sidebar-text', colors.sidebarText);
    root.style.setProperty('--theme-sidebar-active', colors.sidebarActive);
    root.style.setProperty('--theme-card', colors.card);
    root.style.setProperty('--theme-button-primary', colors.buttonPrimary);
    root.style.setProperty('--theme-button-primary-text', colors.buttonPrimaryText);

    // Apply theme class to body only for non-default themes
    if (currentTheme !== 'default') {
      document.body.className = `theme-${currentTheme}`;
    } else {
      document.body.className = '';
    }
    
    // Set data attribute for border style
    if (theme.hasBorder) {
      document.body.setAttribute('data-theme-border', theme.borderStyle);
    } else {
      document.body.removeAttribute('data-theme-border');
    }
  }, [currentTheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
