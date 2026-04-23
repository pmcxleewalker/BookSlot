import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth, API } from '../../App';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { KeyRound, ArrowRight } from 'lucide-react';

const ChangePasswordPage = () => {
  const { user, token, checkAuth, tenant } = useAuth();
  const navigate = useNavigate();
  const forced = !!user?.must_change_password;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      const payload = { new_password: newPassword };
      if (!forced) payload.current_password = currentPassword;
      await axios.post(`${API}/auth/change-password`, payload, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Password updated');
      await checkAuth();
      navigate(tenant ? '/dashboard' : '/onboarding');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F3] flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8" data-testid="change-password-page">
        <div className="w-12 h-12 rounded-2xl bg-[#E8C5C8] flex items-center justify-center mx-auto mb-5">
          <KeyRound className="w-5 h-5 text-[#B8868B]" strokeWidth={1.5} />
        </div>
        <h1 className="font-['Cormorant_Garamond'] text-3xl font-light text-[#2C2A29] text-center mb-2">
          {forced ? 'Set a new password' : 'Change password'}
        </h1>
        <p className="text-sm text-[#9E948F] text-center mb-6">
          {forced
            ? `Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Pick something you'll remember — you'll use it next time.`
            : 'Enter your current password and a new one below.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!forced && (
            <div>
              <Label htmlFor="current" className="text-xs uppercase tracking-wider text-[#9E948F]">Current password</Label>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="mt-1.5 h-11 rounded-xl bg-[#FAF7F3] border-transparent"
                data-testid="current-password-input"
              />
            </div>
          )}
          <div>
            <Label htmlFor="new" className="text-xs uppercase tracking-wider text-[#9E948F]">New password</Label>
            <Input
              id="new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1.5 h-11 rounded-xl bg-[#FAF7F3] border-transparent"
              data-testid="new-password-input"
            />
            <p className="text-[11px] text-[#9E948F] mt-1">Minimum 6 characters</p>
          </div>
          <div>
            <Label htmlFor="confirm" className="text-xs uppercase tracking-wider text-[#9E948F]">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1.5 h-11 rounded-xl bg-[#FAF7F3] border-transparent"
              data-testid="confirm-password-input"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 rounded-full bg-[#2C2A29] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#4A4745] transition-all hover:shadow-lg disabled:opacity-60 mt-2"
            data-testid="save-new-password-btn"
          >
            {saving ? 'Saving…' : (forced ? 'Set password & continue' : 'Update password')}
            {!saving && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
