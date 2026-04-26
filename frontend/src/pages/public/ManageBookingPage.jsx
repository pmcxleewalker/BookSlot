import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { Calendar, Clock, User, MapPin, AlertTriangle, Check, X, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const ManageBookingPage = () => {
  const { confirmationCode } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null); // 'checking' | 'paid' | 'unpaid'

  useEffect(() => {
    fetchBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmationCode]);

  // Poll payment status if redirected back from Stripe
  useEffect(() => {
    if (!sessionId) return;
    setPaymentStatus('checking');
    let attempts = 0;
    const maxAttempts = 6;
    const poll = async () => {
      attempts++;
      try {
        const r = await axios.get(`${API}/public/payment/status/${sessionId}`);
        if (r.data.payment_status === 'paid') {
          setPaymentStatus('paid');
          toast.success('Payment received — your booking is confirmed!');
          fetchBooking();
          // Strip session_id from URL so a refresh doesn't re-poll forever
          setSearchParams({});
          return;
        }
        if (r.data.status === 'expired') {
          setPaymentStatus('unpaid');
          toast.error('Payment session expired');
          return;
        }
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setPaymentStatus('checking_timeout');
        }
      } catch {
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setPaymentStatus('error');
        }
      }
    };
    poll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const fetchBooking = async () => {
    try {
      const response = await axios.get(`${API}/public/booking/manage/${confirmationCode}`);
      setBooking(response.data);
    } catch (error) {
      toast.error('Booking not found');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await axios.post(`${API}/public/booking/manage/${confirmationCode}/cancel`, {
        reason: 'Cancelled by customer'
      });
      toast.success('Booking cancelled');
      fetchBooking();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel booking');
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-[#666666]">Loading...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-4">Booking not found</h1>
          <p className="text-[#666666] mb-6">The booking code may be incorrect or expired.</p>
          <Link to="/" className="text-[#4F46E5] hover:underline">Go to homepage</Link>
        </div>
      </div>
    );
  }

  const { appointment, business_name, service_name, staff_name } = booking;
  const themePreset = booking.business_theme_preset || 'default';
  const isDark = themePreset === 'onyx_gold';
  const goldAccent = booking.business_primary_color || '#D4AF37';
  const isCancelled = appointment.status === 'cancelled';
  const isPast = new Date(appointment.start_time) < new Date();

  return (
    <div
      className="min-h-screen"
      data-theme={themePreset}
      style={{ background: isDark ? '#0A0A0A' : '#FAFAFA', color: isDark ? '#F5EFE0' : '#0A0A0A' }}
    >
      {/* Header */}
      <header
        className="border-b px-6 py-4"
        style={{ background: isDark ? '#141414' : '#FFFFFF', borderColor: isDark ? '#2A2218' : '#E5E5E5' }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {booking.business_logo_url && <img src={booking.business_logo_url} alt={business_name} className="h-9 w-9 rounded-xl object-cover" />}
          <Link
            to="/"
            className="text-xl font-semibold"
            style={{ color: isDark ? goldAccent : '#0A0A0A', fontFamily: isDark ? "'Cinzel', serif" : undefined, letterSpacing: isDark ? '0.06em' : 0 }}
          >
            {business_name || 'BookSlot'}
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-6" data-testid="manage-booking-title">
          Manage Your Booking
        </h1>

        {/* Payment status banner — shown when redirected back from Stripe */}
        {paymentStatus === 'checking' && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 mb-6 rounded-xl" data-testid="payment-checking-banner">
            <CreditCard className="w-5 h-5 text-amber-700 animate-pulse" />
            <p className="text-amber-800 text-sm">Confirming your payment with the bank…</p>
          </div>
        )}
        {paymentStatus === 'paid' && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 mb-6 rounded-xl" data-testid="payment-paid-banner">
            <Check className="w-5 h-5 text-emerald-700" />
            <p className="text-emerald-800 text-sm">Deposit received — your booking is on the books!</p>
          </div>
        )}

        {/* Status Banner */}
        {isCancelled && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 mb-6">
            <X className="w-5 h-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800">This booking has been cancelled</p>
              {appointment.cancelled_at && (
                <p className="text-sm text-red-600">
                  Cancelled on {format(new Date(appointment.cancelled_at), 'MMMM d, yyyy')}
                </p>
              )}
            </div>
          </div>
        )}

        {!isCancelled && isPast && (
          <div className="flex items-center gap-3 p-4 bg-[#FAFAFA] border border-[#E5E5E5] mb-6">
            <Check className="w-5 h-5 text-[#666666]" />
            <p className="text-[#666666]">This appointment has passed</p>
          </div>
        )}

        {/* Booking Details */}
        <div className="card-flat mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm text-[#666666] mb-1">CONFIRMATION CODE</p>
              <p className="font-mono font-semibold text-lg text-[#0A0A0A]" data-testid="confirmation-code">
                {confirmationCode}
              </p>
            </div>
            <span className={`px-3 py-1 text-xs font-medium ${
              isCancelled ? 'badge-cancelled' : 
              appointment.status === 'confirmed' ? 'badge-confirmed' : 
              'badge-pending'
            }`}>
              {appointment.status.toUpperCase()}
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#0A0A0A]" />
              </div>
              <div>
                <p className="font-medium text-[#0A0A0A]">
                  {format(new Date(appointment.start_time), 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-sm text-[#666666]">
                  {format(new Date(appointment.start_time), 'h:mm a')} - {format(new Date(appointment.end_time), 'h:mm a')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#0A0A0A]" />
              </div>
              <div>
                <p className="font-medium text-[#0A0A0A]">{service_name}</p>
                <p className="text-sm text-[#666666]">€{appointment.total_price}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                <User className="w-5 h-5 text-[#0A0A0A]" />
              </div>
              <div>
                <p className="font-medium text-[#0A0A0A]">{staff_name}</p>
                <p className="text-sm text-[#666666]">at {business_name}</p>
              </div>
            </div>

            {appointment.notes && (
              <div className="pt-4 border-t border-[#E5E5E5]">
                <p className="text-sm text-[#666666] mb-1">Notes</p>
                <p className="text-[#0A0A0A]">{appointment.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isCancelled && !isPast && (
          <div className="space-y-4">
            {!showCancelConfirm ? (
              <Button
                onClick={() => setShowCancelConfirm(true)}
                variant="outline"
                className="w-full btn-secondary text-red-600 border-red-200 hover:border-red-400"
                data-testid="cancel-booking-btn"
              >
                Cancel Booking
              </Button>
            ) : (
              <div className="card-flat border-red-200 bg-red-50">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">Are you sure you want to cancel?</p>
                    <p className="text-sm text-red-600">This action cannot be undone.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    data-testid="confirm-cancel-btn"
                  >
                    {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                  </Button>
                  <Button
                    onClick={() => setShowCancelConfirm(false)}
                    variant="outline"
                    className="flex-1"
                    data-testid="keep-booking-btn"
                  >
                    Keep Booking
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Help */}
        <div className="mt-8 pt-8 border-t border-[#E5E5E5] text-center">
          <p className="text-sm text-[#666666]">
            Need help? Contact {business_name} directly or email support@bookslot.io
          </p>
        </div>
      </main>
    </div>
  );
};

export default ManageBookingPage;
