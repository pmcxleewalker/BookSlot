import React, { useEffect, useRef, useState } from 'react';

// Google Identity Services: Google gives us an ID token directly, and our backend verifies it.
// Set REACT_APP_GOOGLE_CLIENT_ID to show the button; without it, the button is hidden.
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

const loadScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    let el = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (!el) {
      el = document.createElement('script');
      el.src = SCRIPT_SRC;
      el.async = true;
      el.defer = true;
      document.head.appendChild(el);
    }
    el.addEventListener('load', () => resolve());
    el.addEventListener('error', () => reject(new Error('Google script failed to load')));
  });

const GoogleSignInButton = ({ onCredential, text = 'continue_with' }) => {
  const ref = useRef(null);
  const cb = useRef(onCredential);
  const [failed, setFailed] = useState(false);
  cb.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp) => cb.current(resp.credential),
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          width: Math.min(ref.current.offsetWidth || 400, 400),
        });
      })
      .catch(() => setFailed(true));
    return () => { cancelled = true; };
  }, [text]);

  if (!CLIENT_ID || failed) return null;

  return (
    <>
      <div ref={ref} className="w-full flex justify-center mb-6" data-testid="google-login-btn" />
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-[#E5E5E5]" />
        <span className="text-sm text-[#666666]">or</span>
        <div className="flex-1 h-px bg-[#E5E5E5]" />
      </div>
    </>
  );
};

export default GoogleSignInButton;
