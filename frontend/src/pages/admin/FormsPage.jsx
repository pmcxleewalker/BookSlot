import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { FileText, Plus, Trash2, Edit2, ArrowUp, ArrowDown } from 'lucide-react';
import TenantLayout from '../../components/TenantLayout';
import { useAuth } from '../../App';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { API, errorMessage } from '../../lib/api';

const FIELD_TYPES = [
  ['text', 'Short answer'], ['textarea', 'Paragraph'], ['select', 'Dropdown'], ['checkbox', 'Tick box (yes/no)'],
  ['date', 'Date'], ['email', 'Email'], ['phone', 'Phone'],
];
const EMPTY = { name: '', description: '', fields: [], is_active: true, service_ids: [] };

const FormsPage = () => {
  const { tenant } = useAuth();
  const allowed = !!tenant?.features?.custom_forms;
  const [forms, setForms] = useState([]);
  const [services, setServices] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => {
    axios.get(`${API}/forms`).then((r) => setForms(r.data.forms || [])).catch(() => {});
    axios.get(`${API}/services`).then((r) => setServices(r.data.services || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const body = {
      ...editing,
      fields: editing.fields.map((f) => ({ ...f, options: f.field_type === 'select' ? (f.optionsText || '').split('\n').map((o) => o.trim()).filter(Boolean) : [] })),
    };
    try {
      if (editing.form_id) await axios.put(`${API}/forms/${editing.form_id}`, body);
      else await axios.post(`${API}/forms`, body);
      toast.success('Form saved');
      setEditing(null);
      load();
    } catch (e) { toast.error(errorMessage(e, 'Could not save form')); }
  };

  const remove = async (form) => {
    if (!window.confirm(`Delete "${form.name}"? Answers already given stay on past appointments.`)) return;
    try {
      await axios.delete(`${API}/forms/${form.form_id}`);
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const toggle = async (form, is_active) => {
    try {
      await axios.put(`${API}/forms/${form.form_id}`, { ...form, is_active });
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const edit = (form) => setEditing(form ? {
    ...form, fields: form.fields.map((f) => ({ ...f, optionsText: (f.options || []).join('\n') })),
  } : { ...EMPTY, fields: [{ label: '', field_type: 'text', required: false, optionsText: '' }] });

  const updateField = (i, patch) => setEditing((e) => ({ ...e, fields: e.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));
  const moveField = (i, dir) => setEditing((e) => {
    const fields = [...e.fields];
    const j = i + dir;
    if (j < 0 || j >= fields.length) return e;
    [fields[i], fields[j]] = [fields[j], fields[i]];
    return { ...e, fields };
  });

  return (
    <TenantLayout title="Forms">
      {!allowed ? (
        <div className="card-flat py-12 text-center">
          <FileText className="w-12 h-12 text-[#E5E5E5] mx-auto mb-4" />
          <h3 className="font-semibold text-[#0A0A0A] mb-2">Intake forms are a Pro feature</h3>
          <p className="text-[#666666]">Ask clients questions when they book - allergies, medical history, preferences, consent.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-[#666666]">Questions clients answer when they book online. Answers appear on the appointment.</p>
            <Button className="btn-primary flex items-center gap-2" onClick={() => edit(null)} data-testid="add-form-btn"><Plus className="w-4 h-4" />Create form</Button>
          </div>
          {forms.length === 0 ? (
            <div className="card-flat py-12 text-center">
              <FileText className="w-12 h-12 text-[#E5E5E5] mx-auto mb-4" />
              <h3 className="font-semibold text-[#0A0A0A] mb-2">No forms yet</h3>
              <Button className="btn-primary" onClick={() => edit(null)}>Create your first form</Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {forms.map((form) => (
                <div key={form.form_id} className="card-flat" data-testid={`form-${form.form_id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-[#0A0A0A]">{form.name}</h3>
                      <p className="text-sm text-[#666666]">{form.fields.length} question{form.fields.length === 1 ? '' : 's'} · {form.service_ids?.length ? `${form.service_ids.length} service(s)` : 'all services'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={form.is_active} onCheckedChange={(v) => toggle(form, v)} />
                      <Button variant="ghost" size="sm" onClick={() => edit(form)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => remove(form)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <ul className="mt-3 text-sm text-[#666666] list-disc pl-5">
                    {form.fields.slice(0, 4).map((f) => <li key={f.field_id}>{f.label}{f.required ? ' *' : ''}</li>)}
                    {form.fields.length > 4 && <li>+{form.fields.length - 4} more</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.form_id ? 'Edit form' : 'New form'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4 mt-2">
              <div>
                <Label>Form name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. New client questionnaire" />
              </div>
              <div>
                <Label>Intro text (optional)</Label>
                <Input value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <Label>Show for</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {services.map((s) => {
                    const on = editing.service_ids.includes(s.service_id);
                    return (
                      <button key={s.service_id} type="button" onClick={() => setEditing({ ...editing, service_ids: on ? editing.service_ids.filter((x) => x !== s.service_id) : [...editing.service_ids, s.service_id] })}
                        className={`px-3 py-1 text-sm border ${on ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]' : 'border-[#E5E5E5]'}`}>{s.name}</button>
                    );
                  })}
                </div>
                <p className="text-xs text-[#666666] mt-1">{editing.service_ids.length ? 'Only for the selected services' : 'Nothing selected = every service'}</p>
              </div>

              <div className="space-y-3">
                <Label>Questions</Label>
                {editing.fields.map((f, i) => (
                  <div key={i} className="p-3 border border-[#E5E5E5] space-y-2">
                    <div className="flex gap-2">
                      <Input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Question" className="flex-1" />
                      <select value={f.field_type} onChange={(e) => updateField(i, { field_type: e.target.value })} className="input-swiss !w-44">
                        {FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    {f.field_type === 'select' && (
                      <textarea value={f.optionsText || ''} onChange={(e) => updateField(i, { optionsText: e.target.value })} rows={3}
                        placeholder="One option per line" className="input-swiss resize-none text-sm" />
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} /> Required
                      </label>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => moveField(i, -1)}><ArrowUp className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => moveField(i, 1)}><ArrowDown className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setEditing({ ...editing, fields: editing.fields.filter((_, j) => j !== i) })}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setEditing({ ...editing, fields: [...editing.fields, { label: '', field_type: 'text', required: false, optionsText: '' }] })}>
                  <Plus className="w-4 h-4 mr-1" />Add question
                </Button>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
                <Button className="btn-primary flex-1" onClick={save} data-testid="save-form-btn">Save form</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TenantLayout>
  );
};

export default FormsPage;
