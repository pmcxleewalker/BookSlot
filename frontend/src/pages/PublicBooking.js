import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, addDays, startOfDay } from 'date-fns';
import { 
  Calendar as CalendarIcon, Clock, User, ArrowRight, ArrowLeft, Check,
  Mail, Phone, FileText, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Calendar } from '../components/ui/calendar';
import { publicAPI } from '../lib/api';
import { toast } from 'sonner';

export default function PublicBooking() {
  const { tenantSlug } = useParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tenant, setTenant] = useState(null);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const [booking, setBooking] = useState({
    service: null,
    staff: null,
    date: startOfDay(new Date()),
    time: null,
    slot: null,
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    notes: '',
  });

  useEffect(() => {
    loadServices();
  }, [tenantSlug]);

  useEffect(() => {
    if (booking.service) {
      loadStaff();
    }
  }, [booking.service]);

  useEffect(() => {
    if (booking.service && booking.date) {
      loadAvailability();
    }
  }, [booking.service, booking.date, booking.staff]);

  const loadServices = async () => {
    try {
      const data = await publicAPI.getServices(tenantSlug);
      setTenant(data.tenant);
      setServices(data.services);
    } catch (error) {
      toast.error('Business not found');
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    try {
      const data = await publicAPI.getStaff(tenantSlug, booking.service?.service_id);
      setStaff(data);
    } catch (error) {
      console.error('Failed to load staff:', error);
    }
  };

  const loadAvailability = async () => {
    setSlotsLoading(true);
    try {
      const dateStr = format(booking.date, 'yyyy-MM-dd');
      const data = await publicAPI.getAvailability(
        tenantSlug,
        booking.service.service_id,
        dateStr,
        booking.staff?.staff_id
      );
      setSlots(data.slots || []);
    } catch (error) {
      console.error('Failed to load availability:', error);
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!booking.slot) {
      toast.error('Please select a time slot');
      return;
    }

    setSubmitting(true);
    try {
      const result = await publicAPI.createBooking(tenantSlug, {
        service_id: booking.service.service_id,
        staff_id: booking.slot.staff_id,
        start_time: booking.slot.start_time,
        client_name: booking.clientName,
        client_email: booking.clientEmail,
        client_phone: booking.clientPhone,
        notes: booking.notes,
      });
      setConfirmation(result);
      setStep(5);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#2E473B]/20 border-t-[#2E473B] rounded-full animate-spin" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1C1C1C] mb-2">Business Not Found</h1>
          <p className="text-[#6B6B6B]">The booking page you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Get branding colors with defaults
  const branding = tenant.branding || {};
  const primaryColor = branding.primary_color || '#2E473B';
  const secondaryColor = branding.secondary_color || '#C26A58';
  const backgroundColor = branding.background_color || '#FAF9F6';
  const textColor = branding.text_color || '#1C1C1C';
  const fontFamily = branding.font_family || 'Inter';
  const showPoweredBy = branding.show_powered_by !== false;

  return (
    <div className="min-h-screen" style={{ backgroundColor, fontFamily }}>
      {/* Header */}
      <header className="bg-white border-b border-[#E5E5E0] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {tenant.logo_url ? (
                <img src={tenant.logo_url} alt={tenant.name} className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {tenant.name?.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold" style={{ fontFamily: 'Outfit', color: textColor }}>
                  {tenant.name}
                </h1>
                <p className="text-sm text-[#6B6B6B]">Book an appointment</p>
              </div>
            </div>
            {/* Progress */}
            <div className="hidden sm:flex items-center gap-1">
              {['Service', 'Date', 'Time', 'Details'].map((label, i) => (
                <div key={label} className="flex items-center">
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                    style={{
                      backgroundColor: i + 1 <= step ? primaryColor : '#E5E5E0',
                      color: i + 1 <= step ? 'white' : '#6B6B6B'
                    }}
                  >
                    {i + 1 < step ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  {i < 3 && (
                    <div 
                      className="w-8 h-0.5"
                      style={{ backgroundColor: i + 1 < step ? primaryColor : '#E5E5E0' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Step 1: Select Service */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h2 className="text-2xl font-bold text-[#1C1C1C] mb-6" style={{ fontFamily: 'Outfit' }}>
              Select a service
            </h2>
            
            {services.length === 0 ? (
              <div className="text-center py-12 px-6 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No services available yet</h3>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  This business is still setting up their booking page. Please check back soon or contact them directly.
                </p>
                {tenant?.email && (
                  <a 
                    href={`mailto:${tenant.email}`}
                    className="inline-flex items-center gap-2 mt-4 text-sm text-gray-700 hover:text-gray-900"
                  >
                    <Mail className="w-4 h-4" />
                    {tenant.email}
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {services.map((service) => (
                  <button
                    key={service.service_id}
                    onClick={() => {
                      setBooking({ ...booking, service });
                      setStep(2);
                    }}
                    className={`w-full p-4 rounded-xl border text-left transition-all hover:border-[#2E473B]/30 ${
                      booking.service?.service_id === service.service_id
                        ? 'border-[#2E473B] bg-[#2E473B]/5'
                        : 'border-[#E5E5E0] bg-white'
                    }`}
                    data-testid={`service-${service.service_id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-[#1C1C1C]">{service.name}</h3>
                        {service.description && (
                          <p className="text-sm text-[#6B6B6B] mt-1">{service.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-[#6B6B6B]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {service.duration} min
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-semibold text-[#1C1C1C]">
                          €{service.price}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Step 2: Select Date */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-[#6B6B6B] hover:text-[#1C1C1C] mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <h2 className="text-2xl font-bold text-[#1C1C1C] mb-2" style={{ fontFamily: 'Outfit' }}>
              Select a date
            </h2>
            <p className="text-[#6B6B6B] mb-6">
              Booking: {booking.service?.name}
            </p>

            {/* Optional Staff Selection */}
            {staff.length > 0 && (
              <div className="mb-6">
                <Label className="text-[#1C1C1C] mb-2 block">Select staff</Label>
                <div className="flex flex-wrap gap-2">
                  {staff.map((s) => (
                    <button
                      key={s.staff_id}
                      onClick={() => setBooking({ ...booking, staff: s.is_any ? null : s })}
                      className={`px-4 py-2 rounded-full text-sm transition-colors ${
                        (s.is_any && !booking.staff) || booking.staff?.staff_id === s.staff_id
                          ? 'bg-[#2E473B] text-white'
                          : 'bg-white border border-[#E5E5E0] text-[#6B6B6B] hover:border-[#2E473B]/30'
                      }`}
                      data-testid={`staff-${s.staff_id}`}
                    >
                      {s.name}
                      {s.is_any && <span className="ml-1 opacity-70">⚡</span>}
                    </button>
                  ))}
                </div>
                {staff.length === 1 && !staff[0].is_any && (
                  <p className="text-sm text-[#6B6B6B] mt-2">
                    Booking with {staff[0].name}
                  </p>
                )}
              </div>
            )}

            <div className="bg-white rounded-xl border border-[#E5E5E0] p-4">
              <Calendar
                mode="single"
                selected={booking.date}
                onSelect={(date) => {
                  if (date) {
                    setBooking({ ...booking, date, slot: null });
                    setStep(3);
                  }
                }}
                disabled={(date) => date < startOfDay(new Date())}
                className="rounded-md"
              />
            </div>
          </motion.div>
        )}

        {/* Step 3: Select Time */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 text-[#6B6B6B] hover:text-[#1C1C1C] mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <h2 className="text-2xl font-bold text-[#1C1C1C] mb-2" style={{ fontFamily: 'Outfit' }}>
              Select a time
            </h2>
            <p className="text-[#6B6B6B] mb-6">
              {format(booking.date, 'EEEE, MMMM d, yyyy')}
            </p>

            {slotsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-[#2E473B]/20 border-t-[#2E473B] rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-[#E5E5E0]">
                <CalendarIcon className="w-12 h-12 text-[#E5E5E0] mx-auto mb-4" />
                <p className="text-[#6B6B6B]">No available times on this date</p>
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="mt-4"
                >
                  Choose another date
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {slots.map((slot, index) => {
                  const time = new Date(slot.start_time);
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        setBooking({ ...booking, slot });
                        setStep(4);
                      }}
                      className={`time-slot ${
                        booking.slot === slot ? 'time-slot-selected' : ''
                      }`}
                      data-testid={`slot-${index}`}
                    >
                      <div className="font-medium">{format(time, 'h:mm a')}</div>
                      <div className="text-xs opacity-70">{slot.staff_name}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Step 4: Client Details */}
        {step === 4 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 text-[#6B6B6B] hover:text-[#1C1C1C] mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <h2 className="text-2xl font-bold text-[#1C1C1C] mb-2" style={{ fontFamily: 'Outfit' }}>
              Your details
            </h2>
            <p className="text-[#6B6B6B] mb-6">
              Almost done! Enter your contact information.
            </p>

            {/* Booking Summary */}
            <div className="bg-[#2E473B]/5 rounded-xl p-4 mb-6">
              <h3 className="font-medium text-[#1C1C1C] mb-3">Booking Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#6B6B6B]">Service</span>
                  <span className="text-[#1C1C1C]">{booking.service?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B6B]">Date</span>
                  <span className="text-[#1C1C1C]">{format(booking.date, 'EEE, MMM d')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B6B]">Time</span>
                  <span className="text-[#1C1C1C]">
                    {booking.slot && format(new Date(booking.slot.start_time), 'h:mm a')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B6B]">With</span>
                  <span className="text-[#1C1C1C]">{booking.slot?.staff_name}</span>
                </div>
                <div className="border-t border-[#E5E5E0] pt-2 mt-2 flex justify-between font-medium">
                  <span className="text-[#1C1C1C]">Total</span>
                  <span className="text-[#1C1C1C]">€{booking.service?.price}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-[#1C1C1C]">Your Name *</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6B6B]" />
                  <Input
                    id="name"
                    value={booking.clientName}
                    onChange={(e) => setBooking({ ...booking, clientName: e.target.value })}
                    placeholder="John Doe"
                    className="pl-10 h-12 rounded-xl border-[#E5E5E0]"
                    required
                    data-testid="client-name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="text-[#1C1C1C]">Email *</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6B6B]" />
                  <Input
                    id="email"
                    type="email"
                    value={booking.clientEmail}
                    onChange={(e) => setBooking({ ...booking, clientEmail: e.target.value })}
                    placeholder="you@example.com"
                    className="pl-10 h-12 rounded-xl border-[#E5E5E0]"
                    required
                    data-testid="client-email"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone" className="text-[#1C1C1C]">Phone (optional)</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6B6B]" />
                  <Input
                    id="phone"
                    type="tel"
                    value={booking.clientPhone}
                    onChange={(e) => setBooking({ ...booking, clientPhone: e.target.value })}
                    placeholder="+1 234 567 8900"
                    className="pl-10 h-12 rounded-xl border-[#E5E5E0]"
                    data-testid="client-phone"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes" className="text-[#1C1C1C]">Notes (optional)</Label>
                <div className="relative mt-1">
                  <Textarea
                    id="notes"
                    value={booking.notes}
                    onChange={(e) => setBooking({ ...booking, notes: e.target.value })}
                    placeholder="Any special requests..."
                    className="rounded-xl border-[#E5E5E0] min-h-[100px]"
                    data-testid="client-notes"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!booking.clientName || !booking.clientEmail || submitting}
              className="w-full h-12 rounded-xl text-white mt-6"
              style={{ backgroundColor: primaryColor }}
              data-testid="confirm-booking-btn"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Confirm Booking
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </motion.div>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && confirmation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="booking-confirmation">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: primaryColor }}
              >
                <Check className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Outfit', color: textColor }}>
                Booking Confirmed!
              </h2>
              <p className="text-[#6B6B6B] mb-6">
                A confirmation email has been sent to {booking.clientEmail}
              </p>

              <div className="bg-white rounded-xl p-6 text-left mb-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-[#6B6B6B]">Service</span>
                    <span className="font-medium" style={{ color: textColor }}>{confirmation.service_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B6B6B]">With</span>
                    <span className="font-medium" style={{ color: textColor }}>{confirmation.staff_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B6B6B]">Date & Time</span>
                    <span className="font-medium" style={{ color: textColor }}>
                      {format(new Date(confirmation.start_time), 'EEE, MMM d @ h:mm a')}
                    </span>
                  </div>
                  <div className="border-t border-[#E5E5E0] pt-3 mt-3">
                    <div className="flex justify-between">
                      <span className="text-[#6B6B6B]">Confirmation Code</span>
                      <span className="font-mono font-bold" style={{ color: primaryColor }}>
                        {confirmation.confirmation_code}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Link to={`/manage/${confirmation.appointment_id}`}>
                <Button variant="outline" className="rounded-xl">
                  Manage Booking
                </Button>
              </Link>
              
              {showPoweredBy && (
                <p className="text-xs text-[#6B6B6B] mt-6">Powered by TimeSlot Pro</p>
              )}
            </div>
          </motion.div>
        )}
      </main>
      
      {/* Footer with Powered By */}
      {showPoweredBy && step !== 5 && (
        <footer className="py-4 text-center">
          <p className="text-xs text-[#6B6B6B]">Powered by TimeSlot Pro</p>
        </footer>
      )}
    </div>
  );
}
