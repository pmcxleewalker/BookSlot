import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Calendar } from '../../components/ui/calendar';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Clock, Check, MapPin, Sparkles, User, Smartphone, Share2, Plus, Home, BellRing, UserCheck } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import { resolveTheme } from '../../config/themePresets';
import GoldLeafDecor from '../../components/GoldLeafDecor';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const STEPS = ['Service', 'Team', 'Date & Time', 'Details', 'Confirmed'];

const PublicBookingPage = () => {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);

  const [selectedService, setSelectedService] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [confirmation, setConfirmation] = useState(null);
  const [bookingError, setBookingError] = useState(null);

  // Tenant branding + theme preset
  const themeData = resolveTheme(business);
  const { isDark, presetKey, tokens } = themeData;
  const brandPrimary = business?.branding?.primary_color || themeData.colors.primary;
  const brandSecondary = business?.branding?.secondary_color || themeData.colors.secondary;

  // Days that at least one eligible staff member works on (used to disable the rest in the date picker)
  const workingDaysOfWeek = useMemo(() => {
    const days = new Set();
    staff.forEach(s => {
      const wh = s.working_hours || {};
      Object.entries(wh).forEach(([day, schedule]) => {
        if (!schedule) return;
        const working = (schedule.start && schedule.end) || schedule.enabled === true;
        if (working) days.add(day.toLowerCase());
      });
    });
    return days;
  }, [staff]);
  const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  useEffect(() => { fetchBusinessData(); }, [slug]);
  useEffect(() => { if (selectedService && selectedStaff && selectedDate) fetchAvailability(); }, [selectedService, selectedStaff, selectedDate]);

  const fetchBusinessData = async () => {
    try {
      const response = await axios.get(`${API}/public/booking/${slug}`);
      setBusiness(response.data.tenant);
      setServices(response.data.services);
      setStaff(response.data.staff);
    } catch (error) {
      toast.error('Business not found');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async () => {
    setSlotsLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await axios.get(`${API}/public/booking/${slug}/availability`, {
        params: { service_id: selectedService.service_id, staff_id: selectedStaff.staff_id, date: dateStr }
      });
      setAvailableSlots(response.data.slots || []);
    } catch (error) {
      toast.error('Failed to load availability');
    } finally {
      setSlotsLoading(false);
    }
  };

  // Staff eligible for selected service (honours staff.services whitelist)
  const eligibleStaff = useMemo(() => {
    if (!selectedService) return staff;
    return staff.filter(s => !s.services || s.services.length === 0 || s.services.includes(selectedService.service_id));
  }, [staff, selectedService]);

  const handleSubmit = async () => {
    if (!clientName || !clientEmail) { toast.error('Please fill in your details'); return; }
    setSubmitting(true);
    setBookingError(null);
    try {
      const endTime = addMinutes(new Date(selectedSlot.start_time), selectedService.duration);
      const response = await axios.post(`${API}/public/booking/${slug}/book`, {
        service_id: selectedService.service_id,
        staff_id: selectedStaff.staff_id,
        start_time: selectedSlot.start_time,
        end_time: endTime.toISOString(),
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        notes
      });
      // If a deposit is required, kick off Stripe Checkout BEFORE showing success
      if (response.data.requires_deposit) {
        try {
          toast.info(`Redirecting to secure payment for €${response.data.deposit_amount} deposit…`);
          const checkoutRes = await axios.post(`${API}/public/booking/${slug}/checkout-deposit`, {
            appointment_id: response.data.confirmation_code,
            origin_url: window.location.origin
          });
          window.location.href = checkoutRes.data.url;
          return; // browser navigates away
        } catch (payErr) {
          toast.error('Could not start payment — your booking was saved as pending. Please contact the salon.');
        }
      }
      setConfirmation(response.data);
      setStep(5);
      toast.success(response.data.message || 'Booking request submitted');
    } catch (error) {
      const errorData = error.response?.data?.detail;
      if (typeof errorData === 'object' && errorData?.reason) {
        setBookingError(errorData);
        toast.error(errorData.message);
      } else {
        toast.error(errorData || 'Failed to book appointment');
      }
    } finally { setSubmitting(false); }
  };

  const handleSelectAlternativeStaff = (alt) => { setSelectedStaff(alt); setBookingError(null); toast.success(`Selected ${alt.name}`); };
  const handleSelectAlternativeTime = (slot) => { setSelectedSlot(slot); setBookingError(null); toast.success(`Selected ${slot.display}`); };
  const handleSelectAlternativeDay = (day) => { setSelectedDate(new Date(day.date)); setBookingError(null); setStep(3); toast.success(`Selected ${day.display}`); };

  if (loading) return (<div className="min-h-screen flex items-center justify-center bg-[#FAF7F3]"><div className="text-[#9E948F] text-sm animate-pulse tracking-widest uppercase">Loading</div></div>);
  if (!business) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F3]">
      <div className="text-center">
        <h1 className="font-['Cormorant_Garamond'] text-4xl font-light text-[#2C2A29] mb-3">Not found</h1>
        <p className="text-[#9E948F] mb-4">We couldn't find this booking page.</p>
        <Link to="/" className="text-[#B8868B] hover:underline">Go home</Link>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen"
      data-theme={presetKey}
      style={{ background: isDark ? tokens.heroBg : `linear-gradient(180deg, ${brandSecondary}22 0%, #FAF7F3 40%)` }}
    >
      {/* Hero Header */}
      <header className="pt-12 pb-10 px-6">
        <div className="max-w-3xl mx-auto text-center">
          {isDark && <GoldLeafDecor variant="frame" className="mb-5" />}
          {business.logo_url ? (
            <img src={business.logo_url} alt={business.name} className="h-16 mx-auto mb-6 rounded-2xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: isDark ? 'transparent' : brandPrimary, border: isDark ? `1.5px solid ${brandPrimary}` : 'none' }}>
              <Sparkles className="w-7 h-7" style={{ color: isDark ? brandPrimary : '#fff' }} strokeWidth={1.5} />
            </div>
          )}
          <p className="text-[11px] tracking-[0.3em] uppercase font-medium mb-2" style={{ color: brandPrimary }}>Book Your Visit</p>
          <h1
            className="font-['Cormorant_Garamond'] text-5xl sm:text-6xl font-light text-[#2C2A29] mb-3"
            style={isDark ? { color: tokens.textPrimary, letterSpacing: '0.06em' } : undefined}
            data-testid="business-name"
          >
            {business.name}
          </h1>
          {business.address && (
            <p className="text-sm text-[#706B68] flex items-center gap-1.5 justify-center">
              <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
              {business.address}
            </p>
          )}
          {isDark && <GoldLeafDecor variant="divider" className="w-56 h-3 mx-auto mt-6 opacity-80" />}
        </div>
      </header>

      {/* Progress Stepper */}
      <div className="max-w-3xl mx-auto px-6 mb-8">
        <div className="bg-white rounded-full shadow-[0_4px_20px_rgb(0,0,0,0.04)] px-4 py-3 flex items-center gap-1 overflow-x-auto">
          {STEPS.map((label, idx) => {
            const stepNum = idx + 1;
            const active = step === stepNum;
            const done = step > stepNum;
            return (
              <React.Fragment key={label}>
                <div className={`flex items-center gap-2 px-2 shrink-0 ${done || active ? '' : 'opacity-40'}`}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ backgroundColor: done || active ? brandPrimary : '#D4CFCA' }}>
                    {done ? <Check className="w-3 h-3" /> : stepNum}
                  </div>
                  <span className="text-xs font-medium text-[#2C2A29] hidden sm:inline tracking-wide">{label}</span>
                </div>
                {idx < STEPS.length - 1 && <div className="flex-1 h-px" style={{ background: done ? brandPrimary : '#F0EBE6', minWidth: 12 }} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 pb-20">
        {/* Step 1: Service */}
        {step === 1 && (
          <section className="animate-fade-in">
            <h2 className="font-['Cormorant_Garamond'] text-3xl font-light text-[#2C2A29] mb-1" data-testid="step-title">Choose a service</h2>
            <p className="text-sm text-[#9E948F] mb-8">Select from our curated menu</p>
            <div className="space-y-3">
              {services.length === 0 && <p className="text-center py-10 text-[#9E948F]">No services available right now.</p>}
              {services.map((service) => (
                <button
                  key={service.service_id}
                  onClick={() => { setSelectedService(service); setSelectedStaff(null); setStep(2); }}
                  className="w-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-6 text-left flex justify-between items-center transition-all hover:-translate-y-0.5 group"
                  data-testid={`service-${service.service_id}`}
                  style={{ borderLeft: `3px solid ${brandPrimary}` }}
                >
                  <div>
                    <h3 className="font-['Cormorant_Garamond'] text-2xl font-normal text-[#2C2A29] group-hover:text-[#B8868B] transition-colors">{service.name}</h3>
                    {service.description && <p className="text-sm text-[#706B68] mt-1 max-w-md line-clamp-2">{service.description}</p>}
                    <p className="text-xs text-[#9E948F] flex items-center gap-1.5 mt-2 font-mono">
                      <Clock className="w-3 h-3" strokeWidth={1.5} />
                      {service.duration} min
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-['Cormorant_Garamond'] text-3xl font-light text-[#2C2A29]">€{service.price}</p>
                    {service.deposit_required && service.deposit_amount > 0 && (
                      <p className="text-[10px] tracking-[0.15em] uppercase font-medium mt-1" style={{ color: brandPrimary }}>€{service.deposit_amount} deposit</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Step 2: Staff */}
        {step === 2 && (
          <section className="animate-fade-in">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 text-xs text-[#9E948F] hover:text-[#2C2A29] mb-6 uppercase tracking-[0.15em]"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
            <h2 className="font-['Cormorant_Garamond'] text-3xl font-light text-[#2C2A29] mb-1">Pick your specialist</h2>
            <p className="text-sm text-[#9E948F] mb-8">For <span className="font-medium text-[#2C2A29]">{selectedService?.name}</span></p>
            <div className="grid sm:grid-cols-2 gap-3">
              {eligibleStaff.length === 0 && <p className="col-span-2 text-center py-10 text-[#9E948F]">No specialists available for this service.</p>}
              {eligibleStaff.map((member) => (
                <button
                  key={member.staff_id}
                  onClick={() => { setSelectedStaff(member); setStep(3); }}
                  className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-5 text-left flex items-center gap-4 transition-all hover:-translate-y-0.5"
                  data-testid={`staff-${member.staff_id}`}
                >
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.name} className="w-14 h-14 rounded-2xl object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-['Cormorant_Garamond'] text-2xl" style={{ backgroundColor: brandPrimary }}>{member.name.charAt(0)}</div>
                  )}
                  <div>
                    <h3 className="font-medium text-[#2C2A29]">{member.name}</h3>
                    {member.title && <p className="text-xs text-[#9E948F] tracking-wide">{member.title}</p>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Step 3: Date & Time */}
        {step === 3 && (
          <section className="animate-fade-in">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 text-xs text-[#9E948F] hover:text-[#2C2A29] mb-6 uppercase tracking-[0.15em]"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
            <h2 className="font-['Cormorant_Garamond'] text-3xl font-light text-[#2C2A29] mb-1">When suits you?</h2>
            <p className="text-sm text-[#9E948F] mb-8">Select a date and time</p>

            <div className="grid md:grid-cols-[auto_1fr] gap-5">
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                  disabled={(date) => {
                    const past = date < new Date(new Date().setHours(0, 0, 0, 0));
                    const dayName = DAY_NAMES[date.getDay()];
                    const noStaffWorking = workingDaysOfWeek.size > 0 && !workingDaysOfWeek.has(dayName);
                    return past || noStaffWorking;
                  }}
                  className="w-full"
                  data-testid="booking-calendar"
                />
              </div>

              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
                <h3 className="font-['Cormorant_Garamond'] text-xl font-light text-[#2C2A29] mb-4">
                  {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a date'}
                </h3>
                {!selectedDate && <p className="text-[#9E948F] text-sm">Choose a date to view available times.</p>}
                {selectedDate && slotsLoading && <p className="text-[#9E948F] text-sm animate-pulse">Loading available times…</p>}
                {selectedDate && !slotsLoading && availableSlots.length === 0 && (
                  <div className="text-center py-8 px-4 rounded-2xl bg-[#FAF7F3]">
                    <p className="text-[#706B68] text-sm font-medium">Fully booked</p>
                    <p className="text-[#9E948F] text-xs mt-1">Try a different day</p>
                  </div>
                )}
                {selectedDate && !slotsLoading && availableSlots.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
                    {availableSlots.map((slot, idx) => {
                      const t = new Date(slot.start_time);
                      const timeStr = format(t, 'h:mm a');
                      const isSelected = selectedSlot?.start_time === slot.start_time;
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedSlot(slot)}
                          className="py-2.5 text-xs font-mono rounded-full transition-all border-2"
                          style={isSelected
                            ? { backgroundColor: brandPrimary, color: '#fff', borderColor: brandPrimary }
                            : { backgroundColor: '#FAF7F3', color: '#2C2A29', borderColor: 'transparent' }}
                          data-testid={`slot-${idx}`}
                        >
                          {timeStr}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedSlot && (
                  <button
                    onClick={() => setStep(4)}
                    className="w-full h-12 mt-6 rounded-full text-white text-sm font-medium flex items-center justify-center gap-2 transition-all hover:shadow-lg"
                    style={{ backgroundColor: '#2C2A29' }}
                    data-testid="continue-to-details"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Step 4: Details */}
        {step === 4 && (
          <section className="animate-fade-in">
            <button onClick={() => setStep(3)} className="flex items-center gap-2 text-xs text-[#9E948F] hover:text-[#2C2A29] mb-6 uppercase tracking-[0.15em]"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
            <h2 className="font-['Cormorant_Garamond'] text-3xl font-light text-[#2C2A29] mb-1">Your details</h2>
            <p className="text-sm text-[#9E948F] mb-8">We'll confirm your appointment by email</p>

            {/* Summary */}
            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 mb-5" style={{ borderLeft: `3px solid ${brandPrimary}` }}>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#9E948F] mb-3">Summary</p>
              <div className="space-y-1">
                <p className="font-['Cormorant_Garamond'] text-2xl font-light text-[#2C2A29]">{selectedService?.name}</p>
                <p className="text-sm text-[#706B68]">with <span className="font-medium">{selectedStaff?.name}</span></p>
                <p className="text-sm text-[#706B68]">{selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')} · {selectedSlot && format(new Date(selectedSlot.start_time), 'h:mm a')}</p>
                <p className="font-['Cormorant_Garamond'] text-2xl font-light mt-3" style={{ color: brandPrimary }}>€{selectedService?.price}</p>
                {selectedService?.deposit_required && selectedService?.deposit_amount > 0 && (
                  <p className="text-xs text-[#706B68] mt-2 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandPrimary }} />
                    Pay <strong className="text-[#2C2A29]">€{selectedService.deposit_amount}</strong> deposit now to confirm — €{selectedService.price - selectedService.deposit_amount} balance in salon
                  </p>
                )}
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 space-y-4">
              <div>
                <Label htmlFor="name" className="text-xs uppercase tracking-wider text-[#9E948F]">Full name *</Label>
                <Input id="name" value={clientName} onChange={(e) => setClientName(e.target.value)} required className="mt-1.5 h-11 rounded-xl bg-[#FAF7F3] border-transparent" data-testid="client-name" />
              </div>
              <div>
                <Label htmlFor="email" className="text-xs uppercase tracking-wider text-[#9E948F]">Email *</Label>
                <Input id="email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} required className="mt-1.5 h-11 rounded-xl bg-[#FAF7F3] border-transparent" data-testid="client-email" />
              </div>
              <div>
                <Label htmlFor="phone" className="text-xs uppercase tracking-wider text-[#9E948F]">Phone (optional)</Label>
                <Input id="phone" type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="mt-1.5 h-11 rounded-xl bg-[#FAF7F3] border-transparent" data-testid="client-phone" />
              </div>
              <div>
                <Label htmlFor="notes" className="text-xs uppercase tracking-wider text-[#9E948F]">Notes (optional)</Label>
                <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1.5 w-full px-4 py-3 text-sm bg-[#FAF7F3] rounded-xl border-transparent focus:outline-none focus:bg-white focus:ring-1 resize-none" style={{ '--tw-ring-color': brandPrimary }} data-testid="client-notes" />
              </div>

              {bookingError && (
                <div className="rounded-2xl p-5" style={{ backgroundColor: `${brandSecondary}22`, border: `1px solid ${brandSecondary}` }}>
                  <p className="text-sm font-medium mb-3" style={{ color: brandPrimary }}>{bookingError.message}</p>
                  {bookingError.alternative_times?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-[#706B68] mb-2">Available times for {selectedStaff?.name}:</p>
                      <div className="flex flex-wrap gap-2">
                        {bookingError.alternative_times.map((slot, idx) => (
                          <button key={idx} type="button" onClick={() => handleSelectAlternativeTime(slot)} className="px-3 py-1.5 bg-white rounded-full text-xs font-mono hover:shadow-sm transition-all" style={{ color: brandPrimary }}>{slot.display}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {bookingError.alternative_days?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-[#706B68] mb-2">{selectedStaff?.name} is available on:</p>
                      <div className="flex flex-wrap gap-2">
                        {bookingError.alternative_days.map((day, idx) => (
                          <button key={idx} type="button" onClick={() => handleSelectAlternativeDay(day)} className="px-3 py-1.5 bg-white rounded-full text-xs hover:shadow-sm transition-all" style={{ color: brandPrimary }}>{day.display}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {bookingError.alternative_staff?.length > 0 && (
                    <div>
                      <p className="text-xs text-[#706B68] mb-2">Other available specialists:</p>
                      <div className="flex flex-wrap gap-2">
                        {bookingError.alternative_staff.map((s, idx) => (
                          <button key={idx} type="button" onClick={() => handleSelectAlternativeStaff(s)} className="px-3 py-2 bg-white rounded-full text-xs hover:shadow-sm transition-all flex items-center gap-2" style={{ color: brandPrimary }}>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: brandPrimary }}>{s.name.charAt(0)}</div>
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-full text-white text-sm font-medium flex items-center justify-center gap-2 transition-all hover:shadow-lg disabled:opacity-60"
                style={{ backgroundColor: brandPrimary }}
                data-testid="confirm-booking"
              >
                {submitting
                  ? 'Submitting…'
                  : (selectedService?.deposit_required && selectedService?.deposit_amount > 0
                      ? `Pay €${selectedService.deposit_amount} & Confirm`
                      : 'Confirm Booking')}
                {!submitting && <Check className="w-4 h-4" />}
              </button>
              <p className="text-[11px] text-center text-[#9E948F] pt-1">Your booking will be confirmed by {business.name} shortly.</p>
            </form>
          </section>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && confirmation && (
          <section className="animate-fade-in text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: `${brandSecondary}44` }}>
              <Check className="w-9 h-9" strokeWidth={1.5} style={{ color: brandPrimary }} />
            </div>
            <p className="text-[11px] tracking-[0.3em] uppercase font-medium mb-3" style={{ color: brandPrimary }}>
              {confirmation.requires_approval ? 'Awaiting confirmation' : 'Confirmed'}
            </p>
            <h2 className="font-['Cormorant_Garamond'] text-5xl font-light text-[#2C2A29] mb-3" data-testid="confirmation-title">
              {confirmation.requires_approval ? 'Request received' : 'You\'re booked in'}
            </h2>
            <p className="text-[#706B68] mb-10 max-w-md mx-auto">
              {confirmation.requires_approval
                ? `We'll email you at ${clientEmail} once ${business.name} confirms your appointment.`
                : `A confirmation has been sent to ${clientEmail}`}
            </p>

            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 text-left max-w-md mx-auto" style={{ borderLeft: `3px solid ${brandPrimary}` }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#9E948F]">Your booking</p>
                {confirmation.requires_approval && (
                  <span className="text-[10px] px-3 py-1 rounded-full" style={{ backgroundColor: `${brandSecondary}44`, color: brandPrimary }}>Pending</span>
                )}
              </div>
              <p className="font-['Cormorant_Garamond'] text-2xl font-light text-[#2C2A29]">{selectedService?.name}</p>
              <p className="text-sm text-[#706B68] mt-1">with {selectedStaff?.name}</p>
              <p className="text-sm text-[#706B68]">{selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')} · {selectedSlot && format(new Date(selectedSlot.start_time), 'h:mm a')}</p>
              <div className="pt-4 mt-4 border-t border-[#F0EBE6]">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#9E948F]">Confirmation code</p>
                <p className="font-mono font-semibold text-[#2C2A29] mt-1">{confirmation.confirmation_code}</p>
              </div>
            </div>

            {/* Instant Rebooking card — AI-recommended interval + manual options */}
            <RebookCard
              confirmationCode={confirmation.confirmation_code}
              brandPrimary={brandPrimary}
              brandSecondary={brandSecondary}
              isDark={isDark}
            />

            {/* Optional client account upsell */}
            <ClientAccountUpsell
              confirmationCode={confirmation.confirmation_code}
              clientEmail={clientEmail}
              clientName={clientName}
              brandPrimary={brandPrimary}
              brandSecondary={brandSecondary}
            />

            <Link
              to={`/booking/${confirmation.confirmation_code}`}
              className="inline-block mt-8 text-sm hover:underline"
              style={{ color: brandPrimary }}
              data-testid="manage-booking-link"
            >
              Manage your booking →
            </Link>
          </section>
        )}
      </main>

      <footer className="py-8 text-center">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[#9E948F]">Powered by BookSlot</p>
      </footer>
    </div>
  );
};

// ============================================================================
// Optional client-account upsell shown after a successful booking.
// Lets the client set a password, then walks them through saving the site
// to their phone home screen (iOS + Android detect).
// ============================================================================
const ClientAccountUpsell = ({ confirmationCode, clientEmail, clientName, brandPrimary, brandSecondary }) => {
  const [mode, setMode] = useState('idle'); // idle | form | created | skipped
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // Detect platform for the right install instructions
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  const handleCreate = async () => {
    if (!clientEmail) { toast.error('No email on file — go back and add one to create an account'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      const resp = await axios.post(`${API}/public/booking/${confirmationCode}/create-account`, { password });
      if (resp.data?.already_exists) {
        toast.info('You already have an account — signing in saves your bookings here too.');
        setMode('created');
        return;
      }
      if (resp.data?.token) {
        localStorage.setItem('token', resp.data.token);
        localStorage.setItem('user', JSON.stringify(resp.data.user));
      }
      toast.success('Account created');
      setMode('created');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not create account');
    } finally { setSaving(false); }
  };

  if (mode === 'skipped') return null;

  if (mode === 'idle') {
    return (
      <div className="mt-6 max-w-md mx-auto bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6" style={{ border: `1px solid ${brandSecondary}55` }} data-testid="client-account-upsell">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${brandSecondary}33` }}>
            <UserCheck className="w-5 h-5" style={{ color: brandPrimary }} strokeWidth={1.5} />
          </div>
          <div className="text-left">
            <p className="font-medium text-[#2C2A29]">Save your spot for next time?</p>
            <p className="text-xs text-[#9E948F] mt-1 leading-relaxed">Create a quick account with just a password — no email needed, we already have yours.</p>
          </div>
        </div>
        <ul className="space-y-2 mb-5 pl-1">
          <li className="flex items-center gap-2 text-xs text-[#706B68]"><Check className="w-3.5 h-3.5 shrink-0" style={{ color: brandPrimary }} /> Rebook in seconds next time</li>
          <li className="flex items-center gap-2 text-xs text-[#706B68]"><BellRing className="w-3.5 h-3.5 shrink-0" style={{ color: brandPrimary }} /> Get notified of changes or cancellations</li>
          <li className="flex items-center gap-2 text-xs text-[#706B68]"><Home className="w-3.5 h-3.5 shrink-0" style={{ color: brandPrimary }} /> One-tap access from your phone's home screen</li>
        </ul>
        <div className="flex gap-2">
          <button onClick={() => setMode('skipped')} className="flex-1 h-10 rounded-full text-xs font-medium text-[#706B68] hover:bg-[#FAF7F3] transition-colors" data-testid="skip-account">No thanks</button>
          <button onClick={() => setMode('form')} className="flex-1 h-10 rounded-full text-xs font-medium text-white transition-all hover:shadow-md" style={{ backgroundColor: brandPrimary }} data-testid="start-create-account">Create account</button>
        </div>
      </div>
    );
  }

  if (mode === 'form') {
    return (
      <div className="mt-6 max-w-md mx-auto bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6" style={{ border: `1px solid ${brandSecondary}55` }}>
        <p className="text-[10px] uppercase tracking-[0.25em] text-[#9E948F] mb-3">Your account</p>
        <div className="text-left space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-[#9E948F]">Username (your email)</Label>
            <Input value={clientEmail} readOnly className="mt-1 h-11 rounded-xl bg-[#FAF7F3] border-transparent text-[#706B68]" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-[#9E948F]">Create password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11 rounded-xl bg-[#FAF7F3] border-transparent" data-testid="account-password" minLength={6} />
            <p className="text-[10px] text-[#9E948F] mt-1">Minimum 6 characters</p>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-[#9E948F]">Confirm password</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 h-11 rounded-xl bg-[#FAF7F3] border-transparent" data-testid="account-password-confirm" minLength={6} />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setMode('idle')} className="flex-1 h-10 rounded-full text-xs font-medium text-[#706B68] hover:bg-[#FAF7F3] transition-colors">Back</button>
            <button onClick={handleCreate} disabled={saving} className="flex-1 h-10 rounded-full text-xs font-medium text-white disabled:opacity-60 transition-all hover:shadow-md" style={{ backgroundColor: brandPrimary }} data-testid="confirm-create-account">{saving ? 'Creating…' : 'Create account'}</button>
          </div>
        </div>
      </div>
    );
  }

  // mode === 'created' — now show "save to home screen" instructions
  const url = `${window.location.origin}/my/bookings`;
  return (
    <div className="mt-6 max-w-md mx-auto space-y-4" data-testid="homescreen-instructions">
      {/* Success */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-5 flex items-start gap-3" style={{ border: `1px solid ${brandSecondary}55` }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${brandSecondary}44` }}>
          <Check className="w-4 h-4" style={{ color: brandPrimary }} strokeWidth={2} />
        </div>
        <div className="text-left">
          <p className="font-medium text-[#2C2A29] text-sm">{clientName ? `You're in, ${clientName.split(' ')[0]}!` : "You're all set"}</p>
          <p className="text-xs text-[#9E948F] mt-0.5">Username: <span className="font-mono text-[#2C2A29]">{clientEmail}</span></p>
        </div>
      </div>

      {/* Homescreen panel */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 text-left" style={{ border: `1px solid ${brandSecondary}55` }}>
        <div className="flex items-center gap-3 mb-4">
          <Smartphone className="w-5 h-5" style={{ color: brandPrimary }} strokeWidth={1.5} />
          <p className="font-medium text-[#2C2A29]">Add to your home screen</p>
        </div>
        <p className="text-xs text-[#706B68] mb-4 leading-relaxed">So it feels like a real app — tap to open your bookings anytime.</p>

        {platform === 'ios' && (
          <ol className="space-y-3 text-sm text-[#2C2A29]" data-testid="ios-instructions">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ backgroundColor: brandPrimary }}>1</span>
              <span>Tap the <Share2 className="inline w-4 h-4 -mt-0.5" strokeWidth={1.5} /> <strong>Share</strong> button at the bottom of Safari.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ backgroundColor: brandPrimary }}>2</span>
              <span>Scroll down and tap <strong>"Add to Home Screen"</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ backgroundColor: brandPrimary }}>3</span>
              <span>Tap <strong>Add</strong> in the top-right corner — done!</span>
            </li>
          </ol>
        )}

        {platform === 'android' && (
          <ol className="space-y-3 text-sm text-[#2C2A29]" data-testid="android-instructions">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ backgroundColor: brandPrimary }}>1</span>
              <span>Tap the <strong>⋮ menu</strong> in the top-right of Chrome.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ backgroundColor: brandPrimary }}>2</span>
              <span>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ backgroundColor: brandPrimary }}>3</span>
              <span>Confirm — an icon appears on your home screen.</span>
            </li>
          </ol>
        )}

        {platform === 'desktop' && (
          <div className="space-y-3 text-sm text-[#706B68]" data-testid="desktop-instructions">
            <p>Open this link on your phone to add it to the home screen:</p>
            <div className="flex items-center gap-2 bg-[#FAF7F3] rounded-xl px-3 py-2.5">
              <code className="flex-1 text-[11px] text-[#2C2A29] font-mono truncate">{url}</code>
              <button onClick={() => { navigator.clipboard.writeText(url); toast.success('Link copied'); }} className="text-xs" style={{ color: brandPrimary }} data-testid="copy-homescreen-url">Copy</button>
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-[#F0EBE6] flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" style={{ color: brandPrimary }} strokeWidth={1.5} />
          <Link to="/my/bookings" className="text-xs font-medium hover:underline" style={{ color: brandPrimary }} data-testid="my-bookings-link">View my bookings →</Link>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Instant Rebooking — shown after a successful booking. Suggests an AI-picked
// interval and offers manual 4/6/8-week alternatives. One tap creates a
// follow-up appointment at the same time on the future date.
// ============================================================================
const RebookCard = ({ confirmationCode, brandPrimary, brandSecondary, isDark }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [chosenWeeks, setChosenWeeks] = useState(null);
  const [customWeeks, setCustomWeeks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // { weeks, next_date }
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await axios.get(`${API}/public/booking/${confirmationCode}/rebook-suggestions`);
        setData(r.data);
        setChosenWeeks(r.data.ai_suggestion_weeks);
      } catch {
        setData({ options: [] });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [confirmationCode]);

  const submit = async () => {
    const weeks = chosenWeeks === 'custom' ? parseInt(customWeeks, 10) : chosenWeeks;
    if (!weeks || weeks < 1 || weeks > 26) { toast.error('Pick between 1 and 26 weeks'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const r = await axios.post(`${API}/public/booking/${confirmationCode}/rebook`, { weeks });
      if (r.data.success) {
        setDone({ weeks, next_date: r.data.start_time });
        toast.success(`Locked in your next visit in ${weeks} weeks ✨`);
      } else {
        setError(r.data.reason === 'slot_taken' ? "That time is taken. Try a different interval." : 'Could not rebook');
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not rebook');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !data || !data.options?.length) return null;
  const cardBg = isDark ? '#141414' : '#fff';
  const accentBg = brandPrimary + '18';

  if (done) {
    return (
      <div
        className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 max-w-md mx-auto mt-6 text-left"
        style={{ background: cardBg, borderLeft: `3px solid ${brandPrimary}` }}
        data-testid="rebook-done-card"
      >
        <p className="text-[11px] tracking-[0.25em] uppercase font-semibold mb-2" style={{ color: brandPrimary }}>Next visit booked</p>
        <p className="font-['Cormorant_Garamond'] text-2xl font-light">{format(new Date(done.next_date), 'EEEE, MMMM d')}</p>
        <p className="text-xs text-[#9E948F] mt-1">at {format(new Date(done.next_date), 'h:mm a')} — confirmation will be emailed when approved.</p>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 max-w-md mx-auto mt-6 text-left"
      style={{ background: cardBg, borderLeft: `3px solid ${brandPrimary}` }}
      data-testid="rebook-card"
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4" strokeWidth={1.5} style={{ color: brandPrimary }} />
        <p className="text-[11px] tracking-[0.25em] uppercase font-semibold" style={{ color: brandPrimary }}>Plan your next visit</p>
      </div>
      <p className="font-['Cormorant_Garamond'] text-2xl font-light mb-1">Rebook in advance?</p>
      <p className="text-xs text-[#9E948F] mb-4">Bella suggests <strong style={{ color: brandPrimary }}>{data.ai_suggestion_weeks} weeks</strong> based on your treatment. Lock it in now while {data.staff_name} has the slot.</p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {data.options.map((opt) => {
          const isSel = chosenWeeks === opt.weeks;
          return (
            <button
              key={opt.weeks}
              type="button"
              onClick={() => setChosenWeeks(opt.weeks)}
              className="relative py-3 rounded-2xl text-center transition-all border-2"
              style={{
                background: isSel ? brandPrimary : accentBg,
                color: isSel ? (isDark ? '#0A0A0A' : '#fff') : 'inherit',
                borderColor: isSel ? brandPrimary : 'transparent',
              }}
              data-testid={`rebook-option-${opt.weeks}`}
            >
              {opt.is_ai_pick && (
                <span className="absolute -top-1.5 -right-1.5 text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-bold" style={{ background: brandPrimary, color: isDark ? '#0A0A0A' : '#fff' }}>AI</span>
              )}
              <p className="font-mono text-sm font-semibold">{opt.weeks}w</p>
              <p className="text-[10px] mt-0.5 opacity-80">{opt.display.split(',')[0]}</p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setChosenWeeks('custom')}
          className="text-[10px] uppercase tracking-wider font-medium hover:underline"
          style={{ color: brandPrimary }}
        >
          Custom interval
        </button>
        {chosenWeeks === 'custom' && (
          <Input
            type="number"
            min="1"
            max="26"
            placeholder="e.g. 10"
            value={customWeeks}
            onChange={(e) => setCustomWeeks(e.target.value)}
            className="h-8 w-24 text-xs rounded-full"
            data-testid="rebook-custom-weeks"
          />
        )}
        {chosenWeeks === 'custom' && customWeeks && <span className="text-[10px] text-[#9E948F]">weeks</span>}
      </div>

      {error && <p className="text-xs mb-2" style={{ color: brandPrimary }}>{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || !chosenWeeks}
        className="w-full h-11 rounded-full text-sm font-medium transition-all disabled:opacity-60 hover:shadow-lg"
        style={{ backgroundColor: brandPrimary, color: isDark ? '#0A0A0A' : '#fff' }}
        data-testid="rebook-confirm"
      >
        {submitting ? 'Booking…' : 'Book my next visit'}
      </button>
    </div>
  );
};

export default PublicBookingPage;
