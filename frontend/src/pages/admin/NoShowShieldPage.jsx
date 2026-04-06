import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { 
  Shield, AlertTriangle, AlertCircle, CheckCircle, Clock, Phone, Mail, 
  Users, Calendar, Bell, TrendingUp, ChevronRight, Plus, UserPlus, X
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

const NoShowShieldPage = () => {
  const { token, tenant } = useAuth();
  const [atRiskAppointments, setAtRiskAppointments] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [stats, setStats] = useState({ total: 0, high: 0, medium: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('at-risk');
  const [showAddWaitlist, setShowAddWaitlist] = useState(false);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  
  const [newWaitlistEntry, setNewWaitlistEntry] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    service_id: '',
    preferred_staff_id: '',
    notes: '',
    flexible_dates: true,
    flexible_times: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [riskRes, waitlistRes, staffRes, servicesRes] = await Promise.all([
        axios.get(`${API}/risk/at-risk-appointments`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/waitlist`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/staff`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setAtRiskAppointments(riskRes.data.at_risk_appointments || []);
      setStats({
        total: riskRes.data.total_count || 0,
        high: riskRes.data.high_risk_count || 0,
        medium: riskRes.data.medium_risk_count || 0
      });
      setWaitlist(waitlistRes.data.waitlist || []);
      setStaff(staffRes.data.staff || []);
      setServices(servicesRes.data.services || []);
    } catch (error) {
      console.error('Failed to load No-Show Shield data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (appointmentId) => {
    try {
      const res = await axios.post(`${API}/push/send-reminder`, { appointment_id: appointmentId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.sent) {
        toast.success('Reminder sent!');
      } else {
        toast.info('Client has not installed the app yet. Share the install link with them.');
      }
    } catch (error) {
      toast.error('Failed to send reminder');
    }
  };

  const handleMarkNoShow = async (appointmentId) => {
    try {
      await axios.post(`${API}/risk/mark-no-show/${appointmentId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Marked as no-show');
      fetchData();
    } catch (error) {
      toast.error('Failed to mark as no-show');
    }
  };

  const handleAddToWaitlist = async () => {
    if (!newWaitlistEntry.client_name) {
      toast.error('Client name is required');
      return;
    }
    
    try {
      await axios.post(`${API}/waitlist`, newWaitlistEntry, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Added to waitlist!');
      setShowAddWaitlist(false);
      setNewWaitlistEntry({
        client_name: '',
        client_email: '',
        client_phone: '',
        service_id: '',
        preferred_staff_id: '',
        notes: '',
        flexible_dates: true,
        flexible_times: true
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to add to waitlist');
    }
  };

  const handleRemoveFromWaitlist = async (waitlistId) => {
    try {
      await axios.delete(`${API}/waitlist/${waitlistId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Removed from waitlist');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove from waitlist');
    }
  };

  const getRiskBadge = (level) => {
    switch (level) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertTriangle className="w-3 h-3" />
            High Risk
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <AlertCircle className="w-3 h-3" />
            Medium Risk
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <CheckCircle className="w-3 h-3" />
            Low Risk
          </span>
        );
    }
  };

  return (
    <TenantLayout title="No-Show Shield">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-[#666]">Loading...</div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto">
          {/* Header Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-[#E5E5E5] rounded-lg p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-3xl font-semibold text-[#0A0A0A]">{stats.high}</p>
                  <p className="text-sm text-[#666]">High Risk Bookings</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-[#E5E5E5] rounded-lg p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-3xl font-semibold text-[#0A0A0A]">{stats.medium}</p>
                  <p className="text-sm text-[#666]">Medium Risk Bookings</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-[#E5E5E5] rounded-lg p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-3xl font-semibold text-[#0A0A0A]">{waitlist.length}</p>
                  <p className="text-sm text-[#666]">On Waitlist</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-[#E5E5E5]">
            <button
              onClick={() => setActiveTab('at-risk')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'at-risk' 
                  ? 'border-orange-500 text-orange-600' 
                  : 'border-transparent text-[#666] hover:text-[#0A0A0A]'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              At-Risk Appointments ({stats.total})
            </button>
            <button
              onClick={() => setActiveTab('waitlist')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'waitlist' 
                  ? 'border-orange-500 text-orange-600' 
                  : 'border-transparent text-[#666] hover:text-[#0A0A0A]'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Waitlist ({waitlist.length})
            </button>
          </div>

          {/* At-Risk Appointments Tab */}
          {activeTab === 'at-risk' && (
            <div className="space-y-3">
              {atRiskAppointments.length === 0 ? (
                <div className="text-center py-16 bg-white border border-[#E5E5E5] rounded-lg">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <p className="text-lg font-medium text-[#0A0A0A]">All Clear!</p>
                  <p className="text-[#666] mt-1">No high-risk appointments in the next 7 days</p>
                </div>
              ) : (
                atRiskAppointments.map((appt) => (
                  <div 
                    key={appt.appointment_id}
                    className="bg-white border border-[#E5E5E5] rounded-lg p-4"
                    data-testid={`risk-appt-${appt.appointment_id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        {/* Risk indicator */}
                        <div className={`w-2 h-full min-h-[60px] rounded-full ${
                          appt.risk_level === 'high' ? 'bg-red-500' : 'bg-amber-400'
                        }`} />
                        
                        {/* Details */}
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-medium text-[#0A0A0A]">{appt.client_name || 'Walk-in'}</p>
                            {getRiskBadge(appt.risk_level)}
                          </div>
                          <p className="text-sm text-[#666]">
                            {appt.service_name} with {appt.staff_name}
                          </p>
                          <p className="text-sm text-[#666] flex items-center gap-1 mt-1">
                            <Calendar className="w-3 h-3" />
                            {format(parseISO(appt.start_time), 'EEE, MMM d')} at {format(parseISO(appt.start_time), 'h:mm a')}
                          </p>
                          
                          {/* Risk Factors */}
                          {appt.risk_factors && appt.risk_factors.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {appt.risk_factors.slice(0, 3).map((factor, idx) => (
                                <span 
                                  key={idx}
                                  className="text-xs bg-[#F5F5F5] text-[#666] px-2 py-0.5 rounded"
                                  title={factor.detail}
                                >
                                  {factor.factor.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {appt.client_phone && (
                          <a 
                            href={`tel:${appt.client_phone}`}
                            className="p-2 text-[#666] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] rounded"
                            title="Call client"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleSendReminder(appt.appointment_id)}
                          title="Send push notification reminder"
                        >
                          <Bell className="w-4 h-4 mr-1" />
                          Remind
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => handleMarkNoShow(appt.appointment_id)}
                        >
                          No-Show
                        </Button>
                      </div>
                    </div>
                    
                    {/* Risk Score Bar */}
                    <div className="mt-3 pt-3 border-t border-[#F5F5F5]">
                      <div className="flex items-center justify-between text-xs text-[#666] mb-1">
                        <span>Risk Score</span>
                        <span>{appt.risk_score}%</span>
                      </div>
                      <div className="w-full h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            appt.risk_level === 'high' ? 'bg-red-500' : 'bg-amber-400'
                          }`}
                          style={{ width: `${appt.risk_score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Waitlist Tab */}
          {activeTab === 'waitlist' && (
            <div>
              <div className="flex justify-end mb-4">
                <Button onClick={() => setShowAddWaitlist(true)} className="btn-primary">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add to Waitlist
                </Button>
              </div>
              
              {waitlist.length === 0 ? (
                <div className="text-center py-16 bg-white border border-[#E5E5E5] rounded-lg">
                  <div className="w-16 h-16 bg-[#FAFAFA] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-[#999]" />
                  </div>
                  <p className="text-lg font-medium text-[#0A0A0A]">Waitlist Empty</p>
                  <p className="text-[#666] mt-1">Add clients who want to be notified of cancellations</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {waitlist.map((entry) => (
                    <div 
                      key={entry.waitlist_id}
                      className="bg-white border border-[#E5E5E5] rounded-lg p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-[#0A0A0A]">{entry.client_name}</p>
                        <p className="text-sm text-[#666]">
                          {entry.client_phone || entry.client_email || 'No contact'}
                          {entry.service_id && ` • ${services.find(s => s.service_id === entry.service_id)?.name || 'Any service'}`}
                        </p>
                        {entry.notes && (
                          <p className="text-xs text-[#999] mt-1">{entry.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#999]">
                          Added {format(parseISO(entry.created_at), 'MMM d')}
                        </span>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleRemoveFromWaitlist(entry.waitlist_id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add to Waitlist Dialog */}
          <Dialog open={showAddWaitlist} onOpenChange={setShowAddWaitlist}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add to Waitlist</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Client Name *</Label>
                  <Input
                    value={newWaitlistEntry.client_name}
                    onChange={(e) => setNewWaitlistEntry({ ...newWaitlistEntry, client_name: e.target.value })}
                    placeholder="John Doe"
                    className="mt-1.5"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      value={newWaitlistEntry.client_phone}
                      onChange={(e) => setNewWaitlistEntry({ ...newWaitlistEntry, client_phone: e.target.value })}
                      placeholder="+353..."
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newWaitlistEntry.client_email}
                      onChange={(e) => setNewWaitlistEntry({ ...newWaitlistEntry, client_email: e.target.value })}
                      placeholder="email@..."
                      className="mt-1.5"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Preferred Service</Label>
                  <Select 
                    value={newWaitlistEntry.service_id || "any"} 
                    onValueChange={(v) => setNewWaitlistEntry({ ...newWaitlistEntry, service_id: v === "any" ? "" : v })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Any service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any service</SelectItem>
                      {services.map((service) => (
                        <SelectItem key={service.service_id} value={service.service_id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Preferred Staff</Label>
                  <Select 
                    value={newWaitlistEntry.preferred_staff_id || "any"} 
                    onValueChange={(v) => setNewWaitlistEntry({ ...newWaitlistEntry, preferred_staff_id: v === "any" ? "" : v })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Any staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any staff</SelectItem>
                      {staff.map((member) => (
                        <SelectItem key={member.staff_id} value={member.staff_id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={newWaitlistEntry.notes}
                    onChange={(e) => setNewWaitlistEntry({ ...newWaitlistEntry, notes: e.target.value })}
                    placeholder="Any preferences or notes..."
                    className="mt-1.5"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddWaitlist(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 btn-primary" onClick={handleAddToWaitlist}>
                    Add to Waitlist
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </TenantLayout>
  );
};

export default NoShowShieldPage;
