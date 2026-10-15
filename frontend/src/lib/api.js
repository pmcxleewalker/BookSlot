// Backend location. Leave REACT_APP_BACKEND_URL empty when the API is served from the same
// domain under /api (e.g. behind one reverse proxy); otherwise set it to e.g. https://api.yourdomain.com
export const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');
export const API = `${BACKEND_URL}/api`;

// Pull a readable message out of an axios error
export const errorMessage = (error, fallback = 'Something went wrong') => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (error?.response?.status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (!error?.response) return 'Cannot reach the server. Check your connection and try again.';
  return fallback;
};
