import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowRight, Calendar, Users, Bot, Mail, RefreshCw, Link2, BarChart3, Palette,
  PhoneOff, CalendarX, LayoutGrid, Scissors, Sparkles, Stethoscope, Wrench, Dumbbell, Briefcase,
  CheckCircle2, Loader2,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../components/ui/accordion';
import { MarketingNav, MarketingFooter } from '../../components/MarketingChrome';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const problems = [
  { icon: PhoneOff, title: 'Stop stopping for the phone', desc: 'Clients book themselves online, day or night. No more answering calls with your hands full.' },
  { icon: CalendarX, title: 'Fewer no-shows', desc: 'Every booking gets an email confirmation and a reminder before the appointment, automatically.' },
  { icon: LayoutGrid, title: 'One diary for everyone', desc: 'Every staff member, service and appointment in one calendar you can open on any phone or laptop.' },
];

const steps = [
  { n: '01', title: 'We set it up with you', desc: 'Your services, prices, staff and opening hours go in on a short call. You don’t have to touch a settings page.' },
  { n: '02', title: 'Share your booking link', desc: 'Add it to Instagram, Facebook, Google and your website. It carries your logo and colours.' },
  { n: '03', title: 'Bookings come to you', desc: 'Clients pick a time that’s actually available. You get notified, they get confirmed and reminded.' },
];

const features = [
  { icon: Link2, title: 'Your own booking page', desc: 'A branded page clients can book from 24/7. No app to download.' },
  { icon: Mail, title: 'Email confirmations & reminders', desc: 'Sent automatically, timed to suit your business.' },
  { icon: RefreshCw, title: 'Self-serve cancellations', desc: 'Clients cancel from the link in their email, so the slot opens up for someone else.' },
  { icon: Calendar, title: 'Drag-and-drop calendar', desc: 'Move appointments in a click. Double-bookings are blocked.' },
  { icon: Users, title: 'Staff & working hours', desc: 'Set who does what and when. Breaks and days off included.' },
  { icon: Bot, title: 'AI receptionist', desc: 'Answers questions and books appointments in a chat on your booking page.' },
  { icon: BarChart3, title: 'Reports', desc: 'Bookings, revenue and busiest times. Export to CSV or PDF.' },
  { icon: Palette, title: 'Client records', desc: 'Visit history, notes and VIP flags for every client.' },
];

const industries = [
  { icon: Scissors, name: 'Hair salons & barbers' },
  { icon: Sparkles, name: 'Beauty & nails' },
  { icon: Stethoscope, name: 'Clinics & physio' },
  { icon: Dumbbell, name: 'Personal trainers' },
  { icon: Wrench, name: 'Trades & call-outs' },
  { icon: Briefcase, name: 'Consultants' },
];

const faqs = [
  { q: 'Do my clients need to download an app?', a: 'No. They book from a normal web page on their phone or computer, using the link you share.' },
  { q: 'I use a paper diary. Is this going to be complicated?', a: 'We set it up with you, including your services, staff and hours. Day to day, it’s just a calendar.' },
  { q: 'How do reminders work?', a: 'Clients get an email confirmation when they book and an email reminder before the appointment (24 hours by default). You can change the timing.' },
  { q: 'What does the AI receptionist actually do?', a: 'It sits in a chat on your booking page. It can answer questions about your services and opening hours, check availability and make a booking.' },
  { q: 'What does it cost?', a: 'It depends on the size of your team. We’ll go through it on the demo, so there are no surprises.' },
  { q: 'Can I move my existing clients over?', a: 'Yes. We can bring in your client list during setup.' },
];

