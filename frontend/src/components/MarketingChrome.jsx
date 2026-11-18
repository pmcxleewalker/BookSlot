import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features', internal: true },
  { href: '/#ai-receptionist', label: 'AI receptionist' },
  { href: '/#faq', label: 'FAQ' },
];

export const MarketingNav = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="glass fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-baseline gap-2" data-testid="logo">
          <span className="text-xl font-semibold text-[#0A0A0A]">BookSlot</span>
          <span className="hidden sm:inline text-xs text-[#666666]">by QF Digital</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((l) =>
            l.internal ? (
              <Link key={l.label} to={l.href} className="text-sm text-[#666666] hover:text-[#0A0A0A] transition-colors">
                {l.label}
              </Link>
            ) : (
              <a key={l.label} href={l.href} className="text-sm text-[#666666] hover:text-[#0A0A0A] transition-colors">
                {l.label}
              </a>
            )
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-sm text-[#666666] hover:text-[#0A0A0A] px-3 py-2" data-testid="login-btn">
            Log in
          </Link>
          <a href="/#demo" className="btn-primary text-sm" data-testid="nav-demo-btn">
            Book a demo
          </a>
        </div>

        <button
          className="md:hidden p-2 -mr-2 focus-ring"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-black/5 bg-white px-6 py-4 space-y-1">
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="block py-2 text-[#0A0A0A]">
              {l.label}
            </a>
          ))}
          <a href="/login" className="block py-2 text-[#666666]">Log in</a>
          <a href="/#demo" onClick={() => setOpen(false)} className="btn-primary block text-center mt-3">
            Book a demo
          </a>
        </div>
      )}
    </nav>
  );
};

export const MarketingFooter = () => (
  <footer className="py-12 px-6 border-t border-[#E5E5E5]">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
      <div>
        <div className="text-xl font-semibold text-[#0A0A0A]">BookSlot</div>
        <p className="text-sm text-[#666666] mt-1">Booking software for service businesses. Built in Ireland by QF Digital.</p>
      </div>
      <div className="flex flex-wrap items-center gap-6 text-sm text-[#666666]">
        <a href="/#how-it-works" className="hover:text-[#0A0A0A] transition-colors">How it works</a>
        <Link to="/features" className="hover:text-[#0A0A0A] transition-colors">Features</Link>
        <a href="/#demo" className="hover:text-[#0A0A0A] transition-colors">Book a demo</a>
        <Link to="/login" className="hover:text-[#0A0A0A] transition-colors">Log in</Link>
      </div>
      <p className="text-sm text-[#666666]">© {new Date().getFullYear()} QuickFleet Limited</p>
    </div>
  </footer>
);
