import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Calendar } from '../../components/ui/calendar';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Clock, Check, MapPin, Sparkles, User } from 'lucide-react';
import { format, addMinutes } from 'date-fns';

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

  // Tenant branding
  const brandPrimary = business?.branding?.primary_color || '#B8868B';
  const brandSecondary = business?.branding?.secondary_color || '#E8C5C8';

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
    <div className="min-h-screen" style={{ background: `linear-gradient(180deg, ${brandSecondary}22 0%, #FAF7F3 40%)` }}>
      {/* Hero Header */}
      <header className="pt-12 pb-10 px-6">
        <div className="max-w-3xl mx-auto text-center">
          {business.logo_url ? (
            <img src={business.logo_url} alt={business.name} className="h-16 mx-auto mb-6 rounded-2xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: brandPrimary }}>
              <Sparkles className="w-7 h-7 text-white" strokeWidth={1.5} />
            </div>
          )}
          <p className="text-[11px] tracking-[0.3em] uppercase font-medium mb-2" style={{ color: brandPrimary }}>Book Your Visit</p>
          <h1 className="font-['Cormorant_Garamond'] text-5xl sm:text-6xl font-light text-[#2C2A29] mb-3" data-testid="business-name">{business.name}</h1>
          {business.address && (
            <p className="text-sm text-[#706B68] flex items-center gap-1.5 justify-center">
              <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
              {business.address}
            </p>
          )}
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
                {submitting ? 'Submitting…' : 'Confirm Booking'}
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

export default PublicBookingPage;
