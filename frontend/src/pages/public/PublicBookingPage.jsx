import { BrandMark } from '../../components/BrandLogo';
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { MessageCircle, ArrowLeft, ArrowRight, Clock, Check, MapPin, Phone, Hourglass, ChevronLeft, ChevronRight, Sparkles, CalendarPlus, CalendarX2 } from 'lucide-react';
import { format, addDays, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { themes } from '../../context/ThemeContext';
import { API, errorMessage } from '../../lib/api';
import { formatMoney, parseLocal } from '../../lib/utils';
import BookingChatWidget from '../../components/BookingChatWidget';

const ANY = 'any';

const PublicBookingPage = () => {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [page, setPage] = useState(null);

  const [selectedService, setSelectedService] = useState(null);
  const [eligibleStaff, setEligibleStaff] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null); // staff object or {staff_id: 'any'}
  const [month, setMonth] = useState(new Date());
  const [availableDates, setAvailableDates] = useState(null); // Set of yyyy-MM-dd
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [answers, setAnswers] = useState({});
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const response = await axios.get(`${API}/public/booking/${slug}`);
        setPage(response.data);
        document.title = `Book with ${response.data.tenant.name}`;
      } catch (error) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const business = page?.tenant;
  const currency = business?.currency || 'EUR';
  const settings = page?.settings || {};

  // Which days have free time (greys out the rest of the calendar)
  useEffect(() => {
    if (!selectedService || !selectedStaff || step !== 3) return;
    let cancelled = false;
    setAvailableDates(null);
    axios.get(`${API}/public/booking/${slug}/available-dates`, {
      params: { service_id: selectedService.service_id, staff_id: selectedStaff.staff_id, month: format(month, 'yyyy-MM') }
    }).then((r) => { if (!cancelled) setAvailableDates(new Set(r.data.available_dates)); })
      .catch(() => { if (!cancelled) setAvailableDates(new Set()); });
    return () => { cancelled = true; };
  }, [selectedService, selectedStaff, month, step, slug, refreshKey]);

  useEffect(() => {
    if (!selectedService || !selectedStaff || !selectedDate) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlot(null);
    axios.get(`${API}/public/booking/${slug}/availability`, {
      params: { service_id: selectedService.service_id, staff_id: selectedStaff.staff_id, date: format(selectedDate, 'yyyy-MM-dd') }
    }).then((r) => { if (!cancelled) setAvailableSlots(r.data.slots || []); })
      .catch((e) => { if (!cancelled) { setAvailableSlots([]); toast.error(errorMessage(e, 'Failed to load times')); } })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedService, selectedStaff, selectedDate, slug, refreshKey]);

  const relevantForms = useMemo(() => (page?.forms || []).filter(
    (f) => !f.service_ids?.length || (selectedService && f.service_ids.includes(selectedService.service_id))
  ), [page, selectedService]);

  const chooseService = async (service) => {
    setSelectedService(service);
    setSelectedStaff(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    let staff = page.staff;
    try {
      const r = await axios.get(`${API}/public/booking/${slug}/staff-for-service`, { params: { service_id: service.service_id } });
      staff = r.data.staff || [];
    } catch (e) { /* fall back to all staff */ }
    setEligibleStaff(staff);
    if (staff.length === 1) {
      setSelectedStaff(staff[0]);
      setStep(3);
    } else {
      setStep(2);
    }
  };

  const chooseStaff = (member) => {
    setSelectedStaff(member);
    setSelectedDate(null);
    setSelectedSlot(null);
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!clientName.trim()) return toast.error('Please enter your name');
    if (settings.require_email && !clientEmail.trim()) return toast.error('Please enter your email');
    if (settings.require_phone && !clientPhone.trim()) return toast.error('Please enter your phone number');
    for (const form of relevantForms) {
      for (const field of form.fields) {
        const v = answers[field.field_id];
        if (field.required && (v === undefined || v === '' || v === false)) {
          return toast.error(`Please answer: ${field.label}`);
        }
      }
    }
    setSubmitting(true);
    try {
      const response = await axios.post(`${API}/public/booking/${slug}/book`, {
        service_id: selectedService.service_id,
        staff_id: selectedSlot.staff_id || selectedStaff.staff_id,
        start_time: selectedSlot.start_time,
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        client_phone: clientPhone.trim(),
        notes,
        form_responses: answers,
      });
      if (response.data.payment_url) {
        // deposit: the slot is held while they pay on Stripe's secure page
        window.location.assign(response.data.payment_url);
        return;
      }
      setConfirmation(response.data);
      setStep(5);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to book appointment'));
      if (error?.response?.status === 409) {
        // that time was just taken - go back and reload the times
        setStep(3);
        setRefreshKey((k) => k + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-bg">
        <div className="w-10 h-10 border-[3px] border-indigo-200 border-t-[#4F46E5] rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center app-bg p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center mx-auto mb-5"><CalendarX2 className="w-8 h-8 text-[#9A97B0]" /></div>
          <h1 className="text-2xl font-bold text-[#1E1B3A] mb-2">We couldn't find that business</h1>
          <p className="text-[#6B6890]">Check the booking link and try again.</p>
        </div>
      </div>
    );
  }

  const themeId = business.branding?.theme || 'default';
  const theme = themes[themeId] || themes.default;
  const isDark = ['elite', 'modern'].includes(themeId);
  const c = theme.colors;
  const accent = c.accent;
  const onAccent = isDark ? c.background : '#FFFFFF';
  const serif = isDark || ['champagne', 'rose'].includes(themeId);
  const headingFont = serif ? "'Playfair Display', Georgia, serif" : 'inherit';
  const headingStyle = { color: c.text, fontFamily: headingFont };
  const cardStyle = { backgroundColor: c.card, borderColor: c.border, color: c.text };
  const inputStyle = { backgroundColor: isDark ? c.backgroundSecondary : '#FFFFFF', borderColor: c.border, color: c.text };
  const today = page.today ? parseLocal(`${page.today}T00:00:00`) : new Date();
  const lastDay = addDays(today, settings.max_advance_days || 90);
  const staffLabel = (slot) => (selectedStaff?.staff_id === ANY ? slot?.staff_name : selectedStaff?.name);
  const multiStaff = eligibleStaff.length > 1;
  const flow = multiStaff ? [1, 2, 3, 4] : [1, 3, 4];
  const stepIndex = Math.max(0, flow.indexOf(step));
  const stepTitle = { 1: 'Choose a service', 2: 'Who would you like?', 3: 'Pick a time', 4: 'Your details' }[step];
  const hasDeposit = business.deposits_online && selectedService?.deposit_required && Number(selectedService?.deposit_amount) > 0;
  const price = (v) => (Number(v) > 0 ? formatMoney(v, currency) : 'Free');

  // Days of the shown month that can be booked (today .. last bookable day)
  const rangeStart = startOfMonth(month) > today ? startOfMonth(month) : today;
  const rangeEnd = endOfMonth(month) < lastDay ? endOfMonth(month) : lastDay;
  const monthDays = rangeStart <= rangeEnd ? eachDayOfInterval({ start: rangeStart, end: rangeEnd }) : [];
  const canPrevMonth = startOfMonth(month) > startOfMonth(today);
  const canNextMonth = endOfMonth(month) < lastDay;
  const slotGroups = [
    ['Morning', availableSlots.filter((s) => Number(s.start_time.slice(11, 13)) < 12)],
    ['Afternoon', availableSlots.filter((s) => { const h = Number(s.start_time.slice(11, 13)); return h >= 12 && h < 17; })],
    ['Evening', availableSlots.filter((s) => Number(s.start_time.slice(11, 13)) >= 17)],
  ].filter(([, list]) => list.length);

  const goBack = () => setStep(step === 4 ? 3 : step === 3 ? (multiStaff ? 2 : 1) : 1);

  const downloadIcs = () => {
    const a = confirmation.appointment;
    const stamp = (t) => t.replace(/[-:]/g, '').slice(0, 15);
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BookSlot//EN', 'BEGIN:VEVENT',
      `UID:${confirmation.confirmation_code}@bookslot`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART:${stamp(a.start_time)}`, `DTEND:${stamp(a.end_time || a.start_time)}`,
      `SUMMARY:${confirmation.service_name} at ${business.name}`,
      business.address ? `LOCATION:${business.address}` : '',
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'appointment.ics'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Bottom action bar (phone-style, always within thumb reach)
  const bottomBar = (() => {
    if (step === 3 && selectedSlot) {
      return {
        line1: `${format(parseLocal(selectedSlot.start_time), 'EEE d MMM')} · ${selectedSlot.start_time.slice(11, 16)}`,
        line2: `${selectedService?.name} · ${price(selectedService?.price)}`,
        button: <button onClick={() => setStep(4)} data-testid="continue-to-details" className="tap h-12 px-6 rounded-2xl font-bold flex items-center gap-2 shadow-lg active:scale-[0.97] transition-transform" style={{ backgroundColor: accent, color: onAccent }}>Continue <ArrowRight className="w-4 h-4" /></button>,
      };
    }
    if (step === 4) {
      return {
        line1: price(selectedService?.price),
        line2: hasDeposit ? `${formatMoney(selectedService.deposit_amount, currency)} deposit now` : 'Pay on the day',
        button: <button type="submit" form="booking-details" disabled={submitting} data-testid="confirm-booking" className="tap h-12 px-6 rounded-2xl font-bold flex items-center gap-2 shadow-lg active:scale-[0.97] transition-transform disabled:opacity-60" style={{ backgroundColor: accent, color: onAccent }}>
          {submitting ? 'Booking…' : hasDeposit ? 'Pay deposit' : 'Confirm booking'}{!submitting && <Check className="w-4 h-4" />}
        </button>,
      };
    }
    return null;
  })();

  return (
    <div className={`min-h-screen ${themeId === 'default' ? 'app-bg' : ''} sm:py-8`} style={themeId === 'default' ? undefined : { backgroundColor: c.backgroundSecondary }}>
      <div className="relative max-w-lg mx-auto min-h-screen sm:min-h-[calc(100vh-4rem)] flex flex-col sm:rounded-[2rem] sm:shadow-2xl sm:shadow-indigo-950/10"
        style={{ backgroundColor: c.background, color: c.text }}>

        {/* Header: big and welcoming on the first screen, compact afterwards */}
        {step === 1 || step === 5 || !settings.online_booking_enabled ? (
          <header className="relative overflow-hidden px-6 pt-10 pb-8 text-center sm:rounded-t-[2rem]" style={{ background: `linear-gradient(160deg, ${accent} 0%, ${accent}CC 60%, ${accent}99 100%)`, color: onAccent }}>
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'radial-gradient(400px 200px at 80% 0%, #fff, transparent 70%)' }} aria-hidden="true" />
            <div className="relative">
              {business.logo_url ? (
                <img src={business.logo_url} alt={business.name} className="h-20 w-20 rounded-3xl object-contain bg-white p-2 mx-auto shadow-xl" data-testid="booking-logo" />
              ) : (
                <div className="h-20 w-20 rounded-3xl bg-white/95 mx-auto shadow-xl flex items-center justify-center text-3xl font-extrabold" style={{ color: accent, fontFamily: headingFont }}>
                  {business.name.charAt(0)}
                </div>
              )}
              <h1 className="text-2xl font-extrabold mt-4" style={{ fontFamily: headingFont }} data-testid="business-name">{business.name}</h1>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm mt-2 opacity-90">
                {business.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{business.address}</span>}
                {business.phone && <a href={`tel:${business.phone}`} className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{business.phone}</a>}
              </div>
              {(business.messaging?.whatsapp || business.messaging?.sms) && step === 1 && (
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {business.messaging.whatsapp && (
                    <a href={business.messaging.whatsapp} target="_blank" rel="noopener noreferrer" data-testid="whatsapp-link"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full bg-[#25D366] text-white shadow-md">
                      <MessageCircle className="w-4 h-4" />Book on WhatsApp
                    </a>
                  )}
                  {business.messaging.sms && (
                    <a href={business.messaging.sms} data-testid="sms-link"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full bg-white/20 backdrop-blur">
                      <Phone className="w-4 h-4" />Book by text
                    </a>
                  )}
                </div>
              )}
            </div>
          </header>
        ) : (
          <header className="sticky top-0 z-20 px-4 pt-4 pb-3 backdrop-blur sm:rounded-t-[2rem]" style={{ backgroundColor: `${c.background}EE` }}>
            <div className="flex items-center gap-3">
              <button onClick={goBack} aria-label="Back" data-testid="back-button"
                className="tap w-10 h-10 rounded-full flex items-center justify-center border shadow-sm" style={cardStyle}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: c.textSecondary }}>{business.name}</p>
                <p className="font-bold truncate" style={headingStyle} data-testid="step-title">{stepTitle}</p>
              </div>
              <span className="text-xs font-semibold" style={{ color: c.textSecondary }}>{stepIndex + 1}/{flow.length}</span>
            </div>
            <div className="flex gap-1.5 mt-3" aria-hidden="true">
              {flow.map((s, i) => (
                <div key={s} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ backgroundColor: i <= stepIndex ? accent : c.border }} />
              ))}
            </div>
          </header>
        )}

        {!settings.online_booking_enabled ? (
          <main className="flex-1 px-6 py-12 text-center">
            <h2 className="text-xl font-bold mb-3" style={headingStyle}>Online booking is paused</h2>
            <p style={{ color: c.textSecondary }}>
              Please contact {business.name}{business.phone ? ` on ${business.phone}` : ''}{business.email ? ` or ${business.email}` : ''} to book.
            </p>
          </main>
        ) : (
          <main className={`flex-1 px-4 sm:px-5 pt-5 ${bottomBar ? 'pb-36' : 'pb-12'}`}>
            {/* Step 1: Service */}
            {step === 1 && (
              <div className="animate-fade-in">
                {business.description && <p className="text-center text-sm mb-5 px-2" style={{ color: c.textSecondary }}>{business.description}</p>}
                <h2 className="text-lg font-bold mb-3 px-1" style={headingStyle} data-testid="step-title">What would you like to book?</h2>
                {page.services.length === 0 && <p className="px-1" style={{ color: c.textSecondary }}>No services are available to book online yet.</p>}
                <div className="space-y-3 animate-stagger">
                  {page.services.map((service) => (
                    <button key={service.service_id} onClick={() => chooseService(service)} data-testid={`service-${service.service_id}`}
                      className="tap w-full p-4 rounded-2xl border text-left flex items-center gap-4 shadow-sm hover:shadow-md active:scale-[0.99] transition-all" style={cardStyle}>
                      <span className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center" style={{ backgroundColor: `${service.color || accent}1A` }}>
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: service.color || accent }} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold leading-snug">{service.name}</h3>
                        {service.description && <p className="text-sm mt-0.5 line-clamp-2" style={{ color: c.textSecondary }}>{service.description}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: c.backgroundSecondary, color: c.textSecondary }}>
                            <Clock className="w-3 h-3" /> {service.duration} min
                          </span>
                          <span className="text-sm font-bold" style={{ color: accent }}>{price(service.price)}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 shrink-0" style={{ color: c.textSecondary }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Staff */}
            {step === 2 && (
              <div className="animate-fade-in">
                <p className="text-sm mb-4 px-1" style={{ color: c.textSecondary }}>{selectedService?.name}</p>
                {eligibleStaff.length === 0 ? (
                  <p style={{ color: c.textSecondary }}>Sorry, nobody is currently available for this service.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 animate-stagger">
                    {eligibleStaff.length > 1 && (
                      <button onClick={() => chooseStaff({ staff_id: ANY, name: 'Any available' })} data-testid="staff-any"
                        className="tap col-span-2 p-4 rounded-2xl border flex items-center gap-4 text-left shadow-sm hover:shadow-md active:scale-[0.99] transition-all" style={cardStyle}>
                        <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accent}1A` }}>
                          <Sparkles className="w-6 h-6" style={{ color: accent }} />
                        </span>
                        <div>
                          <h3 className="font-bold">Anyone available</h3>
                          <p className="text-sm" style={{ color: c.textSecondary }}>See the most times</p>
                        </div>
                      </button>
                    )}
                    {eligibleStaff.map((member) => (
                      <button key={member.staff_id} onClick={() => chooseStaff(member)} data-testid={`staff-${member.staff_id}`}
                        className="tap p-4 rounded-2xl border flex flex-col items-center text-center shadow-sm hover:shadow-md active:scale-[0.98] transition-all" style={cardStyle}>
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.name} className="w-16 h-16 rounded-full object-cover" />
                        ) : (
                          <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold" style={{ backgroundColor: member.color || accent, color: '#FFFFFF' }}>
                            {member.name.charAt(0)}
                          </div>
                        )}
                        <h3 className="font-bold mt-3">{member.name}</h3>
                        {member.title && <p className="text-xs mt-0.5" style={{ color: c.textSecondary }}>{member.title}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Date & time */}
            {step === 3 && (
              <div className="animate-fade-in">
                <p className="text-sm mb-4 px-1" style={{ color: c.textSecondary }}>
                  {selectedService?.name} · {selectedStaff?.staff_id === ANY ? 'anyone available' : `with ${selectedStaff?.name}`}
                </p>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="font-bold text-lg" style={headingStyle}>{format(month, 'MMMM yyyy')}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setMonth(addMonths(month, -1))} disabled={!canPrevMonth} aria-label="Previous month"
                      className="tap w-9 h-9 rounded-full border flex items-center justify-center disabled:opacity-30" style={cardStyle}><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={() => setMonth(addMonths(month, 1))} disabled={!canNextMonth} aria-label="Next month"
                      className="tap w-9 h-9 rounded-full border flex items-center justify-center disabled:opacity-30" style={cardStyle}><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2 snap-x" data-testid="booking-calendar">
                  {monthDays.map((d) => {
                    const key = format(d, 'yyyy-MM-dd');
                    const free = !availableDates || availableDates.has(key);
                    const sel = selectedDate && isSameDay(d, selectedDate);
                    return (
                      <button key={key} disabled={!free} onClick={() => setSelectedDate(d)} data-testid={`day-${key}`}
                        className="tap snap-start shrink-0 w-[60px] py-3 rounded-2xl border flex flex-col items-center transition-all disabled:opacity-35 active:scale-95"
                        style={sel ? { backgroundColor: accent, borderColor: accent, color: onAccent, boxShadow: `0 8px 20px -8px ${accent}` } : cardStyle}>
                        <span className="text-[11px] font-semibold uppercase" style={sel ? undefined : { color: c.textSecondary }}>{format(d, 'EEE')}</span>
                        <span className="text-xl font-extrabold leading-tight mt-0.5">{format(d, 'd')}</span>
                        <span className="w-1.5 h-1.5 rounded-full mt-1" style={{ backgroundColor: free && availableDates ? (sel ? onAccent : accent) : 'transparent' }} />
                      </button>
                    );
                  })}
                </div>
                {availableDates && availableDates.size === 0 && (
                  <p className="text-sm text-center mt-2" style={{ color: c.textSecondary }}>No free times this month. Try the next one.</p>
                )}

                <div className="mt-6">
                  {!selectedDate && <p className="text-sm text-center py-8" style={{ color: c.textSecondary }}>Pick a day to see the free times.</p>}
                  {selectedDate && slotsLoading && (
                    <div className="grid grid-cols-3 gap-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ backgroundColor: c.backgroundSecondary }} />)}</div>
                  )}
                  {selectedDate && !slotsLoading && availableSlots.length === 0 && (
                    <p className="text-sm text-center py-8" style={{ color: c.textSecondary }}>No times left on {format(selectedDate, 'EEEE')}. Please choose another day.</p>
                  )}
                  {selectedDate && !slotsLoading && slotGroups.map(([label, list]) => (
                    <div key={label} className="mb-5">
                      <p className="text-xs font-bold uppercase tracking-wider mb-2 px-1" style={{ color: c.textSecondary }}>{label}</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {list.map((slot) => {
                          const isSelected = selectedSlot?.start_time === slot.start_time;
                          return (
                            <button key={slot.start_time} onClick={() => setSelectedSlot(slot)} data-testid={`slot-${slot.start_time.slice(11, 16)}`}
                              className="tap h-12 rounded-xl border text-[15px] font-bold transition-all active:scale-95"
                              style={isSelected ? { backgroundColor: accent, color: onAccent, borderColor: accent, boxShadow: `0 8px 20px -8px ${accent}` } : cardStyle}>
                              {slot.start_time.slice(11, 16)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Details */}
            {step === 4 && selectedSlot && (
              <div className="animate-fade-in">
                <div className="p-4 rounded-2xl border mb-6 flex gap-4 items-center shadow-sm" style={cardStyle}>
                  <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0" style={{ backgroundColor: `${accent}1A`, color: accent }}>
                    <span className="text-[10px] font-bold uppercase">{format(parseLocal(selectedSlot.start_time), 'MMM')}</span>
                    <span className="text-xl font-extrabold leading-none">{format(parseLocal(selectedSlot.start_time), 'd')}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{selectedService?.name}</p>
                    <p className="text-sm" style={{ color: c.textSecondary }}>
                      {format(parseLocal(selectedSlot.start_time), 'EEEE')} at {selectedSlot.start_time.slice(11, 16)} · {selectedService?.duration} min
                    </p>
                    <p className="text-sm" style={{ color: c.textSecondary }}>with {staffLabel(selectedSlot) || 'our team'}</p>
                    {hasDeposit && (
                      <p className="text-xs mt-1" style={{ color: c.textSecondary }} data-testid="deposit-due">
                        Deposit due now: <span className="font-bold" style={{ color: c.text }}>{formatMoney(selectedService.deposit_amount, currency)}</span>, taken off the price on the day
                      </p>
                    )}
                  </div>
                </div>
                <form id="booking-details" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
                  <Field label="Your name" required><input id="name" value={clientName} onChange={(e) => setClientName(e.target.value)} required autoComplete="name"
                    className={fieldClass} style={inputStyle} data-testid="client-name" placeholder="First and last name" /></Field>
                  <Field label="Email" hint={settings.require_email ? null : 'optional'} required={!!settings.require_email}>
                    <input id="email" type="email" inputMode="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} required={!!settings.require_email}
                      autoComplete="email" className={fieldClass} style={inputStyle} data-testid="client-email" placeholder="So we can send your confirmation" />
                  </Field>
                  <Field label="Phone" hint={settings.require_phone ? null : 'optional'} required={!!settings.require_phone}>
                    <input id="phone" type="tel" inputMode="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} required={!!settings.require_phone}
                      autoComplete="tel" className={fieldClass} style={inputStyle} data-testid="client-phone" placeholder="In case we need to reach you" />
                  </Field>

                  {relevantForms.map((form) => (
                    <div key={form.form_id} className="pt-2 space-y-4">
                      <div>
                        <p className="font-bold">{form.name}</p>
                        {form.description && <p className="text-sm" style={{ color: c.textSecondary }}>{form.description}</p>}
                      </div>
                      {form.fields.map((field) => (
                        <FormFieldInput key={field.field_id} field={field} value={answers[field.field_id]}
                          onChange={(v) => setAnswers((a) => ({ ...a, [field.field_id]: v }))} style={inputStyle} textColor={c.text} />
                      ))}
                    </div>
                  ))}

                  <Field label="Anything we should know?" hint="optional">
                    <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000}
                      className={`${fieldClass} !h-auto py-3 resize-none`} style={inputStyle} data-testid="client-notes" />
                  </Field>
                  <p className="text-xs text-center pt-1" style={{ color: c.textSecondary }}>
                    Your details are shared only with {business.name} to manage your appointment.
                  </p>
                </form>
              </div>
            )}

            {/* Step 5: Confirmation */}
            {step === 5 && confirmation && (
              <div className="animate-fade-in text-center pt-2">
                {confirmation.status === 'pending_approval' ? (
                  <>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 bg-amber-100 animate-pop">
                      <Hourglass className="w-9 h-9 text-amber-600" />
                    </div>
                    <h2 className="text-2xl font-extrabold mb-2" style={headingStyle} data-testid="confirmation-title">Request received</h2>
                    <p className="mb-6" style={{ color: c.textSecondary }}>
                      {business.name} will check and confirm it shortly{clientEmail ? ` by email to ${clientEmail}` : ''}.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 animate-pop" style={{ backgroundColor: accent, color: onAccent, boxShadow: `0 16px 40px -12px ${accent}` }}>
                      <Check className="w-10 h-10" strokeWidth={3} />
                    </div>
                    <h2 className="text-2xl font-extrabold mb-2" style={headingStyle} data-testid="confirmation-title">You're booked in!</h2>
                    <p className="mb-6" style={{ color: c.textSecondary }}>
                      {clientEmail ? `We've sent the details to ${clientEmail}.` : 'Keep your confirmation code below.'}
                    </p>
                  </>
                )}
                <div className="text-left mb-6 p-5 rounded-2xl border shadow-sm" style={cardStyle}>
                  <p className="font-bold text-lg">{confirmation.service_name}</p>
                  <p className="text-sm mt-1" style={{ color: c.textSecondary }}>
                    {format(parseLocal(confirmation.appointment.start_time), 'EEEE d MMMM')} at {confirmation.appointment.start_time.slice(11, 16)}
                  </p>
                  <p className="text-sm" style={{ color: c.textSecondary }}>with {confirmation.staff_name}</p>
                  {business.address && <p className="text-sm flex items-center gap-1 mt-1" style={{ color: c.textSecondary }}><MapPin className="w-3.5 h-3.5" />{business.address}</p>}
                  <div className="pt-4 border-t mt-4 border-dashed" style={{ borderColor: c.border }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.textSecondary }}>Confirmation code</p>
                    <p className="font-mono font-bold break-all mt-0.5">{confirmation.confirmation_code}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {confirmation.status !== 'pending_approval' && (
                    <button onClick={downloadIcs} data-testid="add-to-calendar"
                      className="tap w-full h-12 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
                      style={{ backgroundColor: accent, color: onAccent }}>
                      <CalendarPlus className="w-5 h-5" /> Add to my calendar
                    </button>
                  )}
                  <Link to={`/booking/${confirmation.confirmation_code}`} data-testid="manage-booking-link"
                    className="tap w-full h-12 rounded-2xl font-bold border flex items-center justify-center" style={cardStyle}>
                    View or cancel this booking
                  </Link>
                  <button onClick={() => { setStep(1); setConfirmation(null); setSelectedSlot(null); setSelectedDate(null); }}
                    className="text-sm font-semibold pt-2" style={{ color: c.textSecondary }}>
                    Book something else
                  </button>
                </div>
              </div>
            )}
          </main>
        )}

        {business.branding?.show_powered_by !== false && step !== 3 && step !== 4 && (
          <a href="/" className="block text-center text-xs py-5" style={{ color: c.textSecondary }}>
            <span className="inline-flex items-center gap-1.5"><BrandMark size={14} />Powered by BookSlot</span>
          </a>
        )}

        {/* Sticky action bar */}
        {bottomBar && (
          <div className="fixed bottom-0 inset-x-0 mx-auto max-w-lg z-30 px-4 pt-3 safe-bottom border-t backdrop-blur sm:border-x sm:rounded-t-2xl shadow-[0_-8px_24px_-12px_rgba(30,27,58,0.15)]"
            style={{ backgroundColor: `${c.card}F2`, borderColor: c.border }}>
            <div className="max-w-lg mx-auto flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{bottomBar.line1}</p>
                <p className="text-xs truncate" style={{ color: c.textSecondary }}>{bottomBar.line2}</p>
              </div>
              {bottomBar.button}
            </div>
          </div>
        )}
      </div>

      {business.ai_chat_enabled && <BookingChatWidget slug={slug} businessName={business.name} accent={accent} />}
    </div>
  );
};

const fieldClass = 'w-full h-12 px-4 rounded-xl border text-base outline-none transition-shadow focus:ring-4 focus:ring-indigo-500/15';

const Field = ({ label, hint, required, children }) => (
  <label className="block">
    <span className="text-sm font-semibold">{label}{required ? ' *' : ''}{hint && <span className="font-normal opacity-60"> · {hint}</span>}</span>
    <div className="mt-1.5">{children}</div>
  </label>
);

const FormFieldInput = ({ field, value, onChange, style, textColor }) => {
  const label = (
    <Label className="text-sm font-medium" style={{ color: textColor }}>{field.label}{field.required ? ' *' : ''}</Label>
  );
  if (field.field_type === 'textarea') {
    return (<div>{label}<textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={field.placeholder || ''}
      className="mt-1.5 w-full rounded-xl border px-4 py-3 text-base resize-none" style={style} /></div>);
  }
  if (field.field_type === 'select') {
    return (<div>{label}<select value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full h-12 rounded-xl border px-4 text-base" style={style}>
      <option value="">Choose...</option>
      {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select></div>);
  }
  if (field.field_type === 'checkbox') {
    return (<label className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: textColor }}>
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      <span>{field.label}{field.required ? ' *' : ''}</span>
    </label>);
  }
  const type = { email: 'email', phone: 'tel', date: 'date' }[field.field_type] || 'text';
  return (<div>{label}<Input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder || ''}
    className="mt-1.5 !h-12 !rounded-xl" style={style} /></div>);
};

export default PublicBookingPage;
