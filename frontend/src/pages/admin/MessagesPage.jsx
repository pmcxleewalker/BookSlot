import React, { useState, useEffect } from 'react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { toast } from 'sonner';
import { Mail, MessageSquare, Bell, Edit2 } from 'lucide-react';

const MessagesPage = () => {
  const { token } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await axios.get(`${API}/messages/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (templateId, isActive) => {
    try {
      await axios.put(`${API}/messages/templates/${templateId}`, { is_active: isActive }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(isActive ? 'Template enabled' : 'Template disabled');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to update template');
    }
  };

  const handleSave = async () => {
    if (!editingTemplate) return;

    try {
      await axios.put(`${API}/messages/templates/${editingTemplate.template_id}`, {
        subject: editingTemplate.subject,
        content: editingTemplate.content
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Template saved');
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  const triggerLabels = {
    booking_confirmation: 'Booking Confirmation',
    reminder: 'Appointment Reminder',
    cancellation: 'Cancellation Notice'
  };

  return (
    <TenantLayout title="Messages & Reminders">
      <div className="mb-6">
        <p className="text-[#666666]">
          Configure automated messages sent to your clients. 
          <span className="text-amber-600 ml-1">(MOCKED - SMS/Email not actually sent)</span>
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[#666666]">Loading...</div>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <div key={template.template_id} className="card-flat" data-testid={`template-${template.template_id}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                    {template.type === 'email' ? (
                      <Mail className="w-5 h-5 text-[#666666]" />
                    ) : (
                      <MessageSquare className="w-5 h-5 text-[#666666]" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0A0A0A]">{template.name}</h3>
                    <p className="text-sm text-[#666666]">
                      {triggerLabels[template.trigger] || template.trigger} · {template.type.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Switch
                    checked={template.is_active}
                    onCheckedChange={(checked) => handleToggle(template.template_id, checked)}
                    data-testid={`toggle-${template.template_id}`}
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setEditingTemplate(template)}
                    data-testid={`edit-${template.template_id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {editingTemplate?.template_id === template.template_id ? (
                <div className="space-y-4 pt-4 border-t border-[#E5E5E5]">
                  {template.type === 'email' && (
                    <div>
                      <Label className="text-sm font-medium">Subject</Label>
                      <Input
                        value={editingTemplate.subject || ''}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                        className="mt-1.5"
                        data-testid="template-subject"
                      />
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium">Message Content</Label>
                    <textarea
                      value={editingTemplate.content}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                      rows={4}
                      className="mt-1.5 input-swiss resize-none font-mono text-sm"
                      data-testid="template-content"
                    />
                    <p className="text-xs text-[#666666] mt-2">
                      Available variables: {'{client_name}'}, {'{service_name}'}, {'{date}'}, {'{time}'}, {'{business_name}'}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                    <Button className="btn-primary" onClick={handleSave} data-testid="save-template">Save</Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[#666666] bg-[#FAFAFA] p-3 border border-[#E5E5E5] mt-2">
                  {template.content}
                </div>
              )}
            </div>
          ))}

          {templates.length === 0 && (
            <div className="card-flat py-12 text-center">
              <Bell className="w-12 h-12 text-[#E5E5E5] mx-auto mb-4" />
              <h3 className="font-semibold text-[#0A0A0A] mb-2">No message templates</h3>
              <p className="text-[#666666]">Message templates will appear here</p>
            </div>
          )}
        </div>
      )}
    </TenantLayout>
  );
};

export default MessagesPage;
