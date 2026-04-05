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

  const [bookingError, setBookingError] = useState(null);

  const handleSubmit = async () => {
    if (!clientName || !clientEmail) {
      toast.error('Please fill in your details');
      return;
    }

    setSubmitting(true);
    setBookingError(null);
    
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
      toast.success(response.data.message || 'Booking request submitted!');
    } catch (error) {
      const errorData = error.response?.data?.detail;
      
      if (typeof errorData === 'object' && errorData.reason) {
        // Smart error with suggestions
        setBookingError(errorData);
        toast.error(errorData.message);
      } else {
        toast.error(errorData || 'Failed to book appointment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectAlternativeStaff = (altStaff) => {
    setSelectedStaff(altStaff);
    setBookingError(null);
    toast.success(`Selected ${altStaff.name}`);
  };

  const handleSelectAlternativeTime = (slot) => {
    setSelectedSlot(slot);
    setBookingError(null);
    toast.success(`Selected ${slot.display}`);
  };

  const handleSelectAlternativeDay = (day) => {
    setSelectedDate(new Date(day.date));
    setBookingError(null);
    setStep(3); // Go back to time selection
    toast.success(`Selected ${day.display}`);
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
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E5E5] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#0A0A0A]" data-testid="business-name">{business.name}</h1>
            {business.address && (
              <p className="text-sm text-[#666666] flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {business.address}
              </p>
            )}
          </div>
          <span className="text-xs text-[#666666] px-3 py-1 bg-[#FAFAFA] border border-[#E5E5E5]">
            Powered by BookSlot
          </span>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-white border-b border-[#E5E5E5] px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            {['Service', 'Staff', 'Date & Time', 'Details', 'Confirmed'].map((label, idx) => (
              <React.Fragment key={idx}>
                <div className={`flex items-center gap-2 ${step > idx + 1 ? 'text-[#0A0A0A]' : step === idx + 1 ? 'text-[#0A0A0A]' : 'text-[#666666]'}`}>
                  <div className={`w-6 h-6 flex items-center justify-center text-xs font-medium ${step > idx + 1 ? 'bg-[#121212] text-white' : step === idx + 1 ? 'bg-[#121212] text-white' : 'bg-[#E5E5E5] text-[#666666]'}`}>
                    {step > idx + 1 ? <Check className="w-3 h-3" /> : idx + 1}
                  </div>
                  <span className="text-sm hidden sm:inline">{label}</span>
                </div>
                {idx < 4 && <div className={`flex-1 h-px ${step > idx + 1 ? 'bg-[#121212]' : 'bg-[#E5E5E5]'}`} />}
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
            <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-6" data-testid="step-title">Select a service</h2>
            <div className="space-y-3">
              {services.map((service) => (
                <button
                  key={service.service_id}
                  onClick={() => {
                    setSelectedService(service);
                    setStep(2);
                  }}
                  className={`w-full card-hover text-left flex justify-between items-center`}
                  data-testid={`service-${service.service_id}`}
                >
                  <div>
                    <h3 className="font-medium text-[#0A0A0A]">{service.name}</h3>
                    <p className="text-sm text-[#666666] flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3" />
                      {service.duration} min
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#0A0A0A]">€{service.price}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Staff */}
        {step === 2 && (
          <div className="animate-fade-in">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 text-sm text-[#666666] hover:text-[#0A0A0A] mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to services
            </button>
            <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-6">Select a team member</h2>
            <div className="space-y-3">
              {staff.map((member) => (
                <button
                  key={member.staff_id}
                  onClick={() => {
                    setSelectedStaff(member);
                    setStep(3);
                  }}
                  className="w-full card-hover text-left flex items-center gap-4"
                  data-testid={`staff-${member.staff_id}`}
                >
                  <div className="w-12 h-12 bg-[#121212] rounded-full flex items-center justify-center text-white font-medium">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-medium text-[#0A0A0A]">{member.name}</h3>
                    {member.title && <p className="text-sm text-[#666666]">{member.title}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Select Date & Time */}
        {step === 3 && (
          <div className="animate-fade-in">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 text-sm text-[#666666] hover:text-[#0A0A0A] mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to staff
            </button>
            <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-6">Select date & time</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card-flat">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date() || date.getDay() === 0}
                  className="w-full"
                  data-testid="booking-calendar"
                />
              </div>

              <div className="card-flat">
                <h3 className="font-medium text-[#0A0A0A] mb-4">
                  {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a date'}
                </h3>
                
                {!selectedDate && (
                  <p className="text-[#666666] text-sm">Please select a date to see available times</p>
                )}

                {selectedDate && slotsLoading && (
                  <p className="text-[#666666] text-sm">Loading available times...</p>
                )}

                {selectedDate && !slotsLoading && availableSlots.length === 0 && (
                  <p className="text-[#666666] text-sm">No available times for this date</p>
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

              {/* Booking Error with Suggestions */}
              {bookingError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-amber-800 font-medium mb-3">{bookingError.message}</p>
                  
                  {/* Alternative Times */}
                  {bookingError.alternative_times && bookingError.alternative_times.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-amber-700 mb-2">Available times for {selectedStaff?.name}:</p>
                      <div className="flex flex-wrap gap-2">
                        {bookingError.alternative_times.map((slot, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectAlternativeTime(slot)}
                            className="px-3 py-1 bg-white border border-amber-300 rounded text-sm text-amber-800 hover:bg-amber-100 transition-colors"
                          >
                            {slot.display}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Alternative Days */}
                  {bookingError.alternative_days && bookingError.alternative_days.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-amber-700 mb-2">{selectedStaff?.name} is available on:</p>
                      <div className="flex flex-wrap gap-2">
                        {bookingError.alternative_days.map((day, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectAlternativeDay(day)}
                            className="px-3 py-1 bg-white border border-amber-300 rounded text-sm text-amber-800 hover:bg-amber-100 transition-colors"
                          >
                            {day.display}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Alternative Staff */}
                  {bookingError.alternative_staff && bookingError.alternative_staff.length > 0 && (
                    <div>
                      <p className="text-sm text-amber-700 mb-2">Other available staff:</p>
                      <div className="flex flex-wrap gap-2">
                        {bookingError.alternative_staff.map((staff, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectAlternativeStaff(staff)}
                            className="px-3 py-2 bg-white border border-amber-300 rounded text-sm text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-2"
                          >
                            <div className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center text-xs font-medium">
                              {staff.name.charAt(0)}
                            </div>
                            {staff.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full btn-accent flex items-center justify-center gap-2"
                data-testid="confirm-booking"
              >
                {submitting ? 'Submitting...' : 'Request Booking'}
                {!submitting && <Check className="w-4 h-4" />}
              </Button>
              
              <p className="text-xs text-center text-[#999999] mt-2">
                Your booking will be confirmed once approved by the business
              </p>
            </form>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && confirmation && (
          <div className="animate-fade-in text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-semibold text-[#0A0A0A] mb-2" data-testid="confirmation-title">
              {confirmation.requires_approval ? 'Booking Request Submitted!' : 'Booking Confirmed!'}
            </h2>
            <p className="text-[#666666] mb-8">
              {confirmation.requires_approval 
                ? `We'll email you at ${clientEmail} once the business confirms your booking.`
                : `A confirmation email has been sent to ${clientEmail}`
              }
            </p>

            <div className="card-flat text-left mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[#666666]">BOOKING DETAILS</h3>
                {confirmation.requires_approval && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">Pending Approval</span>
                )}
              </div>
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
