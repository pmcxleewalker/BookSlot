import React from 'react';
import { useTheme } from '../context/ThemeContext';

const EliteBorder = () => {
  const { currentTheme } = useTheme();
  
  if (currentTheme !== 'elite') return null;

  return (
    <>
      {/* Left Border */}
      <div className="fixed left-0 top-0 bottom-0 w-6 z-[9999] pointer-events-none overflow-hidden">
        {/* Gold wavy vertical lines */}
        <svg 
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 24 1000"
        >
          <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.9">
                <animate attributeName="stopOpacity" values="0.9;0.6;0.9" dur="4s" repeatCount="indefinite" />
              </stop>
              <stop offset="50%" stopColor="#B8860B" stopOpacity="0.7">
                <animate attributeName="stopOpacity" values="0.7;0.9;0.7" dur="4s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.9">
                <animate attributeName="stopOpacity" values="0.9;0.6;0.9" dur="4s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
            <linearGradient id="goldGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#B8860B" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          
          {/* Main gold line with subtle wave */}
          <path 
            d="M4 0 Q6 50 4 100 Q2 150 4 200 Q6 250 4 300 Q2 350 4 400 Q6 450 4 500 Q2 550 4 600 Q6 650 4 700 Q2 750 4 800 Q6 850 4 900 Q2 950 4 1000" 
            stroke="url(#goldGradient)" 
            strokeWidth="2" 
            fill="none"
          />
          
          {/* Secondary decorative line */}
          <path 
            d="M10 0 Q8 60 10 120 Q12 180 10 240 Q8 300 10 360 Q12 420 10 480 Q8 540 10 600 Q12 660 10 720 Q8 780 10 840 Q12 900 10 960 L10 1000" 
            stroke="url(#goldGradient2)" 
            strokeWidth="1.5" 
            fill="none"
          />
          
          {/* Thin accent line */}
          <path 
            d="M16 0 Q18 80 16 160 Q14 240 16 320 Q18 400 16 480 Q14 560 16 640 Q18 720 16 800 Q14 880 16 960 L16 1000" 
            stroke="url(#goldGradient2)" 
            strokeWidth="0.75" 
            fill="none"
            opacity="0.4"
          />
        </svg>
        
        {/* Gradient fade */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, rgba(10,10,10,0) 0%, rgba(10,10,10,1) 100%)'
          }}
        />
      </div>

      {/* Right Border */}
      <div className="fixed right-0 top-0 bottom-0 w-6 z-[9999] pointer-events-none overflow-hidden">
        <svg 
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 24 1000"
        >
          {/* Main gold line with subtle wave - mirrored */}
          <path 
            d="M20 0 Q18 50 20 100 Q22 150 20 200 Q18 250 20 300 Q22 350 20 400 Q18 450 20 500 Q22 550 20 600 Q18 650 20 700 Q22 750 20 800 Q18 850 20 900 Q22 950 20 1000" 
            stroke="url(#goldGradient)" 
            strokeWidth="2" 
            fill="none"
          />
          
          {/* Secondary decorative line - mirrored */}
          <path 
            d="M14 0 Q16 60 14 120 Q12 180 14 240 Q16 300 14 360 Q12 420 14 480 Q16 540 14 600 Q12 660 14 720 Q16 780 14 840 Q12 900 14 960 L14 1000" 
            stroke="url(#goldGradient2)" 
            strokeWidth="1.5" 
            fill="none"
          />
          
          {/* Thin accent line - mirrored */}
          <path 
            d="M8 0 Q6 80 8 160 Q10 240 8 320 Q6 400 8 480 Q10 560 8 640 Q6 720 8 800 Q10 880 8 960 L8 1000" 
            stroke="url(#goldGradient2)" 
            strokeWidth="0.75" 
            fill="none"
            opacity="0.4"
          />
        </svg>
        
        {/* Gradient fade */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(-90deg, rgba(10,10,10,0) 0%, rgba(10,10,10,1) 100%)'
          }}
        />
      </div>
    </>
  );
};

export default EliteBorder;
