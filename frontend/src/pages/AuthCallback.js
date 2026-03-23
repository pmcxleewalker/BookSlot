import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Calendar } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { processOAuthSession } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.replace('#', ''));
        const sessionId = params.get('session_id');

        if (!sessionId) {
          toast.error('No session found');
          navigate('/login');
          return;
        }

        // Process the session
        const userData = await processOAuthSession(sessionId);
        
        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);

        toast.success('Welcome!');
        
        // Redirect based on whether user has a tenant
        if (userData.tenant_id) {
          navigate('/dashboard', { replace: true, state: { user: userData } });
        } else {
          navigate('/onboarding', { replace: true, state: { user: userData } });
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        toast.error('Authentication failed. Please try again.');
        navigate('/login');
      }
    };

    processAuth();
  }, [navigate, processOAuthSession]);

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#2E473B] flex items-center justify-center">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
            TimeSlot Pro
          </span>
        </div>
        <div className="w-12 h-12 border-4 border-[#2E473B]/20 border-t-[#2E473B] rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#6B6B6B]">Completing sign in...</p>
      </div>
    </div>
  );
}
