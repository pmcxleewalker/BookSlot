import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { Calendar, Clock, User, MapPin, AlertTriangle, Check, X } from 'lucide-react';
import { format } from 'date-fns';

import { API, errorMessage } from '../../lib/api';
import { formatMoney, parseLocal, STATUS_LABELS } from '../../lib/utils';

const ManageBookingPage = () => {
  const { confirmationCode } = useParams();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    fetchBooking();
  }, [confirmationCode]);

  const fetchBooking = async () => {
    try {
      const response = await axios.get(`${API}/public/booking/manage/${confirmationCode}`);
      setBooking(response.data);
    } catch (error) {
      setBooking(null);
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
      toast.error(errorMessage(error, 'Failed to cancel booking'));
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

  const { appointment, business_name, service_name, staff_name, can_cancel, cancel_blocked_reason,
    business_phone, business_email, business_address, business_slug, currency, logo_url } = booking;
  const isCancelled = appointment.status === 'cancelled';
  const isPending = appointment.status === 'pending_approval';
  const start = parseLocal(appointment.start_time);
  const end = parseLocal(appointment.end_time);
  const isPast = start < new Date();

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E5E5] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {logo_url && <img src={logo_url} alt={business_name} className="h-10 w-auto max-w-[100px] object-contain" />}
          <span className="text-xl font-semibold text-[#0A0A0A]">{business_name}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-6" data-testid="manage-booking-title">
          Manage Your Booking
        </h1>

        {/* Status Banner */}
        {isCancelled && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 mb-6">
            <X className="w-5 h-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800">This booking has been cancelled</p>
              {appointment.cancellation_reason && (
                <p className="text-sm text-red-600">{appointment.cancellation_reason}</p>
              )}
              {business_slug && (
                <Link to={`/book/${business_slug}`} className="text-sm text-red-700 underline">Book a new appointment</Link>
              )}
            </div>
          </div>
        )}

        {isPending && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 mb-6">
            <Clock className="w-5 h-5 text-amber-600" />
            <p className="text-amber-800">This is a booking request - {business_name} will confirm it shortly.</p>
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
              {(STATUS_LABELS[appointment.status] || appointment.status).toUpperCase()}
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#0A0A0A]" />
              </div>
              <div>
                <p className="font-medium text-[#0A0A0A]">
                  {format(start, 'EEEE d MMMM yyyy')}
                </p>
                <p className="text-sm text-[#666666]">
                  {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#0A0A0A]" />
              </div>
              <div>
                <p className="font-medium text-[#0A0A0A]">{service_name}</p>
                <p className="text-sm text-[#666666]">{Number(appointment.total_price) > 0 ? formatMoney(appointment.total_price, currency) : 'Free'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                <User className="w-5 h-5 text-[#0A0A0A]" />
              </div>
              <div>
                <p className="font-medium text-[#0A0A0A]">{staff_name}</p>
                <p className="text-sm text-[#666666]">at {business_name}</p>
                {business_address && <p className="text-sm text-[#666666] flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" />{business_address}</p>}
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
        {!isCancelled && !isPast && !can_cancel && cancel_blocked_reason && (
          <p className="text-sm text-[#666666] p-4 bg-white border border-[#E5E5E5]">{cancel_blocked_reason}</p>
        )}

        {!isCancelled && can_cancel && (
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
            Need to change something? Contact {business_name}
            {business_phone && <> on <a className="underline" href={`tel:${business_phone}`}>{business_phone}</a></>}
            {business_email && <> or <a className="underline" href={`mailto:${business_email}`}>{business_email}</a></>}.
          </p>
        </div>
      </main>
    </div>
  );
};

export default ManageBookingPage;
