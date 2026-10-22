import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Format a price in the business's currency, e.g. formatMoney(40, 'EUR') -> "€40.00"
export function formatMoney(amount, currency = 'EUR') {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (e) {
    return `${currency || ''} ${value.toFixed(2)}`;
  }
}

// Appointment times are stored as local wall-clock strings ("2026-10-16T10:00:00").
// Parse them as local time without any timezone shifting.
export function parseLocal(value) {
  if (!value) return null;
  const [d, t = '00:00:00'] = String(value).slice(0, 19).split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, min, s] = t.split(':').map(Number);
  return new Date(y, (m || 1) - 1, day || 1, h || 0, min || 0, s || 0);
}

// Format a Date as a local wall-clock string the API understands
export function toLocalISO(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  pending_approval: 'bg-orange-100 text-orange-700',
  pending_payment: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-gray-200 text-gray-700',
};

export const STATUS_LABELS = {
  pending: 'Pending',
  pending_approval: 'Needs approval',
  pending_payment: 'Awaiting deposit',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};
