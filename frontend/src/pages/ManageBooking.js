import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, Clock, User, MapPin, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { publicAPI } from '../lib/api';
import { toast } from 'sonner';

export default function ManageBooking() {
  const { appointmentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelEmail, setCancelEmail] = useState('');

  useEffect(() => {
    loadAppointment();
  }, [appointmentId]);

  const loadAppointment = async () => {
    try {
      const data = await publicAPI.getAppointment(appointmentId);
      setAppointment(data);
    } catch (error) {
      toast.error('Appointment not found');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelEmail) {
      toast.error('Please enter your email');
      return;
    }

    setCancelling(true);
    try {
      await publicAPI.cancelAppointment(appointmentId, cancelEmail);
      toast.success('Appointment cancelled');
      loadAppointment();
      setShowCancelConfirm(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#2E473B]/20 border-t-[#2E473B] rounded-full animate-spin" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1C1C1C] mb-2">Appointment Not Found</h1>
          <p className="text-[#6B6B6B]">This appointment doesn't exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  const isCancelled = appointment.status === 'cancelled';
  const isPast = new Date(appointment.end_time) < new Date();

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <header className="bg-white border-b border-[#E5E5E0]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
            {appointment.business_name}
          </h1>
          <p className="text-sm text-[#6B6B6B]">Manage your booking</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Status Banner */}
        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <X className="w-5 h-5 text-red-500" />
            <span className="text-red-700">This appointment has been cancelled</span>
          </div>
        )}
        {isPast && !isCancelled && (
          <div className="bg-[#6B6B6B]/10 border border-[#6B6B6B]/20 rounded-xl p-4 mb-6 flex items-center gap-3">
            <Check className="w-5 h-5 text-[#6B6B6B]" />
            <span className="text-[#6B6B6B]">This appointment has passed</span>
          </div>
        )}

        {/* Appointment Card */}
        <div className="bg-white rounded-2xl border border-[#E5E5E0] overflow-hidden">
          <div className={`p-6 ${isCancelled ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
                  {appointment.service_name}
                </h2>
                <p className="text-[#6B6B6B]">with {appointment.staff_name}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                isCancelled ? 'bg-red-100 text-red-700' :
                isPast ? 'bg-[#6B6B6B]/10 text-[#6B6B6B]' :
                'bg-[#3E6653]/10 text-[#3E6653]'
              }`}>
                {isCancelled ? 'Cancelled' : isPast ? 'Completed' : 'Confirmed'}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2E473B]/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-[#2E473B]" />
                </div>
                <div>
                  <p className="text-sm text-[#6B6B6B]">Date</p>
                  <p className="font-medium text-[#1C1C1C]">
                    {format(new Date(appointment.start_time), 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2E473B]/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-[#2E473B]" />
                </div>
                <div>
                  <p className="text-sm text-[#6B6B6B]">Time</p>
                  <p className="font-medium text-[#1C1C1C]">
                    {format(new Date(appointment.start_time), 'h:mm a')} - {format(new Date(appointment.end_time), 'h:mm a')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2E473B]/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-[#2E473B]" />
                </div>
                <div>
                  <p className="text-sm text-[#6B6B6B]">Booked by</p>
                  <p className="font-medium text-[#1C1C1C]">{appointment.client_name}</p>
                  {appointment.client_email && (
                    <p className="text-sm text-[#6B6B6B]">{appointment.client_email}</p>
                  )}
                </div>
              </div>

              {appointment.notes && (
                <div className="pt-4 border-t border-[#E5E5E0]">
                  <p className="text-sm text-[#6B6B6B] mb-1">Notes</p>
                  <p className="text-[#1C1C1C]">{appointment.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {!isCancelled && !isPast && (
            <div className="p-6 bg-[#FAF9F6] border-t border-[#E5E5E0]">
              {!showCancelConfirm ? (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  data-testid="cancel-booking-btn"
                >
                  Cancel Appointment
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      Please confirm your email to cancel this appointment.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="cancel-email">Your Email</Label>
                    <Input
                      id="cancel-email"
                      type="email"
                      value={cancelEmail}
                      onChange={(e) => setCancelEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="mt-1 rounded-xl"
                      data-testid="cancel-email-input"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCancelConfirm(false);
                        setCancelEmail('');
                      }}
                      className="flex-1 rounded-xl"
                    >
                      Keep Appointment
                    </Button>
                    <Button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                      data-testid="confirm-cancel-btn"
                    >
                      {cancelling ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Yes, Cancel'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Confirmation Code */}
        <div className="mt-6 text-center">
          <p className="text-sm text-[#6B6B6B]">Confirmation Code</p>
          <p className="text-xl font-mono font-bold text-[#2E473B]">
            {appointment.appointment_id.slice(-8).toUpperCase()}
          </p>
        </div>
      </main>
    </div>
  );
}
