import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Calendar } from '../../components/ui/calendar';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Clock, Check, MapPin, Phone, Users, Hourglass } from 'lucide-react';
import { format, addDays } from 'date-fns';
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#121212] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-4">Business not found</h1>
          <p className="text-[#666666]">Check the booking link and try again.</p>
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
  const headingStyle = { color: isDark ? accent : c.text, fontFamily: isDark ? "'Playfair Display', serif" : 'inherit' };
  const cardStyle = { backgroundColor: c.card, borderColor: c.border, color: c.text };
  const inputStyle = { backgroundColor: isDark ? c.backgroundSecondary : '#FFFFFF', borderColor: c.border, color: c.text };
  const today = page.today ? parseLocal(`${page.today}T00:00:00`) : new Date();
  const lastDay = addDays(today, settings.max_advance_days || 90);
  const steps = ['Service', 'Team member', 'Date & time', 'Your details', 'Done'];
  const staffLabel = (slot) => (selectedStaff?.staff_id === ANY ? slot?.staff_name : selectedStaff?.name);

  const backButton = (to, text) => (
    <button onClick={() => setStep(to)} className="flex items-center gap-2 text-sm mb-6" style={{ color: c.textSecondary }}>
      <ArrowLeft className="w-4 h-4" /> {text}
    </button>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: c.background, color: c.text }}>
      {/* Header */}
      <header style={{ backgroundColor: c.card, borderColor: c.border }} className="border-b px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {business.logo_url && <img src={business.logo_url} alt={business.name} className="h-12 w-auto max-w-[120px] object-contain" data-testid="booking-logo" />}
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate" style={headingStyle} data-testid="business-name">{business.name}</h1>
              <div className="flex flex-wrap gap-x-4 text-sm mt-1" style={{ color: c.textSecondary }}>
                {business.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{business.address}</span>}
                {business.phone && <a href={`tel:${business.phone}`} className="flex items-center gap-1"><Phone className="w-3 h-3" />{business.phone}</a>}
              </div>
            </div>
          </div>
          {business.branding?.show_powered_by !== false && (
            <a href="/" className="hidden sm:inline text-xs px-3 py-1 border whitespace-nowrap" style={{ color: c.textSecondary, borderColor: c.border }}>
              Powered by BookSlot
            </a>
          )}
        </div>
      </header>

      {!settings.online_booking_enabled ? (
        <main className="max-w-2xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold mb-3" style={headingStyle}>Online booking is paused</h2>
          <p style={{ color: c.textSecondary }}>
            Please contact {business.name}{business.phone ? ` on ${business.phone}` : ''}{business.email ? ` or ${business.email}` : ''} to book.
          </p>
        </main>
      ) : (
        <>
          {/* Progress */}
          <div style={{ backgroundColor: c.card, borderColor: c.border }} className="border-b px-4 sm:px-6 py-3">
            <div className="max-w-2xl mx-auto flex items-center gap-2">
              {steps.map((label, idx) => (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-2" style={{ color: step >= idx + 1 ? c.text : c.textSecondary }}>
                    <div className="w-6 h-6 flex items-center justify-center text-xs font-medium"
                      style={{ backgroundColor: step >= idx + 1 ? accent : c.border, color: step >= idx + 1 ? onAccent : c.textSecondary }}>
                      {step > idx + 1 ? <Check className="w-3 h-3" /> : idx + 1}
                    </div>
                    <span className="text-sm hidden md:inline">{label}</span>
                  </div>
                  {idx < steps.length - 1 && <div className="flex-1 h-px" style={{ backgroundColor: step > idx + 1 ? accent : c.border }} />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
            {/* Step 1: Service */}
            {step === 1 && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-semibold mb-6" style={headingStyle} data-testid="step-title">Select a service</h2>
                {business.description && <p className="mb-6" style={{ color: c.textSecondary }}>{business.description}</p>}
                {page.services.length === 0 && <p style={{ color: c.textSecondary }}>No services are available to book online yet.</p>}
                <div className="space-y-3">
                  {page.services.map((service) => (
                    <button key={service.service_id} onClick={() => chooseService(service)}
                      className="w-full p-4 text-left flex justify-between items-center gap-4 border transition-opacity hover:opacity-90"
                      style={cardStyle} data-testid={`service-${service.service_id}`}>
                      <div>
                        <h3 className="font-medium">{service.name}</h3>
                        {service.description && <p className="text-sm mt-1" style={{ color: c.textSecondary }}>{service.description}</p>}
                        <p className="text-sm flex items-center gap-2 mt-1" style={{ color: c.textSecondary }}>
                          <Clock className="w-3 h-3" /> {service.duration} min
                        </p>
                      </div>
                      <p className="font-semibold whitespace-nowrap" style={{ color: accent }}>{formatMoney(service.price, currency)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Staff */}
            {step === 2 && (
              <div className="animate-fade-in">
                {backButton(1, 'Back to services')}
                <h2 className="text-2xl font-semibold mb-6" style={headingStyle}>Who would you like?</h2>
                {eligibleStaff.length === 0 ? (
                  <p style={{ color: c.textSecondary }}>Sorry, nobody is currently available for this service.</p>
                ) : (
                  <div className="space-y-3">
                    {eligibleStaff.length > 1 && (
                      <button onClick={() => chooseStaff({ staff_id: ANY, name: 'Any available' })}
                        className="w-full p-4 text-left flex items-center gap-4 border" style={cardStyle} data-testid="staff-any">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: c.backgroundSecondary }}>
                          <Users className="w-5 h-5" style={{ color: accent }} />
                        </div>
                        <div>
                          <h3 className="font-medium">Any available</h3>
                          <p className="text-sm" style={{ color: c.textSecondary }}>See the most times</p>
                        </div>
                      </button>
                    )}
                    {eligibleStaff.map((member) => (
                      <button key={member.staff_id} onClick={() => chooseStaff(member)}
                        className="w-full p-4 text-left flex items-center gap-4 border" style={cardStyle} data-testid={`staff-${member.staff_id}`}>
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.name} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full flex items-center justify-center font-medium" style={{ backgroundColor: accent, color: onAccent }}>
                            {member.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="font-medium">{member.name}</h3>
                          {member.title && <p className="text-sm" style={{ color: c.textSecondary }}>{member.title}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Date & time */}
            {step === 3 && (
              <div className="animate-fade-in">
                {backButton(eligibleStaff.length > 1 ? 2 : 1, 'Back')}
                <h2 className="text-2xl font-semibold mb-2" style={headingStyle}>Select date & time</h2>
                <p className="text-sm mb-6" style={{ color: c.textSecondary }}>
                  {selectedService?.name} · {selectedStaff?.staff_id === ANY ? 'any team member' : `with ${selectedStaff?.name}`}
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-2 sm:p-4 border bg-white text-[#0A0A0A]" style={{ borderColor: c.border }}>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => d && setSelectedDate(d)}
                      month={month}
                      onMonthChange={setMonth}
                      fromDate={today}
                      toDate={lastDay}
                      disabled={(date) => {
                        if (date < today || date > lastDay) return true;
                        if (!availableDates) return false;
                        return !availableDates.has(format(date, 'yyyy-MM-dd'));
                      }}
                      className="w-full"
                      data-testid="booking-calendar"
                    />
                    {availableDates && availableDates.size === 0 && (
                      <p className="text-xs text-center text-[#666666] pb-2">No free times this month - try the next month.</p>
                    )}
                  </div>
                  <div className="p-4 border" style={cardStyle}>
                    <h3 className="font-medium mb-4">{selectedDate ? format(selectedDate, 'EEEE d MMMM') : 'Pick a date'}</h3>
                    {!selectedDate && <p className="text-sm" style={{ color: c.textSecondary }}>Choose a highlighted day to see available times.</p>}
                    {selectedDate && slotsLoading && <p className="text-sm" style={{ color: c.textSecondary }}>Loading times...</p>}
                    {selectedDate && !slotsLoading && availableSlots.length === 0 && (
                      <p className="text-sm" style={{ color: c.textSecondary }}>No times left on this day. Please choose another day.</p>
                    )}
                    {selectedDate && !slotsLoading && availableSlots.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                        {availableSlots.map((slot) => {
                          const isSelected = selectedSlot?.start_time === slot.start_time;
                          return (
                            <button key={slot.start_time} onClick={() => setSelectedSlot(slot)}
                              className="py-2 px-2 text-sm font-mono border transition-colors"
                              style={isSelected ? { backgroundColor: accent, color: onAccent, borderColor: accent } : { borderColor: c.border, color: c.text }}
                              data-testid={`slot-${slot.start_time.slice(11, 16)}`}>
                              {slot.start_time.slice(11, 16)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {selectedSlot && (
                      <Button onClick={() => setStep(4)} className="w-full mt-6 flex items-center justify-center gap-2"
                        style={{ backgroundColor: accent, color: onAccent }} data-testid="continue-to-details">
                        Continue <ArrowRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Details */}
            {step === 4 && selectedSlot && (
              <div className="animate-fade-in">
                {backButton(3, 'Back to date & time')}
                <h2 className="text-2xl font-semibold mb-6" style={headingStyle}>Your details</h2>
                <div className="p-4 border mb-6" style={cardStyle}>
                  <p className="text-xs font-medium mb-2" style={{ color: c.textSecondary }}>BOOKING SUMMARY</p>
                  <p className="font-semibold">{selectedService?.name}</p>
                  <p className="text-sm" style={{ color: c.textSecondary }}>with {staffLabel(selectedSlot) || 'our team'} · {selectedService?.duration} min</p>
                  <p className="text-sm" style={{ color: c.textSecondary }}>
                    {format(parseLocal(selectedSlot.start_time), 'EEEE d MMMM yyyy')} at {selectedSlot.start_time.slice(11, 16)}
                  </p>
                  <p className="font-semibold mt-2" style={{ color: accent }}>{formatMoney(selectedService?.price, currency)}</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium" style={{ color: c.text }}>Full name *</Label>
                    <Input id="name" value={clientName} onChange={(e) => setClientName(e.target.value)} required autoComplete="name"
                      className="mt-1.5" style={inputStyle} data-testid="client-name" />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium" style={{ color: c.text }}>Email {settings.require_email ? '*' : '(optional)'}</Label>
                    <Input id="email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                      required={!!settings.require_email} autoComplete="email" className="mt-1.5" style={inputStyle} data-testid="client-email" />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium" style={{ color: c.text }}>Phone {settings.require_phone ? '*' : '(optional)'}</Label>
                    <Input id="phone" type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                      required={!!settings.require_phone} autoComplete="tel" className="mt-1.5" style={inputStyle} data-testid="client-phone" />
                  </div>

                  {relevantForms.map((form) => (
                    <div key={form.form_id} className="pt-2 space-y-4">
                      <div>
                        <p className="font-medium">{form.name}</p>
                        {form.description && <p className="text-sm" style={{ color: c.textSecondary }}>{form.description}</p>}
                      </div>
                      {form.fields.map((field) => (
                        <FormFieldInput key={field.field_id} field={field} value={answers[field.field_id]}
                          onChange={(v) => setAnswers((a) => ({ ...a, [field.field_id]: v }))} style={inputStyle} textColor={c.text} />
                      ))}
                    </div>
                  ))}

                  <div>
                    <Label htmlFor="notes" className="text-sm font-medium" style={{ color: c.text }}>Notes for the team (optional)</Label>
                    <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000}
                      className="mt-1.5 w-full border px-3 py-2 text-sm resize-none" style={inputStyle} data-testid="client-notes" />
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2"
                    style={{ backgroundColor: accent, color: onAccent }} data-testid="confirm-booking">
                    {submitting ? 'Booking...' : 'Confirm booking'}
                    {!submitting && <Check className="w-4 h-4" />}
                  </Button>
                  <p className="text-xs text-center" style={{ color: c.textSecondary }}>
                    Your details are shared only with {business.name} to manage your appointment.
                  </p>
                </form>
              </div>
            )}

            {/* Step 5: Confirmation */}
            {step === 5 && confirmation && (
              <div className="animate-fade-in text-center">
                {confirmation.status === 'pending_approval' ? (
                  <>
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Hourglass className="w-8 h-8 text-amber-600" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2" style={headingStyle} data-testid="confirmation-title">Request received</h2>
                    <p className="mb-8" style={{ color: c.textSecondary }}>
                      {business.name} will review your request and confirm it shortly{clientEmail ? ` by email to ${clientEmail}` : ''}.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Check className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2" style={headingStyle} data-testid="confirmation-title">You're booked!</h2>
                    <p className="mb-8" style={{ color: c.textSecondary }}>
                      {clientEmail ? `A confirmation has been sent to ${clientEmail}.` : 'Save your confirmation code below.'}
                    </p>
                  </>
                )}
                <div className="text-left mb-8 p-4 border" style={cardStyle}>
                  <p className="font-semibold">{confirmation.service_name}</p>
                  <p className="text-sm" style={{ color: c.textSecondary }}>with {confirmation.staff_name}</p>
                  <p className="text-sm" style={{ color: c.textSecondary }}>
                    {format(parseLocal(confirmation.appointment.start_time), 'EEEE d MMMM yyyy')} at {confirmation.appointment.start_time.slice(11, 16)}
                  </p>
                  <div className="pt-4 border-t mt-4" style={{ borderColor: c.border }}>
                    <p className="text-sm" style={{ color: c.textSecondary }}>Confirmation code</p>
                    <p className="font-mono font-semibold break-all">{confirmation.confirmation_code}</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link to={`/booking/${confirmation.confirmation_code}`} className="text-sm underline" style={{ color: accent }} data-testid="manage-booking-link">
                    View or cancel this booking
                  </Link>
                  <button onClick={() => { setStep(1); setConfirmation(null); setSelectedSlot(null); setSelectedDate(null); }}
                    className="text-sm underline" style={{ color: c.textSecondary }}>
                    Book something else
                  </button>
                </div>
              </div>
            )}
          </main>
        </>
      )}

      {business.ai_chat_enabled && <BookingChatWidget slug={slug} businessName={business.name} accent={accent} />}
    </div>
  );
};

const FormFieldInput = ({ field, value, onChange, style, textColor }) => {
  const label = (
    <Label className="text-sm font-medium" style={{ color: textColor }}>{field.label}{field.required ? ' *' : ''}</Label>
  );
  if (field.field_type === 'textarea') {
    return (<div>{label}<textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={field.placeholder || ''}
      className="mt-1.5 w-full border px-3 py-2 text-sm resize-none" style={style} /></div>);
  }
  if (field.field_type === 'select') {
    return (<div>{label}<select value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full border px-3 py-2 text-sm" style={style}>
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
    className="mt-1.5" style={style} /></div>);
};

export default PublicBookingPage;
