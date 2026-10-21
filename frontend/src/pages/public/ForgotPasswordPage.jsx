import React, { useState } from 'react';
import BrandLogo from '../../components/BrandLogo';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { API, errorMessage } from '../../lib/api';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email });
      setSent(true);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not send reset email'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <Link to="/" className="mb-10 inline-block" aria-label="BookSlot home"><BrandLogo size={36} textClassName="text-2xl" /></Link>
        <h1 className="text-3xl font-semibold text-[#0A0A0A] mb-2">Reset your password</h1>
        {sent ? (
          <div className="mt-6" data-testid="reset-sent">
            <p className="text-[#666666] mb-6">
              If an account exists for <strong>{email}</strong>, we've sent a link to reset your password.
              It expires in one hour. Check your spam folder if it doesn't arrive.
            </p>
            <Link to="/login" className="text-[#0A0A0A] font-medium hover:underline">Back to sign in</Link>
          </div>
        ) : (
          <>
            <p className="text-[#666666] mb-8">Enter the email you use for BookSlot and we'll send you a reset link.</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="mt-1.5 input-swiss" data-testid="forgot-email" />
              </div>
              <Button type="submit" disabled={loading} className="w-full btn-primary" data-testid="forgot-submit">
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>
            <p className="mt-8 text-center text-sm text-[#666666]">
              Remembered it? <Link to="/login" className="text-[#0A0A0A] font-medium hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
