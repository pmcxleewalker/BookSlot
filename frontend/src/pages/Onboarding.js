import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Calendar, Building2, Users, ArrowRight, ArrowLeft, Check, Sparkles 
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { onboardingAPI } from '../lib/api';
import { toast } from 'sonner';

const industries = [
  { id: 'salon', name: 'Salon & Spa', icon: '✂️', description: 'Hair, beauty, nails, massage' },
  { id: 'clinic', name: 'Clinic', icon: '🏥', description: 'Medical & health clinics' },
  { id: 'dentist', name: 'Dentist', icon: '🦷', description: 'Dental practices' },
  { id: 'doctor', name: 'Doctor', icon: '👨‍⚕️', description: 'Private practices' },
  { id: 'vet', name: 'Veterinary', icon: '🐾', description: 'Pet care & animal clinics' },
  { id: 'consultant', name: 'Consultant', icon: '💼', description: 'Professional services' },
  { id: 'other', name: 'Other', icon: '📅', description: 'Custom setup' },
];

const timezones = [
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'America/New_York', label: 'New York (EST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [businessData, setBusinessData] = useState({
    name: '',
    industry: '',
    email: '',
    phone: '',
    timezone: 'Europe/London',
  });
  const [selectedServices, setSelectedServices] = useState([]);
  const [templateServices, setTemplateServices] = useState([]);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleIndustrySelect = async (industry) => {
    setBusinessData({ ...businessData, industry });
    
    try {
      const template = await onboardingAPI.getIndustryTemplate(industry);
      setTemplateServices(template.services);
      setSelectedServices(template.services.map((_, i) => i));
    } catch (error) {
      console.error('Failed to load template:', error);
    }
  };

  const handleCreateBusiness = async () => {
    setLoading(true);
    try {
      await onboardingAPI.createBusiness({
        name: businessData.name,
        industry: businessData.industry,
        email: businessData.email || user?.email,
        phone: businessData.phone,
        timezone: businessData.timezone,
      });
      
      // Apply selected services
      if (selectedServices.length > 0) {
        const services = selectedServices.map(i => templateServices[i]);
        await onboardingAPI.applyTemplate(services);
      }
      
      await refreshUser();
      toast.success('Business created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (index) => {
    if (selectedServices.includes(index)) {
      setSelectedServices(selectedServices.filter(i => i !== index));
    } else {
      setSelectedServices([...selectedServices, index]);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Header */}
      <header className="border-b border-[#E5E5E0] bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#2E473B] flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[#1C1C1C]" style={{ fontFamily: 'Outfit' }}>
              TimeSlot Pro
            </span>
          </div>
          
          {/* Progress */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  s < step
                    ? 'bg-[#3E6653] text-white'
                    : s === step
                    ? 'bg-[#2E473B] text-white'
                    : 'bg-[#E5E5E0] text-[#6B6B6B]'
                }`}
              >
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Step 1: Industry Selection */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-8">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2E473B]/10 text-[#2E473B] text-sm font-medium mb-4">
                <Building2 className="w-4 h-4" />
                Step 1 of 3
              </span>
              <h1 className="text-3xl font-bold text-[#1C1C1C] mb-2" style={{ fontFamily: 'Outfit' }}>
                What type of business do you run?
              </h1>
              <p className="text-[#6B6B6B]">
                We'll set up your booking system with pre-configured services
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              {industries.map((industry) => (
                <button
                  key={industry.id}
                  onClick={() => handleIndustrySelect(industry.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    businessData.industry === industry.id
                      ? 'border-[#2E473B] bg-[#2E473B]/5 ring-2 ring-[#2E473B]/20'
                      : 'border-[#E5E5E0] hover:border-[#2E473B]/30 bg-white'
                  }`}
                  data-testid={`industry-${industry.id}`}
                >
                  <span className="text-2xl mb-2 block">{industry.icon}</span>
                  <h3 className="font-medium text-[#1C1C1C]">{industry.name}</h3>
                  <p className="text-xs text-[#6B6B6B] mt-1">{industry.description}</p>
                </button>
              ))}
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!businessData.industry}
              className="w-full h-12 rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
              data-testid="onboarding-next-1"
            >
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Step 2: Business Details */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-8">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2E473B]/10 text-[#2E473B] text-sm font-medium mb-4">
                <Users className="w-4 h-4" />
                Step 2 of 3
              </span>
              <h1 className="text-3xl font-bold text-[#1C1C1C] mb-2" style={{ fontFamily: 'Outfit' }}>
                Tell us about your business
              </h1>
              <p className="text-[#6B6B6B]">
                This information will be shown on your booking page
              </p>
            </div>

            <div className="space-y-5 mb-8">
              <div>
                <Label htmlFor="name" className="text-[#1C1C1C]">Business Name *</Label>
                <Input
                  id="name"
                  value={businessData.name}
                  onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })}
                  placeholder="e.g. Sarah's Hair Studio"
                  className="h-12 rounded-xl border-[#E5E5E0] mt-1"
                  data-testid="business-name-input"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-[#1C1C1C]">Business Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={businessData.email}
                  onChange={(e) => setBusinessData({ ...businessData, email: e.target.value })}
                  placeholder={user?.email || 'hello@yourbusiness.com'}
                  className="h-12 rounded-xl border-[#E5E5E0] mt-1"
                  data-testid="business-email-input"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-[#1C1C1C]">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={businessData.phone}
                  onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                  className="h-12 rounded-xl border-[#E5E5E0] mt-1"
                  data-testid="business-phone-input"
                />
              </div>

              <div>
                <Label htmlFor="timezone" className="text-[#1C1C1C]">Timezone</Label>
                <select
                  id="timezone"
                  value={businessData.timezone}
                  onChange={(e) => setBusinessData({ ...businessData, timezone: e.target.value })}
                  className="w-full h-12 rounded-xl border border-[#E5E5E0] px-3 mt-1 bg-white"
                  data-testid="timezone-select"
                >
                  {timezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1 h-12 rounded-xl border-[#E5E5E0]"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!businessData.name}
                className="flex-1 h-12 rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
                data-testid="onboarding-next-2"
              >
                Continue
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Services */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-8">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2E473B]/10 text-[#2E473B] text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                Step 3 of 3
              </span>
              <h1 className="text-3xl font-bold text-[#1C1C1C] mb-2" style={{ fontFamily: 'Outfit' }}>
                Choose your services
              </h1>
              <p className="text-[#6B6B6B]">
                Select the services you offer. You can add more later.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {templateServices.map((service, index) => (
                <button
                  key={index}
                  onClick={() => toggleService(index)}
                  className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                    selectedServices.includes(index)
                      ? 'border-[#2E473B] bg-[#2E473B]/5'
                      : 'border-[#E5E5E0] bg-white hover:border-[#2E473B]/30'
                  }`}
                  data-testid={`service-${index}`}
                >
                  <div>
                    <h3 className="font-medium text-[#1C1C1C]">{service.name}</h3>
                    <p className="text-sm text-[#6B6B6B]">
                      {service.duration} min • €{service.price}
                    </p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedServices.includes(index)
                      ? 'border-[#2E473B] bg-[#2E473B]'
                      : 'border-[#E5E5E0]'
                  }`}>
                    {selectedServices.includes(index) && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1 h-12 rounded-xl border-[#E5E5E0]"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleCreateBusiness}
                disabled={loading}
                className="flex-1 h-12 rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
                data-testid="onboarding-finish"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Complete Setup
                    <Check className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
