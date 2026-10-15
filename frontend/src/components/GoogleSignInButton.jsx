import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, errorMessage } from '../lib/api';

let configPromise = null;
const loadConfig = () => {
  if (!configPromise) {
    configPromise = axios.get(`${API}/auth/config`).then((r) => r.data).catch(() => ({}));
  }
  return configPromise;
};

let scriptPromise = null;
const loadGoogleScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
};

/**
 * "Continue with Google" using Google Identity Services. Renders nothing unless the backend has
 * GOOGLE_CLIENT_ID configured. Calls onCredential(idToken) after the user picks an account.
 */
const GoogleSignInButton = ({ onCredential, text = 'continue_with', showDivider = true }) => {
  const ref = useRef(null);
  const [clientId, setClientId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadConfig().then((cfg) => {
      if (!cancelled && cfg?.google_client_id) setClientId(cfg.google_client_id);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp) => {
            try {
              await onCredential(resp.credential);
            } catch (e) {
              toast.error(errorMessage(e, 'Google sign-in failed'));
            }
          },
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline', size: 'large', text, shape: 'rectangular',
          width: Math.min(ref.current.offsetWidth || 400, 400),
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!clientId) return null;

  return (
    <>
      <div ref={ref} className="w-full flex justify-center mb-6" data-testid="google-login-btn" />
      {showDivider && (
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-[#E5E5E5]" />
          <span className="text-sm text-[#666666]">or</span>
          <div className="flex-1 h-px bg-[#E5E5E5]" />
        </div>
      )}
    </>
  );
};

export default GoogleSignInButton;
