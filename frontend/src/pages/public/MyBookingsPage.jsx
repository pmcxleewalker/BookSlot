import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth, API } from '../../App';
import { format, parseISO } from 'date-fns';
import { Calendar, Clock, Sparkles, LogOut, ChevronRight, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const MyBookingsPage = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'client') {
      // Staff and owners have their own dashboard
      navigate(user.tenant_id ? '/dashboard' : '/onboarding');
      return;
    }
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchBookings = async () => {
    try {
      const resp = await axios.get(`${API}/client/bookings`, { headers: { Authorization: `Bearer ${token}` } });
      setUpcoming(resp.data.upcoming || []);
      setPast(resp.data.past || []);
    } catch {
      toast.error('Could not load your bookings');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#FAF7F3]">
      {/* Header */}
      <header className="bg-white border-b border-[#F0EBE6]">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#B8868B] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-['Cormorant_Garamond'] text-xl font-light text-[#2C2A29] leading-tight">Your Bookings</p>
              <p className="text-[10px] tracking-[0.15em] uppercase text-[#9E948F]">{user.name || user.email}</p>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="p-2 text-[#9E948F] hover:text-[#2C2A29] rounded-full hover:bg-[#FAF7F3] transition-colors" data-testid="client-logout">
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {loading ? (
          <p className="text-center text-[#9E948F] py-16 text-sm tracking-widest uppercase animate-pulse">Loading</p>
        ) : (
          <>
            {/* Upcoming */}
            <section>
              <p className="text-[11px] tracking-[0.3em] uppercase font-semibold text-[#B8868B] mb-4">Upcoming</p>
              {upcoming.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 text-center" data-testid="no-upcoming">
                  <Calendar className="w-10 h-10 text-[#9E948F] mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-[#2C2A29] font-medium">No upcoming bookings</p>
                  <p className="text-xs text-[#9E948F] mt-1">When you book next, it'll show up here.</p>
                </div>
              ) : (
                <div className="space-y-3" data-testid="upcoming-list">
                  {upcoming.map((a) => <BookingCard key={a.appointment_id} appt={a} />)}
                </div>
              )}
            </section>

            {/* Past */}
            {past.length > 0 && (
              <section>
                <p className="text-[11px] tracking-[0.3em] uppercase font-semibold text-[#9E948F] mb-4">Past · {past.length}</p>
                <div className="space-y-2" data-testid="past-list">
                  {past.slice(0, 8).map((a) => (
                    <div key={a.appointment_id} className="flex items-center gap-4 py-3 px-4 bg-white/60 rounded-2xl">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.status === 'completed' ? '#8FA68F' : '#D4CFCA' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#2C2A29] truncate">{a.service_name}</p>
                        <p className="text-[11px] text-[#9E948F]">{a.business_name} · {format(parseISO(a.start_time), 'MMM d, yyyy')}</p>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-[#9E948F]">{a.status}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="py-8 text-center">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[#9E948F]">Powered by BookSlot</p>
      </footer>
    </div>
  );
};

const BookingCard = ({ appt }) => {
  const accent = appt.business_primary_color || '#B8868B';
  const startDate = parseISO(appt.start_time);
  const isPending = appt.status === 'pending';

  return (
    <Link to={`/booking/${appt.appointment_id}`} className="block bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-5 transition-all hover:-translate-y-0.5" style={{ borderLeft: `3px solid ${accent}` }} data-testid={`booking-${appt.appointment_id}`}>
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0" style={{ backgroundColor: `${accent}18` }}>
          <p className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: accent }}>{format(startDate, 'MMM')}</p>
          <p className="font-['Cormorant_Garamond'] text-2xl font-light leading-none" style={{ color: accent }}>{format(startDate, 'd')}</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-['Cormorant_Garamond'] text-xl font-light text-[#2C2A29]">{appt.service_name}</p>
            {isPending && <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ backgroundColor: `${accent}22`, color: accent }}>Pending</span>}
          </div>
          <p className="text-sm text-[#706B68] mt-0.5">with {appt.staff_name}</p>
          <p className="text-xs text-[#9E948F] mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" strokeWidth={1.5} />{format(startDate, 'h:mm a')}</span>
            <span>·</span>
            <span className="truncate">{appt.business_name}</span>
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-[#9E948F] shrink-0 mt-2" strokeWidth={1.5} />
      </div>
    </Link>
  );
};

export default MyBookingsPage;
