import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Calendar } from '../../components/ui/calendar';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Clock, User, Check, MapPin, Phone } from 'lucide-react';
import { format, addMinutes } from 'date-fns';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Elite by Caitlin logo
const ELITE_LOGO = 'https://customer-assets.emergentagent.com/job_b51cdde9-aca8-4bc9-8629-803189777585/artifacts/nyi83tyj_image.png';

const PublicBookingPage = () => {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [business, setBusiness] = useState(null);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  
  // Booking selections
  const [selectedService, setSelectedService] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  
  // Client info
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  
  // Confirmation
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    fetchBusinessData();
  }, [slug]);

  useEffect(() => {
    if (selectedService && selectedStaff && selectedDate) {
      fetchAvailability();
    }
  }, [selectedService, selectedStaff, selectedDate]);

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
        params: {
          service_id: selectedService.service_id,
          staff_id: selectedStaff.staff_id,
          date: dateStr
        }
      });
      setAvailableSlots(response.data.slots);
    } catch (error) {
      toast.error('Failed to load availability');
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!clientName || !clientEmail) {
      toast.error('Please fill in your details');
      return;
    }

    setSubmitting(true);
    try {
      const service = selectedService;
      const endTime = addMinutes(new Date(selectedSlot.start_time), service.duration);

      const response = await axios.post(`${API}/public/booking/${slug}/book`, {
        service_id: service.service_id,
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
      toast.success('Booking confirmed!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to book appointment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-[#666666]">Loading...</div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-4">Business not found</h1>
          <Link to="/" className="text-[#4F46E5] hover:underline">Go to homepage</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <header className="bg-[#141414] border-b border-[#2A2A2A] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={ELITE_LOGO} alt="Elite by Caitlin" className="h-14 w-auto" data-testid="booking-logo" />
            <div>
              <h1 className="text-xl font-semibold text-[#D4AF37]" style={{ fontFamily: "'Playfair Display', serif" }} data-testid="business-name">{business.name}</h1>
              {business.address && (
                <p className="text-sm text-[#B8B8B8] flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  {business.address}
                </p>
              )}
            </div>
          </div>
          <span className="text-xs text-[#666666] px-3 py-1 bg-[#0A0A0A] border border-[#2A2A2A]">
            Powered by BookSlot
          </span>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-[#141414] border-b border-[#2A2A2A] px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            {['Service', 'Staff', 'Date & Time', 'Details', 'Confirmed'].map((label, idx) => (
              <React.Fragment key={idx}>
                <div className={`flex items-center gap-2 ${step > idx + 1 ? 'text-white' : step === idx + 1 ? 'text-white' : 'text-[#666666]'}`}>
                  <div className={`w-6 h-6 flex items-center justify-center text-xs font-medium ${step > idx + 1 ? 'bg-[#D4AF37] text-[#0A0A0A]' : step === idx + 1 ? 'bg-[#D4AF37] text-[#0A0A0A]' : 'bg-[#2A2A2A] text-[#666666]'}`}>
                    {step > idx + 1 ? <Check className="w-3 h-3" /> : idx + 1}
                  </div>
                  <span className="text-sm hidden sm:inline">{label}</span>
                </div>
                {idx < 4 && <div className={`flex-1 h-px ${step > idx + 1 ? 'bg-[#D4AF37]' : 'bg-[#2A2A2A]'}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Step 1: Select Service */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-semibold text-[#D4AF37] mb-6" style={{ fontFamily: "'Playfair Display', serif" }} data-testid="step-title">Select a service</h2>
            <div className="space-y-3">
              {services.map((service) => (
                <button
                  key={service.service_id}
                  onClick={() => {
                    setSelectedService(service);
                    setStep(2);
                  }}
                  className="w-full bg-[#141414] border border-[#2A2A2A] p-4 text-left flex justify-between items-center hover:border-[#D4AF37] transition-colors"
                  data-testid={`service-${service.service_id}`}
                >
                  <div>
                    <h3 className="font-medium text-white">{service.name}</h3>
                    <p className="text-sm text-[#B8B8B8] flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3" />
                      {service.duration} min
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#D4AF37]">€{service.price}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Staff */}
        {step === 2 && (
          <div className="animate-fade-in">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 text-sm text-[#B8B8B8] hover:text-[#D4AF37] mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to services
            </button>
            <h2 className="text-2xl font-semibold text-[#D4AF37] mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>Select a team member</h2>
            <div className="space-y-3">
              {staff.map((member) => (
                <button
                  key={member.staff_id}
                  onClick={() => {
                    setSelectedStaff(member);
                    setStep(3);
                  }}
                  className="w-full bg-[#141414] border border-[#2A2A2A] p-4 text-left flex items-center gap-4 hover:border-[#D4AF37] transition-colors"
                  data-testid={`staff-${member.staff_id}`}
                >
                  <div className="w-12 h-12 bg-[#D4AF37] rounded-full flex items-center justify-center text-[#0A0A0A] font-medium">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{member.name}</h3>
                    {member.title && <p className="text-sm text-[#B8B8B8]">{member.title}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Select Date & Time */}
        {step === 3 && (
          <div className="animate-fade-in">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 text-sm text-[#B8B8B8] hover:text-[#D4AF37] mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to staff
            </button>
            <h2 className="text-2xl font-semibold text-[#D4AF37] mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>Select date & time</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[#141414] border border-[#2A2A2A] p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date() || date.getDay() === 0}
                  className="w-full"
                  data-testid="booking-calendar"
                />
              </div>

              <div className="bg-[#141414] border border-[#2A2A2A] p-4">
                <h3 className="font-medium text-white mb-4">
                  {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a date'}
                </h3>
                
                {!selectedDate && (
                  <p className="text-[#B8B8B8] text-sm">Please select a date to see available times</p>
                )}

                {selectedDate && slotsLoading && (
                  <p className="text-[#B8B8B8] text-sm">Loading available times...</p>
                )}

                {selectedDate && !slotsLoading && availableSlots.length === 0 && (
                  <p className="text-[#B8B8B8] text-sm">No available times for this date</p>
                )}

                {selectedDate && !slotsLoading && availableSlots.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                    {availableSlots.map((slot, idx) => {
                      const time = new Date(slot.start_time);
                      const timeStr = format(time, 'h:mm a');
                      const isSelected = selectedSlot?.start_time === slot.start_time;
                      
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 px-3 text-sm font-mono border transition-colors ${
                            isSelected 
                              ? 'bg-[#121212] text-white border-[#121212]' 
                              : 'border-[#E5E5E5] hover:border-[#121212]'
                          }`}
                          data-testid={`slot-${idx}`}
                        >
                          {timeStr}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedSlot && (
                  <Button
                    onClick={() => setStep(4)}
                    className="w-full btn-primary mt-6 flex items-center justify-center gap-2"
                    data-testid="continue-to-details"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Enter Details */}
        {step === 4 && (
          <div className="animate-fade-in">
            <button onClick={() => setStep(3)} className="flex items-center gap-2 text-sm text-[#666666] hover:text-[#0A0A0A] mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to date & time
            </button>
            <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-6">Your details</h2>

            {/* Summary */}
            <div className="card-flat mb-6">
              <h3 className="text-sm font-medium text-[#666666] mb-3">BOOKING SUMMARY</h3>
              <div className="space-y-2">
                <p className="text-[#0A0A0A]"><strong>{selectedService?.name}</strong></p>
                <p className="text-sm text-[#666666]">with {selectedStaff?.name}</p>
                <p className="text-sm text-[#666666]">
                  {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')} at {selectedSlot && format(new Date(selectedSlot.start_time), 'h:mm a')}
                </p>
                <p className="font-semibold text-[#0A0A0A] mt-2">€{selectedService?.price}</p>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-[#0A0A0A]">Full name *</Label>
                <Input
                  id="name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                  className="mt-1.5 input-swiss"
                  data-testid="client-name"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-medium text-[#0A0A0A]">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  required
                  className="mt-1.5 input-swiss"
                  data-testid="client-email"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-medium text-[#0A0A0A]">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="mt-1.5 input-swiss"
                  data-testid="client-phone"
                />
              </div>

              <div>
                <Label htmlFor="notes" className="text-sm font-medium text-[#0A0A0A]">Notes (optional)</Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1.5 input-swiss resize-none"
                  data-testid="client-notes"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full btn-accent flex items-center justify-center gap-2"
                data-testid="confirm-booking"
              >
                {submitting ? 'Confirming...' : 'Confirm Booking'}
                {!submitting && <Check className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && confirmation && (
          <div className="animate-fade-in text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-2" data-testid="confirmation-title">Booking Confirmed!</h2>
            <p className="text-[#666666] mb-8">A confirmation email has been sent to {clientEmail}</p>

            <div className="card-flat text-left mb-8">
              <h3 className="text-sm font-medium text-[#666666] mb-3">BOOKING DETAILS</h3>
              <div className="space-y-2">
                <p className="text-[#0A0A0A]"><strong>{selectedService?.name}</strong></p>
                <p className="text-sm text-[#666666]">with {selectedStaff?.name}</p>
                <p className="text-sm text-[#666666]">
                  {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')} at {selectedSlot && format(new Date(selectedSlot.start_time), 'h:mm a')}
                </p>
                <div className="pt-4 border-t border-[#E5E5E5] mt-4">
                  <p className="text-sm text-[#666666]">Confirmation code</p>
                  <p className="font-mono font-semibold text-[#0A0A0A]">{confirmation.confirmation_code}</p>
                </div>
              </div>
            </div>

            <Link
              to={`/booking/${confirmation.confirmation_code}`}
              className="text-[#4F46E5] hover:underline text-sm"
              data-testid="manage-booking-link"
            >
              Manage your booking →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicBookingPage;
