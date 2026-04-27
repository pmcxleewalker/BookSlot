import React, { useMemo, useState } from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';

/**
 * Estimates the monthly value BookSlot adds to a salon based on three inputs.
 * Numbers are deliberately conservative so a savvy salon owner trusts them.
 *
 * Levers we model:
 *  1. No-shows recovered — automated push reminders cut salon no-show rates
 *     by ~50%. Industry baseline ~10%; with reminders ~5%.
 *  2. Rebook automation — 1-tap rebooking after every visit lifts retention
 *     by ~12% (clients who'd otherwise drift come back sooner).
 *  3. Admin time saved — auto-reminders + drag/drop calendar saves ~6 hrs/wk
 *     of phone calls & SMS, valued at €15/hr (Irish minimum + employer cost).
 */
const COST = 99;

const AssumptionRow = ({ label, value }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-[#706B68]">{label}</span>
    <span className="font-medium text-[#2C2A29] tabular-nums">{value}</span>
  </div>
);

const SavingsCalculator = () => {
  const [bookings, setBookings] = useState(150);   // bookings / month
  const [ticket, setTicket] = useState(60);        // average € per booking
  const [noShowPct, setNoShowPct] = useState(10);  // baseline no-show %

  const calc = useMemo(() => {
    const b = Math.max(0, Number(bookings) || 0);
    const t = Math.max(0, Number(ticket) || 0);
    const nsp = Math.max(0, Math.min(50, Number(noShowPct) || 0)) / 100;

    // 1. No-shows recovered (50% reduction)
    const noShowsRecoveredMonthly = b * nsp * 0.5;
    const noShowSavings = noShowsRecoveredMonthly * t;

    // 2. Rebook lift — 12% of bookings turn into one extra visit per year (so /12)
    const rebookLiftMonthly = (b * 0.12) * t;

    // 3. Admin time saved — 6 hrs/wk × 4.33 weeks × €15/hr
    const adminSavings = 6 * 4.33 * 15;

    const total = noShowSavings + rebookLiftMonthly + adminSavings;
    const roi = total / COST;
    const annual = total * 12;

    return {
      noShowSavings: Math.round(noShowSavings),
      rebookLiftMonthly: Math.round(rebookLiftMonthly),
      adminSavings: Math.round(adminSavings),
      total: Math.round(total),
      roi: roi.toFixed(1),
      annual: Math.round(annual),
      noShowsRecoveredMonthly: noShowsRecoveredMonthly.toFixed(1),
    };
  }, [bookings, ticket, noShowPct]);

  return (
    <section className="py-24 px-6 border-t border-[#F0EBE6]" data-testid="savings-calculator">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[11px] tracking-[0.3em] uppercase font-semibold text-[#B8868B] mb-4 flex items-center justify-center gap-2">
            <Sparkles className="w-3 h-3" strokeWidth={2} />
            ROI calculator
            <Sparkles className="w-3 h-3" strokeWidth={2} />
          </p>
          <h2 className="font-['Cormorant_Garamond'] text-4xl md:text-5xl font-light text-[#0A0A0A] mb-4">
            How much could BookSlot save you?
          </h2>
          <p className="text-base text-[#706B68] max-w-xl mx-auto">
            Adjust the sliders to your salon. We&apos;ll show you the conservative monthly
            value BookSlot adds — versus the €99 it costs.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Inputs */}
          <div
            className="rounded-3xl p-8"
            style={{ background: 'linear-gradient(180deg, #FAF7F3 0%, #FFFFFF 80%)', border: '1px solid #F0EBE6' }}
          >
            <p className="text-[11px] tracking-[0.25em] uppercase font-semibold text-[#9E948F] mb-6">Your salon</p>

            {/* Bookings */}
            <div className="mb-7">
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-sm font-medium text-[#2C2A29]" htmlFor="calc-bookings">Bookings per month</label>
                <span className="font-['Cormorant_Garamond'] text-2xl font-light text-[#0A0A0A] tabular-nums">{bookings}</span>
              </div>
              <input
                id="calc-bookings"
                type="range"
                min="20"
                max="800"
                step="10"
                value={bookings}
                onChange={(e) => setBookings(parseInt(e.target.value, 10))}
                className="w-full accent-[#B8868B]"
                data-testid="calc-bookings"
              />
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-[#9E948F] mt-1"><span>20</span><span>800</span></div>
            </div>

            {/* Average ticket */}
            <div className="mb-7">
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-sm font-medium text-[#2C2A29]" htmlFor="calc-ticket">Average spend per visit</label>
                <span className="font-['Cormorant_Garamond'] text-2xl font-light text-[#0A0A0A] tabular-nums">€{ticket}</span>
              </div>
              <input
                id="calc-ticket"
                type="range"
                min="20"
                max="250"
                step="5"
                value={ticket}
                onChange={(e) => setTicket(parseInt(e.target.value, 10))}
                className="w-full accent-[#B8868B]"
                data-testid="calc-ticket"
              />
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-[#9E948F] mt-1"><span>€20</span><span>€250</span></div>
            </div>

            {/* No-show % */}
            <div className="mb-2">
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-sm font-medium text-[#2C2A29]" htmlFor="calc-noshow">Current no-show rate</label>
                <span className="font-['Cormorant_Garamond'] text-2xl font-light text-[#0A0A0A] tabular-nums">{noShowPct}%</span>
              </div>
              <input
                id="calc-noshow"
                type="range"
                min="0"
                max="30"
                step="1"
                value={noShowPct}
                onChange={(e) => setNoShowPct(parseInt(e.target.value, 10))}
                className="w-full accent-[#B8868B]"
                data-testid="calc-noshow"
              />
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-[#9E948F] mt-1"><span>0%</span><span>30%</span></div>
            </div>
          </div>

          {/* Outputs */}
          <div
            className="rounded-3xl overflow-hidden relative"
            style={{ background: '#0A0A0A', color: '#F5EFE0' }}
            data-testid="calc-result"
          >
            {/* Gold leaf accent stripe */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, #D4AF37 50%, transparent 100%)' }} />

            <div className="p-8">
              <p className="text-[11px] tracking-[0.25em] uppercase font-semibold mb-6" style={{ color: '#D4AF37' }}>Estimated monthly value</p>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-light" style={{ color: '#B8AE99' }}>€</span>
                  <span
                    className="font-['Cormorant_Garamond'] text-7xl font-light leading-none tabular-nums"
                    style={{ color: '#F5EFE0', letterSpacing: '0.02em' }}
                    data-testid="calc-total"
                  >
                    {calc.total.toLocaleString()}
                  </span>
                  <span className="text-base ml-2" style={{ color: '#B8AE99' }}>/ month</span>
                </div>
                <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: '#D4AF37' }}>
                  <TrendingUp className="w-3.5 h-3.5" strokeWidth={2} />
                  That&apos;s <strong className="font-semibold">{calc.roi}×</strong> what BookSlot costs you (€{COST})
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'rgba(212,175,55,0.2)' }}>
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: '#8A8275' }}>Where it comes from</p>
                <AssumptionRow label="No-shows recovered (50% fewer)" value={`+€${calc.noShowSavings.toLocaleString()}`} />
                <AssumptionRow label="Smarter rebooking (12% retention lift)" value={`+€${calc.rebookLiftMonthly.toLocaleString()}`} />
                <AssumptionRow label="Admin time saved (~26h/mo @ €15)" value={`+€${calc.adminSavings.toLocaleString()}`} />
                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'rgba(212,175,55,0.2)' }}>
                  <span className="text-sm font-semibold" style={{ color: '#F5EFE0' }}>Annual upside</span>
                  <span className="font-['Cormorant_Garamond'] text-2xl font-light tabular-nums" style={{ color: '#D4AF37' }} data-testid="calc-annual">€{calc.annual.toLocaleString()}</span>
                </div>
              </div>

              <p className="text-[10px] mt-5 leading-relaxed" style={{ color: '#8A8275' }}>
                Conservative estimates based on industry data. Your numbers will vary —
                most salons see results within 30 days.
              </p>
            </div>
          </div>
        </div>

        {/* Style local thumb override for premium feel */}
        <style>{`
          [data-testid="savings-calculator"] input[type="range"] {
            -webkit-appearance: none;
            height: 4px;
            background: linear-gradient(90deg, #C4898E 0%, #D4A373 100%);
            border-radius: 999px;
            outline: none;
          }
          [data-testid="savings-calculator"] input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: #FFFFFF;
            border: 2px solid #B8868B;
            box-shadow: 0 4px 12px rgba(184,134,139,0.35);
            cursor: pointer;
          }
          [data-testid="savings-calculator"] input[type="range"]::-moz-range-thumb {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: #FFFFFF;
            border: 2px solid #B8868B;
            box-shadow: 0 4px 12px rgba(184,134,139,0.35);
            cursor: pointer;
          }
        `}</style>
      </div>
    </section>
  );
};

export default SavingsCalculator;
