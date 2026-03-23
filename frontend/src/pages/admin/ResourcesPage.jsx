import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useAuth, API } from '../../App';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Box } from 'lucide-react';

const ResourcesPage = () => {
  const { token, tenant } = useAuth();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    resource_type: 'room',
    capacity: 1
  });

  const resourceTypes = ['room', 'equipment', 'vehicle', 'other'];

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const response = await axios.get(`${API}/resources`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResources(response.data.resources || []);
    } catch (error) {
      console.error('Failed to load resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (resource = null) => {
    if (resource) {
      setEditingResource(resource);
      setFormData({
        name: resource.name,
        description: resource.description || '',
        resource_type: resource.resource_type,
        capacity: resource.capacity
      });
    } else {
      setEditingResource(null);
      setFormData({ name: '', description: '', resource_type: 'room', capacity: 1 });
    }
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Resource name is required');
      return;
    }

    try {
      if (editingResource) {
        await axios.put(`${API}/resources/${editingResource.resource_id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Resource updated');
      } else {
        await axios.post(`${API}/resources`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Resource created');
      }
      setShowDialog(false);
      fetchResources();
    } catch (error) {
      toast.error('Failed to save resource');
    }
  };

  const handleDelete = async (resourceId) => {
    if (!window.confirm('Are you sure you want to delete this resource?')) return;

    try {
      await axios.delete(`${API}/resources/${resourceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Resource deleted');
      fetchResources();
    } catch (error) {
      toast.error('Failed to delete resource');
    }
  };

  const isPro = tenant?.plan === 'pro';

  return (
    <AdminLayout title="Resources">
      {!isPro ? (
        <div className="card-flat py-12 text-center">
          <Box className="w-12 h-12 text-[#E5E5E5] mx-auto mb-4" />
          <h3 className="font-semibold text-[#0A0A0A] mb-2">Resource Booking is a Pro Feature</h3>
          <p className="text-[#666666] mb-4">Upgrade to Pro to manage rooms, equipment, and other resources</p>
          <Button className="btn-primary">Upgrade to Pro</Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-[#666666]">{resources.length} resources</p>
            <Button 
              onClick={() => openDialog()} 
              className="btn-primary flex items-center gap-2"
              data-testid="add-resource-btn"
            >
              <Plus className="w-4 h-4" />
              Add Resource
            </Button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-[#666666]">Loading...</div>
          ) : resources.length === 0 ? (
            <div className="card-flat py-12 text-center">
              <Box className="w-12 h-12 text-[#E5E5E5] mx-auto mb-4" />
              <h3 className="font-semibold text-[#0A0A0A] mb-2">No resources yet</h3>
              <p className="text-[#666666] mb-4">Add rooms, equipment, or other bookable resources</p>
              <Button onClick={() => openDialog()} className="btn-primary">Add First Resource</Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resources.map((resource) => (
                <div key={resource.resource_id} className="card-hover" data-testid={`resource-${resource.resource_id}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center">
                        <Box className="w-5 h-5 text-[#666666]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#0A0A0A]">{resource.name}</h3>
                        <p className="text-xs text-[#666666] capitalize">{resource.resource_type}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDialog(resource)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDelete(resource.resource_id)}
                        className="text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {resource.description && (
                    <p className="text-sm text-[#666666] mb-4">{resource.description}</p>
                  )}
                  <div className="text-sm text-[#666666]">
                    Capacity: {resource.capacity}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingResource ? 'Edit Resource' : 'Add Resource'}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-sm font-medium">Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Room 1, Massage Table"
                    className="mt-1.5"
                    data-testid="resource-name-input"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description"
                    rows={2}
                    className="mt-1.5 input-swiss resize-none"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">Type</Label>
                  <select
                    value={formData.resource_type}
                    onChange={(e) => setFormData({ ...formData, resource_type: e.target.value })}
                    className="mt-1.5 input-swiss"
                    data-testid="resource-type-select"
                  >
                    {resourceTypes.map((type) => (
                      <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-sm font-medium">Capacity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                    className="mt-1.5"
                    data-testid="resource-capacity-input"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 btn-primary" onClick={handleSubmit} data-testid="save-resource-btn">
                    {editingResource ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </AdminLayout>
  );
};

export default ResourcesPage;
