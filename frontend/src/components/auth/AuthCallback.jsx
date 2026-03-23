import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { googleAuth, tenant } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Use ref to prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.substring(1));
        const sessionId = params.get('session_id');

        if (!sessionId) {
          navigate('/login');
          return;
        }

        // Exchange session_id for user session
        const user = await googleAuth(sessionId);

        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);

        // Navigate based on tenant status
        if (user.tenant_id) {
          navigate('/dashboard', { replace: true, state: { user } });
        } else {
          navigate('/onboarding', { replace: true, state: { user } });
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login', { replace: true });
      }
    };

    processAuth();
  }, [googleAuth, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#121212] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#666666]">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