const HeroPreview = () => {
  const rows = [
    { time: '09:00', name: 'Aoife M.', svc: 'Cut & blow-dry', who: 'Sarah', tone: 'bg-[#121212] text-white' },
    { time: '10:30', name: 'Ciara D.', svc: 'Full colour', who: 'Sarah', tone: 'bg-[#FAFAFA]' },
    { time: '11:00', name: 'Niamh O.', svc: 'Gel nails', who: 'Emma', tone: 'bg-[#FAFAFA]' },
    { time: '13:15', name: 'Online booking', svc: 'Trim', who: 'Emma', tone: 'bg-[#E34A33]/10 border-[#E34A33]/40', isNew: true },
  ];
  return (
    <div className="card-flat p-0 shadow-[0_24px_60px_rgba(0,0,0,0.08)]" aria-label="Example of the BookSlot calendar">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
        <div>
          <p className="text-xs uppercase tracking-wider text-[#666666]">Today</p>
          <p className="font-semibold text-[#0A0A0A]">Thursday</p>
        </div>
        <span className="text-xs px-2 py-1 border border-[#E5E5E5] text-[#666666]">Example</span>
      </div>
      <div className="p-4 space-y-2">
        {rows.map((r) => (
          <div key={r.time} className={`flex items-center gap-4 px-4 py-3 border border-[#E5E5E5] ${r.tone}`}>
            <span className="font-mono text-sm w-12">{r.time}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{r.name}</p>
              <p className={`text-xs truncate ${r.tone.includes('text-white') ? 'text-white/70' : 'text-[#666666]'}`}>{r.svc} · {r.who}</p>
            </div>
            {r.isNew && <span className="text-[10px] font-semibold uppercase tracking-wider text-[#E34A33]">New</span>}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-5 py-3 border-t border-[#E5E5E5] text-xs text-[#666666]">
        <Mail className="w-3.5 h-3.5" /> Reminder emails go out automatically
      </div>
    </div>
  );
};

const DemoForm = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', business_name: '', business_type: '', message: '', website: '' });
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      await axios.post(`${API}/public/demo-request`, form, { withCredentials: false });
      setState('sent');
    } catch (err) {
      setState('error');
      setError(err.response?.data?.detail && typeof err.response.data.detail === 'string'
        ? err.response.data.detail
        : 'Something went wrong. Please check your details and try again.');
    }
  };

  if (state === 'sent') {
    return (
      <div className="card-flat text-center py-16" data-testid="demo-success">
        <CheckCircle2 className="w-10 h-10 text-[#0A0A0A] mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-[#0A0A0A] mb-2">Thanks, {form.name.split(' ')[0]}!</h3>
        <p className="text-[#666666]">We'll be in touch shortly to arrange a time that suits you.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card-flat space-y-4" data-testid="demo-form">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-[#0A0A0A]">Your name</span>
          <Input required value={form.name} onChange={set('name')} className="mt-1" autoComplete="name" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#0A0A0A]">Business name</span>
          <Input required value={form.business_name} onChange={set('business_name')} className="mt-1" autoComplete="organization" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#0A0A0A]">Email</span>
          <Input required type="email" value={form.email} onChange={set('email')} className="mt-1" autoComplete="email" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#0A0A0A]">Phone <span className="text-[#666666] font-normal">(optional)</span></span>
          <Input type="tel" value={form.phone} onChange={set('phone')} className="mt-1" autoComplete="tel" />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-[#0A0A0A]">Type of business</span>
        <select
          value={form.business_type}
          onChange={set('business_type')}
          className="mt-1 w-full h-10 px-3 border border-[#E5E5E5] bg-white text-sm focus-ring rounded-md"
        >
          <option value="">Choose one</option>
          {industries.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
          <option value="Other">Other</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-[#0A0A0A]">Anything we should know? <span className="text-[#666666] font-normal">(optional)</span></span>
        <Textarea value={form.message} onChange={set('message')} className="mt-1" rows={3} placeholder="E.g. how you take bookings now, how many staff you have" />
      </label>
      {/* Honeypot: hidden from people, bots fill it in */}
      <input type="text" name="website" value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {state === 'error' && <p className="text-sm text-[#E34A33]" role="alert">{error}</p>}
      <button type="submit" disabled={state === 'sending'} className="btn-accent w-full flex items-center justify-center gap-2 disabled:opacity-60" data-testid="demo-submit">
        {state === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Book my demo
      </button>
      <p className="text-xs text-[#666666] text-center">We'll only use your details to arrange the demo.</p>
    </form>
  );
};

const LandingPage = () => {
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [location.hash]);

  return (
  <div className="min-h-screen bg-white">
    <MarketingNav />

    {/* Hero */}
    <section className="pt-32 pb-20 px-6 noise-overlay">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
        <div>
          <p className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FAFAFA] border border-[#E5E5E5] text-sm text-[#666666] mb-8">
            <span className="w-2 h-2 rounded-full bg-[#E34A33]" /> Online booking for salons, clinics & trades
          </p>
          <h1 className="heading-marketing text-5xl md:text-6xl lg:text-7xl text-[#0A0A0A] mb-6 leading-[1.05]" data-testid="hero-title">
            Your diary, booked while you work.
          </h1>
          <p className="text-lg md:text-xl text-[#666666] mb-10 max-w-xl">
            BookSlot lets clients book online at any hour, sends them their reminders and keeps your whole team on one
            calendar. That means less time on the phone and fewer empty chairs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="#demo" className="btn-primary px-8 py-4 text-base inline-flex items-center justify-center gap-2" data-testid="cta-primary">
              Book a demo <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#how-it-works" className="btn-secondary px-8 py-4 text-base inline-flex items-center justify-center" data-testid="cta-secondary">
              See how it works
            </a>
          </div>
          <p className="text-sm text-[#666666] mt-6">A short walkthrough. We set everything up with you.</p>
        </div>
        <HeroPreview />
      </div>
    </section>

    {/* Problems */}
    <section className="py-20 px-6 bg-[#FAFAFA] border-y border-[#E5E5E5]">
      <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-10">
        {problems.map(({ icon: Icon, title, desc }) => (
          <div key={title}>
            <Icon className="w-6 h-6 text-[#E34A33] mb-4" />
            <h3 className="text-lg font-semibold text-[#0A0A0A] mb-2">{title}</h3>
            <p className="text-[#666666]">{desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* How it works */}
    <section id="how-it-works" className="py-24 px-6 scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-4">Up and running without the headache</h2>
        <p className="text-lg text-[#666666] mb-16 max-w-2xl">No software to learn on your own. We get you live, then it runs in the background.</p>
        <div className="grid md:grid-cols-3 gap-px bg-[#E5E5E5] border border-[#E5E5E5]">
          {steps.map((s) => (
            <div key={s.n} className="bg-white p-8 md:p-10">
              <span className="font-mono text-sm text-[#E34A33]">{s.n}</span>
              <h3 className="text-xl font-semibold text-[#0A0A0A] mt-4 mb-3">{s.title}</h3>
              <p className="text-[#666666]">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Features */}
    <section id="features" className="py-24 px-6 bg-[#FAFAFA] border-y border-[#E5E5E5] scroll-mt-16">
      <div className="max-w-7xl mx-auto">
        <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-4">Everything the front desk does, minus the front desk</h2>
        <p className="text-lg text-[#666666] mb-16 max-w-2xl">The tools you'll actually use every day, and nothing you won't.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map(({ icon: Icon, title, desc }, idx) => (
            <div key={title} className="card-hover" data-testid={`feature-${idx}`}>
              <div className="w-11 h-11 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-[#0A0A0A]" />
              </div>
              <h3 className="font-semibold text-[#0A0A0A] mb-2">{title}</h3>
              <p className="text-sm text-[#666666]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* AI receptionist */}
    <section id="ai-receptionist" className="py-24 px-6 scroll-mt-16">
      <div className="max-w-6xl mx-auto bg-[#121212] text-white grid lg:grid-cols-2 gap-12 p-10 md:p-16">
        <div>
          <p className="text-sm font-medium text-[#A5A3F5] mb-4 flex items-center gap-2"><Bot className="w-4 h-4" /> AI RECEPTIONIST</p>
          <h2 className="heading-marketing text-3xl md:text-4xl mb-4">Someone on the desk, even when you're not</h2>
          <p className="text-white/70 mb-8">
            Clients can type a question on your booking page, like "do you have anything Saturday morning?", and get
            a real answer with a slot they can book. Your services, prices and hours come straight from your BookSlot setup.
          </p>
          <ul className="space-y-3 text-sm">
            {['Answers questions about your services and hours', 'Checks what’s actually available', 'Books, moves or cancels appointments'].map((t) => (
              <li key={t} className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-[#A5A3F5]" />{t}</li>
            ))}
          </ul>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 space-y-3 self-center text-sm" aria-label="Example AI receptionist conversation">
          <div className="bg-white/10 px-4 py-3 max-w-[85%]">Hi! Any chance of a trim this Saturday morning?</div>
          <div className="bg-[#4F46E5] px-4 py-3 max-w-[85%] ml-auto">Yes. Emma has 10:00 or 11:30 on Saturday. Would you like one of those?</div>
          <div className="bg-white/10 px-4 py-3 max-w-[85%]">10 please</div>
          <div className="bg-[#4F46E5] px-4 py-3 max-w-[85%] ml-auto">Done. You're booked for a trim with Emma, Saturday at 10:00. A confirmation is on its way to your email.</div>
          <p className="text-xs text-white/40 pt-2">Example conversation</p>
        </div>
      </div>
    </section>

    {/* Industries */}
    <section className="py-20 px-6 border-t border-[#E5E5E5]">
      <div className="max-w-7xl mx-auto">
        <h2 className="heading-marketing text-3xl md:text-4xl text-[#0A0A0A] mb-10 text-center">Made for appointment-based businesses</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {industries.map(({ icon: Icon, name }) => (
            <div key={name} className="card-flat text-center py-8">
              <Icon className="w-6 h-6 mx-auto mb-3 text-[#0A0A0A]" />
              <p className="text-sm font-medium text-[#0A0A0A]">{name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section id="faq" className="py-24 px-6 bg-[#FAFAFA] border-y border-[#E5E5E5] scroll-mt-16">
      <div className="max-w-3xl mx-auto">
        <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-10 text-center">Questions</h2>
        <Accordion type="single" collapsible className="bg-white border border-[#E5E5E5] px-6">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-[#666666]">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>

    {/* Demo */}
    <section id="demo" className="py-24 px-6 scroll-mt-16">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
        <div>
          <h2 className="heading-marketing text-4xl md:text-5xl text-[#0A0A0A] mb-6">See it with your own business in it</h2>
          <p className="text-lg text-[#666666] mb-8">
            Tell us a little about your business and we'll show you BookSlot set up the way you'd use it. No pressure, and no obligation.
          </p>
          <ul className="space-y-4">
            {['A short walkthrough by video call or phone', 'Your questions answered, including pricing for your team size', 'If it’s a fit, we handle the setup'].map((t) => (
              <li key={t} className="flex items-start gap-3 text-[#0A0A0A]"><CheckCircle2 className="w-5 h-5 mt-0.5 text-[#E34A33] shrink-0" />{t}</li>
            ))}
          </ul>
        </div>
        <DemoForm />
      </div>
    </section>

    <MarketingFooter />
  </div>
  );
};

export default LandingPage;
