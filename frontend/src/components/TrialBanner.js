import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight, X, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import api from '../lib/api';

export default function TrialBanner() {
  const [trialStatus, setTrialStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrialStatus();
  }, []);

  const fetchTrialStatus = async () => {
    try {
      const response = await api.get('/trial/status');
      setTrialStatus(response.data);
    } catch (err) {
      console.error('Error fetching trial status:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || dismissed || !trialStatus?.is_trial) {
    return null;
  }

  const { trial_expired, days_remaining, hours_remaining, early_signup_eligible, discount_percent, plans } = trialStatus;

  // Trial expired - show upgrade prompt
  if (trial_expired) {
    return (
      <div className="bg-red-50 border-b border-red-100 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-red-800 font-medium text-sm">Your trial has expired</p>
              <p className="text-red-600 text-xs">Upgrade now to continue using TimeSlot Pro</p>
            </div>
          </div>
          <Link to="/dashboard/billing">
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-full">
              Upgrade Now
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Active trial with discount
  if (early_signup_eligible) {
    const urgency = days_remaining <= 1;
    
    return (
      <div className={`${urgency ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'} border-b px-4 py-3`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full ${urgency ? 'bg-amber-100' : 'bg-emerald-100'} flex items-center justify-center`}>
              <Sparkles className={`w-4 h-4 ${urgency ? 'text-amber-600' : 'text-emerald-600'}`} />
            </div>
            <div>
              <p className={`${urgency ? 'text-amber-800' : 'text-emerald-800'} font-medium text-sm`}>
                {days_remaining > 0 ? (
                  <>{days_remaining} day{days_remaining !== 1 ? 's' : ''} left in your trial</>
                ) : (
                  <>{hours_remaining} hours left in your trial</>
                )}
                {' '}<span className="font-normal">•</span>{' '}
                <span className="text-emerald-600 font-semibold">{discount_percent}% off</span> if you subscribe now
              </p>
              <p className={`${urgency ? 'text-amber-600' : 'text-emerald-600'} text-xs`}>
                Save on your first 3 months when you upgrade before trial ends
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard/billing">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full">
                Claim {discount_percent}% Off
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
            <button 
              onClick={() => setDismissed(true)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
