import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Building2, Users, Briefcase, Check } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const industries = [
  { value: 'salon', label: 'Salon / Spa', icon: '💇' },
  { value: 'clinic', label: 'Medical Clinic', icon: '🏥' },
  { value: 'dentist', label: 'Dentist', icon: '🦷' },
  { value: 'doctor', label: 'Doctor / GP', icon: '👨‍⚕️' },
  { value: 'vet', label: 'Veterinary', icon: '🐾' },
  { value: 'consultant', label: 'Consultant', icon: '💼' },
  { value: 'other', label: 'Other Service', icon: '📅' },
];

const OnboardingPage = () => {
  const { token, createTenant, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const handleNext = () => {
    if (step === 1 && !businessName) {
      toast.error('Please enter your business name');
      return;
    }
    if (step === 2 && !industry) {
      toast.error('Please select your industry');
      return;
    }
    setStep(step + 1);
  };

  const handleComplete = async () => {
    if (!email) {
      toast.error('Please enter your business email');
      return;
    }

    setLoading(true);
    try {
      await createTenant({
        name: businessName,
        industry,
        email,
        phone,
        address
      });

      // Seed demo data
      try {
        await axios.post(`${API}/demo/seed`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        // Ignore seed errors
      }

      // Complete onboarding
      await axios.post(`${API}/tenants/me/complete-onboarding`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await checkAuth();

      toast.success('Welcome to BookSlot! Your business is ready.');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create business');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12">
        <div className="max-w-md w-full mx-auto">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-12">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className={`w-8 h-8 flex items-center justify-center text-sm font-medium ${
                  step > s ? 'bg-[#121212] text-white' : 
                  step === s ? 'bg-[#121212] text-white' : 
                  'bg-[#E5E5E5] text-[#666666]'
                }`}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-[#121212]' : 'bg-[#E5E5E5]'}`} />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Business Name */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div className="w-14 h-14 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center mb-6">
                <Building2 className="w-7 h-7 text-[#0A0A0A]" />
              </div>
              <h1 className="text-3xl font-semibold text-[#0A0A0A] mb-2" data-testid="onboarding-title">
                Let's set up your business
              </h1>
              <p className="text-[#666666] mb-8">First, what's your business called?</p>

              <div className="space-y-6">
                <div>
                  <Label htmlFor="businessName" className="text-sm font-medium text-[#0A0A0A]">
                    Business name
                  </Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Sarah's Salon"
                    className="mt-1.5 input-swiss"
                    data-testid="business-name-input"
                    autoFocus
                  />
                </div>

                <Button
                  onClick={handleNext}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                  data-testid="next-step-btn"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Industry */}
          {step === 2 && (
            <div className="animate-fade-in">
              <button 
                onClick={() => setStep(1)} 
                className="flex items-center gap-2 text-sm text-[#666666] hover:text-[#0A0A0A] mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="w-14 h-14 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center mb-6">
                <Briefcase className="w-7 h-7 text-[#0A0A0A]" />
              </div>
              <h1 className="text-3xl font-semibold text-[#0A0A0A] mb-2">
                What type of business?
              </h1>
              <p className="text-[#666666] mb-8">We'll customize BookSlot for your industry</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {industries.map((ind) => (
                  <button
                    key={ind.value}
                    onClick={() => setIndustry(ind.value)}
                    className={`p-4 border text-left transition-all ${
                      industry === ind.value 
                        ? 'border-[#121212] bg-[#FAFAFA]' 
                        : 'border-[#E5E5E5] hover:border-[#121212]'
                    }`}
                    data-testid={`industry-${ind.value}`}
                  >
                    <span className="text-2xl block mb-2">{ind.icon}</span>
                    <span className="text-sm font-medium text-[#0A0A0A]">{ind.label}</span>
                  </button>
                ))}
              </div>

              <Button
                onClick={handleNext}
                disabled={!industry}
                className="w-full btn-primary flex items-center justify-center gap-2"
                data-testid="next-step-btn"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Step 3: Contact Details */}
          {step === 3 && (
            <div className="animate-fade-in">
              <button 
                onClick={() => setStep(2)} 
                className="flex items-center gap-2 text-sm text-[#666666] hover:text-[#0A0A0A] mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="w-14 h-14 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-[#0A0A0A]" />
              </div>
              <h1 className="text-3xl font-semibold text-[#0A0A0A] mb-2">
                Contact details
              </h1>
              <p className="text-[#666666] mb-8">How can clients reach you?</p>

              <div className="space-y-4 mb-6">
                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-[#0A0A0A]">
                    Business email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hello@yourbusiness.com"
                    className="mt-1.5 input-swiss"
                    data-testid="email-input"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-sm font-medium text-[#0A0A0A]">
                    Phone (optional)
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+353 1 234 5678"
                    className="mt-1.5 input-swiss"
                    data-testid="phone-input"
                  />
                </div>

                <div>
                  <Label htmlFor="address" className="text-sm font-medium text-[#0A0A0A]">
                    Address (optional)
                  </Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main Street, Dublin"
                    className="mt-1.5 input-swiss"
                    data-testid="address-input"
                  />
                </div>
              </div>

              <Button
                onClick={handleComplete}
                disabled={loading || !email}
                className="w-full btn-accent flex items-center justify-center gap-2"
                data-testid="complete-onboarding-btn"
              >
                {loading ? 'Setting up...' : 'Complete Setup'}
                {!loading && <Check className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="hidden lg:flex w-1/2 bg-[#121212] items-center justify-center p-16">
        <div className="text-white max-w-md">
          <h2 className="heading-marketing text-4xl mb-6">
            You're almost ready
          </h2>
          <p className="text-white/70 text-lg mb-8">
            Just a few quick steps and you'll have your booking page live and ready to accept appointments.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3" />
              </div>
              <span className="text-white/80">14-day free trial</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3" />
              </div>
              <span className="text-white/80">No credit card required</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3" />
              </div>
              <span className="text-white/80">Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
