import React, { useState } from 'react';
import BrandLogo from '../../components/BrandLogo';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Calendar, Users, Bot, Shield, Bell, Smartphone, MessageCircle,
  CheckCircle2, Link2, Sparkles, FileText, BarChart3, Palette, Lock, Scissors, Heart, Stethoscope,
  Dumbbell, Wrench, PawPrint, GraduationCap, Mail, EyeOff, Percent, Calculator,
} from 'lucide-react';
import { Button } from '../../components/ui/button';

// Where "Book a demo" goes. Change to a form or calendar link later if you like.
export const CONTACT_EMAIL = 'qfdigitalmedia@gmail.com';
export const DEMO_LINK = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('BookSlot demo')}`;
export const LIVE_DEMO = '/book/demo-physio';
export const LIVE_DEMO_SALON = '/book/demo';
export const QF_DIGITAL = 'https://qf-digital.netlify.app';

const WHY = [
  { icon: Percent, stat: '0%', label: 'commission, ever',
    title: 'Your brand, not a marketplace',
    desc: 'Marketplaces take a cut of new clients: 35% + VAT of the first booking on Treatwell, 20% on Fresha. BookSlot takes nothing, and your clients only ever see your business.' },
  { icon: Bot, stat: 'Included', label: 'AI receptionist',
    title: 'The receptionist comes with it',
    desc: 'Fresha charges €94.95 a month extra for its AI. BookSlot\'s AI receptionist answers clients day and night and books real free slots, as part of our main plan.' },
  { icon: Sparkles, stat: '1 day', label: 'to go live',
    title: 'We set it up for you',
    desc: 'Other tools hand you a login and a help centre. We load your services, team, hours and client list, so you\'re taking bookings tomorrow.' },
];

const NoShowCalculator = () => {
  const [bookings, setBookings] = useState(200);
  const [price, setPrice] = useState(50);
  const b = Math.max(0, Number(bookings) || 0);
  const p = Math.max(0, Number(price) || 0);
  const saved = Math.round(b * 0.06 * p);
  return (
    <div className="bg-white border border-[#E5E5E5] p-8 md:p-10 grid md:grid-cols-2 gap-10 items-center">
      <div className="space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-[#0A0A0A]">Appointments a month</span>
          <input type="number" min="0" inputMode="numeric" value={bookings} onChange={(e) => setBookings(e.target.value)}
            className="mt-2 w-full h-12 px-4 border border-[#E5E5E5] rounded-md text-lg focus:outline-none focus:border-[#3730A3]" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#0A0A0A]">Average price (€)</span>
          <input type="number" min="0" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)}
            className="mt-2 w-full h-12 px-4 border border-[#E5E5E5] rounded-md text-lg focus:outline-none focus:border-[#3730A3]" />
        </label>
      </div>
      <div className="text-center md:text-left">
        <p className="text-sm font-medium tracking-widest text-[#3730A3] mb-2">MONEY BACK EACH MONTH</p>
        <p className="heading-marketing text-6xl md:text-7xl text-[#0A0A0A]" data-testid="calc-result">€{saved.toLocaleString('en-IE')}</p>
        <p className="text-[#666666] mt-3">
          from fewer missed appointments, about {Math.round(b * 0.06)} more clients turning up each month.
        </p>
      </div>
    </div>
  );
};

const STEPS = [
  { n: '01', title: 'We set you up', desc: 'Your services, prices, team and opening hours, ready in a day, under your own name, logo and colours.' },
  { n: '02', title: 'Clients book themselves', desc: 'From your booking link, Instagram bio, Google profile, by text or WhatsApp, at any hour, with no app to download.' },
  { n: '03', title: 'Everything else is automatic', desc: 'Confirmations, reminders, cancellations and rebookings are handled. Your diary is always up to date on your phone.' },
];

const FEATURES = [
  { icon: Link2, title: 'Your own booking page', desc: 'A clean, branded page where clients pick a service, a team member and a free time in a few taps.' },
  { icon: Bot, title: 'AI receptionist, 24/7', desc: 'Answers questions and books, moves or cancels appointments on your website chat, by SMS and on WhatsApp.' },
  { icon: Bell, title: 'Automatic reminders', desc: 'Confirmations and reminders by email and text, with wording you control.' },
  { icon: Smartphone, title: 'Runs on your phone', desc: 'See today at a glance and add a phone booking in seconds. Save it to your home screen like an app.' },
  { icon: Calendar, title: 'A diary that can\'t clash', desc: 'Working hours, breaks and holidays are built in. Drag to move a booking; clashes are blocked.' },
  { icon: Users, title: 'Client records', desc: 'Visit history, spend, notes and contact details for every client, built up automatically.' },
  { icon: Shield, title: 'Booking rules you set', desc: 'Minimum notice, how far ahead clients can book, cancellation cut-offs and approval for long appointments.' },
  { icon: FileText, title: 'Intake forms', desc: 'Collect what you need before the appointment: allergies, medical history, job details or consultation notes.' },
  { icon: BarChart3, title: 'Reports & exports', desc: 'Bookings, revenue, no-shows, busiest times and top services, ready to export for your accountant.' },
  { icon: Users, title: 'Team logins', desc: 'Each team member gets their own login and only sees what you allow.' },
  { icon: Palette, title: 'White-label', desc: 'Your logo, colours and name on the booking page and in every message. BookSlot stays in the background.' },
  { icon: Lock, title: 'Secure & EU-hosted', desc: 'Data stored in the EU, encrypted connections and GDPR-minded from day one.' },
];

const INDUSTRIES = [
  { icon: Scissors, name: 'Hair salons & barbers' },
  { icon: Sparkles, name: 'Beauty, nails & brows' },
  { icon: Heart, name: 'Massage & wellness' },
  { icon: Stethoscope, name: 'Clinics, physio & therapists' },
  { icon: Dumbbell, name: 'Personal trainers & studios' },
  { icon: Wrench, name: 'Trades & home services' },
  { icon: PawPrint, name: 'Pet grooming & vets' },
  { icon: GraduationCap, name: 'Tutors, coaches & consultants' },
];

const WHITE_LABEL = [
  { icon: Palette, title: 'Your name, logo and colours', desc: 'Clients see your business on the booking page, not ours.' },
  { icon: Mail, title: 'Messages from you', desc: 'Confirmations and reminders arrive in your business name, with your logo and contact details.' },
  { icon: Smartphone, title: 'Feels like your own app', desc: 'Clients save your booking page to their home screen and rebook in a couple of taps.' },
  { icon: EyeOff, title: 'Hide BookSlot completely', desc: 'Remove the "Powered by BookSlot" line so the whole experience is yours.' },
];

const FAQS = [
  { q: 'Is it only for hair and beauty?', a: 'No. BookSlot works for any business that books appointments or time slots: clinics, physios, trainers, trades, groomers, tutors, consultants and more. You set your own services, durations and prices.' },
  { q: 'Will my clients see BookSlot or my business?', a: 'Your business. The booking page and every message carry your name, logo and colours, and you can remove the "Powered by BookSlot" line entirely.' },
  { q: 'What does it cost?', a: 'It depends on the size of your team, and there is never any commission on your bookings. We go through it on the demo so there are no surprises.' },
  { q: 'Do my clients need to download anything?', a: 'No. They book from a link, a text message or WhatsApp, on whatever phone or computer they already have.' },
  { q: 'Can I still take bookings over the phone?', a: 'Of course. Open BookSlot on your phone, tap +, pick the service and a free time, and it\'s booked in about 30 seconds, with the reminder sent for you.' },
  { q: 'What if the AI receptionist can\'t answer something?', a: 'It only books times that are genuinely free and never makes up prices or policies. For anything it can\'t handle, it gives the client your contact details.' },
  { q: 'How long does it take to get started?', a: 'Usually a day. We set up your services, hours and booking page with you, so there\'s nothing technical for you to do.' },
  { q: 'Where is my data kept?', a: 'On secure servers in the EU. Your client data belongs to you and is never sold or shared.' },
];

const Phone = () => (
  <div className="relative mx-auto w-[290px] sm:w-[320px]" aria-hidden="true">
    <div className="rounded-[2.5rem] bg-[#0A0A0A] p-3 shadow-2xl">
      <div className="rounded-[2rem] bg-[#F4F1EC] overflow-hidden">
        <div className="bg-[#0A0A0A] text-white px-5 pt-6 pb-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#3730A3] flex items-center justify-center text-sm font-semibold">H</div>
          <div>
            <p className="text-sm font-semibold leading-tight">Harbour Physio</p>
            <p className="text-[11px] text-white/60 leading-tight">replies instantly</p>
          </div>
        </div>
        <div className="px-4 py-5 space-y-3 text-[13px] leading-snug">
          <p className="ml-auto max-w-[80%] bg-[#DCF8C6] text-[#0A0A0A] px-3 py-2 rounded-2xl rounded-br-sm">Hi! Any chance of a sports massage Saturday? 🙏</p>
          <p className="max-w-[85%] bg-white text-[#0A0A0A] px-3 py-2 rounded-2xl rounded-bl-sm shadow-sm">Hi Aoife! Saturday I have 10:00, 11:30 or 14:15 free. Which suits you?</p>
          <p className="ml-auto max-w-[80%] bg-[#DCF8C6] text-[#0A0A0A] px-3 py-2 rounded-2xl rounded-br-sm">11:30 please</p>
          <div className="max-w-[88%] bg-white px-3 py-2.5 rounded-2xl rounded-bl-sm shadow-sm">
            <p className="text-[#0A0A0A]">You're booked ✨</p>
            <div className="mt-2 border-t border-[#EEE] pt-2 text-[12px] text-[#555] space-y-0.5">
              <p><span className="font-semibold text-[#0A0A0A]">Sports massage</span></p>
              <p>Sat 11:30 – 12:30</p>
              <p>Reminder the day before</p>
            </div>
          </div>
          <p className="text-center text-[11px] text-[#888] pt-1">Booked at 23:47 while you were off the clock</p>
        </div>
      </div>
    </div>
    <div className="hidden sm:flex absolute -left-24 -bottom-6 bg-white border border-[#E5E5E5] shadow-lg px-4 py-3 items-center gap-3 rounded-xl">
      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      <div className="text-xs">
        <p className="font-semibold text-[#0A0A0A]">New booking</p>
        <p className="text-[#666]">Added to your diary</p>
      </div>
    </div>
  </div>
);

export const MarketingNav = () => (
  <nav className="glass fixed top-0 left-0 right-0 z-50">
    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <Link to="/" aria-label="BookSlot home" data-testid="logo"><BrandLogo size={32} /></Link>
      <div className="hidden md:flex items-center gap-8">
        <a href="/#why" className="text-sm text-[#666666] hover:text-[#0A0A0A] transition-colors">Why BookSlot</a>
        <a href="/#how" className="text-sm text-[#666666] hover:text-[#0A0A0A] transition-colors">How it works</a>
        <Link to="/features" className="text-sm text-[#666666] hover:text-[#0A0A0A] transition-colors" data-testid="nav-features">Features</Link>
        <a href="/#faq" className="text-sm text-[#666666] hover:text-[#0A0A0A] transition-colors">FAQ</a>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <Link to="/login"><Button variant="ghost" className="text-sm" data-testid="login-btn">Log in</Button></Link>
        <a href={DEMO_LINK}><Button className="bg-[#3730A3] hover:bg-[#312E81] text-white rounded-md text-sm" data-testid="demo-btn">Book a demo</Button></a>
      </div>
    </div>
  </nav>
);

export const MarketingFooter = () => (
  <footer className="py-12 px-6 border-t border-[#E5E5E5]">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
      <BrandLogo size={28} textClassName="text-lg" />
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#666666]">
        <a href="/#how" className="hover:text-[#0A0A0A]">How it works</a>
        <Link to="/features" className="hover:text-[#0A0A0A]">Features</Link>
        <a href="/#faq" className="hover:text-[#0A0A0A]">FAQ</a>
        <a href={LIVE_DEMO} className="hover:text-[#0A0A0A]">Live demo</a>
        <a href={DEMO_LINK} className="hover:text-[#0A0A0A]">Contact</a>
        <Link to="/login" className="hover:text-[#0A0A0A]">Log in</Link>
      </div>
      <p className="text-sm text-[#666666] text-center md:text-right">
        © {new Date().getFullYear()} BookSlot · Built by{' '}
        <a href={QF_DIGITAL} target="_blank" rel="noopener noreferrer" className="font-medium text-[#0A0A0A] hover:underline">QF Digital</a>
      </p>
    </div>
  </footer>
);

const LandingPage = () => (
  <div className="min-h-screen bg-white">
    <MarketingNav />

    {/* Hero */}
    <section className="pt-28 md:pt-36 pb-20 px-6 noise-overlay overflow-hidden">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAFAFA] border border-[#E5E5E5] rounded-full mb-8">
            <Bot className="w-4 h-4 text-[#3730A3]" />
            <span className="text-sm text-[#666666]">No commission · No marketplace · Set up for you</span>
          </div>
          <h1 className="heading-marketing text-5xl md:text-6xl lg:text-7xl text-[#0A0A0A] mb-6 leading-[1.05]" data-testid="hero-title">
            Your own booking app. Answers clients 24/7. Set up for you.
          </h1>
          <p className="text-lg md:text-xl text-[#666666] mb-10 max-w-xl">
            Clients book online, by text or on WhatsApp, under your name, not ours. No commission, no marketplace,
            no setup headaches. For any business that takes appointments.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href={DEMO_LINK}>
              <Button className="bg-[#3730A3] hover:bg-[#312E81] text-white rounded-md px-8 py-4 text-base flex items-center gap-2 w-full sm:w-auto justify-center" data-testid="cta-primary">
                Book a demo <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
            <a href={LIVE_DEMO}>
              <Button variant="outline" className="btn-secondary px-8 py-4 text-base w-full sm:w-auto" data-testid="cta-secondary">
                Try a live booking
              </Button>
            </a>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#666666]">
            {['0% commission', 'AI receptionist included', 'We set it up', 'No app for clients'].map((t) => (
              <span key={t} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0A0A0A]" />{t}</span>
            ))}
          </div>
        </div>
        <Phone />
      </div>
    </section>

    {/* Why BookSlot */}
    <section id="why" className="py-24 px-6 bg-[#FAFAFA] border-y border-[#E5E5E5] scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mb-14">
          <p className="text-sm font-medium tracking-widest text-[#3730A3] mb-3">WHY BOOKSLOT</p>
          <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A]">Everything the big booking apps do. None of the catches.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {WHY.map(({ icon: Icon, stat, label, title, desc }) => (
            <div key={title} className="bg-white border border-[#E5E5E5] p-8 flex flex-col">
              <div className="flex items-baseline gap-3 mb-6">
                <span className="heading-marketing text-5xl text-[#3730A3]">{stat}</span>
                <span className="text-sm text-[#666666]">{label}</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-5 h-5 text-[#0A0A0A]" />
                <h3 className="text-lg font-semibold text-[#0A0A0A]">{title}</h3>
              </div>
              <p className="text-[#666666]">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#999999] mt-6">Competitor fees as published on their websites, November 2026.</p>
      </div>
    </section>

    {/* No-show calculator */}
    <section id="savings" className="py-24 px-6 scroll-mt-16">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-medium tracking-widest text-[#3730A3] mb-3 flex items-center gap-2"><Calculator className="w-4 h-4" />IS IT WORTH IT?</p>
          <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-4">Reminders pay for themselves.</h2>
          <p className="text-lg text-[#666666]">
            Across 21 studies, people who got reminders missed 15% of appointments, against 21% without.
            See what that gap is worth to you.
          </p>
        </div>
        <NoShowCalculator />
        <p className="text-xs text-[#999999] mt-4">Estimate: appointments × 6% × average price. Your results will vary.</p>
      </div>
    </section>

    {/* How it works */}
    <section id="how" className="py-24 px-6 scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-medium tracking-widest text-[#3730A3] mb-3">HOW IT WORKS</p>
          <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-4">Bookings on autopilot, in three steps</h2>
          <p className="text-lg text-[#666666]">You stay in charge of your diary. BookSlot does the admin.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-px bg-[#E5E5E5] border border-[#E5E5E5]">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-white p-10">
              <p className="font-mono text-sm text-[#3730A3] mb-6">{s.n}</p>
              <h3 className="text-xl font-semibold text-[#0A0A0A] mb-3">{s.title}</h3>
              <p className="text-[#666666]">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* White-label */}
    <section className="pb-24 px-6">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center">
        <div>
          <p className="text-sm font-medium tracking-widest text-[#3730A3] mb-3">WHITE-LABEL</p>
          <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-4">Your booking app, not ours.</h2>
          <p className="text-lg text-[#666666]">
            BookSlot runs quietly in the background. To your clients, it's simply how your business takes bookings,
            with your branding from the first tap to the reminder email.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {WHITE_LABEL.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="border border-[#E5E5E5] p-6">
              <Icon className="w-6 h-6 text-[#3730A3] mb-4" />
              <h3 className="font-semibold text-[#0A0A0A] mb-2">{title}</h3>
              <p className="text-sm text-[#666666]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* AI band */}
    <section className="px-6">
      <div className="max-w-7xl mx-auto bg-[#0A0A0A] text-white p-10 md:p-16 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 bg-[#3730A3] rounded-full flex items-center justify-center"><MessageCircle className="w-5 h-5" /></div>
            <span className="text-sm font-medium tracking-widest text-white/70">AI RECEPTIONIST</span>
          </div>
          <h2 className="heading-marketing text-3xl md:text-5xl mb-5">A receptionist that never takes a day off.</h2>
          <p className="text-white/70 text-lg">
            Clients message your number like they always have. BookSlot's assistant answers in seconds, knows your
            services, prices and real availability, and books them straight into your diary. If they need to move or
            cancel, they just text back.
          </p>
        </div>
        <ul className="space-y-4">
          {[
            'Answers questions about services, prices and opening hours',
            'Only ever offers times that are genuinely free',
            'Books, moves and cancels appointments by text or WhatsApp',
            'Recognises returning clients by their number',
            'Hands over to you for anything it can\'t help with',
          ].map((t) => (
            <li key={t} className="flex gap-3 items-start border-b border-white/10 pb-4">
              <CheckCircle2 className="w-5 h-5 text-[#3730A3] shrink-0 mt-0.5" /><span className="text-white/90">{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>

    {/* Features */}
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-medium tracking-widest text-[#3730A3] mb-3">EVERYTHING IN ONE PLACE</p>
          <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-4">Built for the way you actually work</h2>
          <p className="text-lg text-[#666666]">Powerful underneath, simple on the surface.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card-hover">
              <div className="w-12 h-12 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-[#0A0A0A]" />
              </div>
              <h3 className="text-lg font-semibold text-[#0A0A0A] mb-2">{title}</h3>
              <p className="text-[#666666]">{desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Link to="/features" className="inline-flex items-center gap-2 text-[#0A0A0A] font-medium hover:gap-3 transition-all">
            Explore all features <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>

    {/* Industries */}
    <section className="py-20 px-6 bg-[#FAFAFA] border-y border-[#E5E5E5]">
      <div className="max-w-7xl mx-auto">
        <p className="text-center text-sm font-medium tracking-widest text-[#666666] mb-10">FOR ANY BUSINESS THAT TAKES APPOINTMENTS</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {INDUSTRIES.map(({ icon: Icon, name }) => (
            <div key={name} className="bg-white border border-[#E5E5E5] p-6 flex flex-col items-center text-center gap-3">
              <Icon className="w-7 h-7 text-[#3730A3]" />
              <span className="font-semibold text-[#0A0A0A]">{name}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-[#666666] mt-8">Don't see yours? If clients book a time with you, BookSlot fits.</p>
      </div>
    </section>

    {/* FAQ */}
    <section id="faq" className="py-24 px-6 scroll-mt-16">
      <div className="max-w-3xl mx-auto">
        <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-12 text-center">Questions, answered</h2>
        <div className="divide-y divide-[#E5E5E5] border-y border-[#E5E5E5]">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group py-6">
              <summary className="flex justify-between items-center cursor-pointer list-none text-lg font-medium text-[#0A0A0A]">
                {q}<span className="ml-4 text-[#999] group-open:rotate-45 transition-transform text-2xl leading-none">+</span>
              </summary>
              <p className="mt-4 text-[#666666]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>

    {/* Final CTA */}
    <section id="contact" className="py-24 px-6 bg-[#0A0A0A] text-white">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="heading-marketing text-4xl md:text-5xl mb-6">See it working with your own services.</h2>
        <p className="text-lg text-white/70 mb-10">
          We'll set up a demo with your services and hours, so you can see exactly how your clients would book and how
          your day would look.
        </p>
        <a href={DEMO_LINK}>
          <Button className="bg-[#3730A3] hover:bg-[#312E81] text-white rounded-md px-10 py-4 text-base inline-flex items-center gap-2" data-testid="final-cta">
            Book a demo <ArrowRight className="w-4 h-4" />
          </Button>
        </a>
        <p className="text-sm text-white/50 mt-6">
          Or try a live booking at our demo <a href={LIVE_DEMO} className="underline text-white/80">physio clinic</a> or <a href={LIVE_DEMO_SALON} className="underline text-white/80">salon</a> · email {CONTACT_EMAIL}
        </p>
      </div>
    </section>

    <MarketingFooter />
  </div>
);

export default LandingPage;
