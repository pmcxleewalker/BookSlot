import React, { useState, useEffect } from 'react';
import { Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuSeparator 
} from '../../components/ui/dropdown-menu';
import { resourcesAPI } from '../../lib/api';
import { toast } from 'sonner';

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    resource_type: 'room',
    capacity: 1
  });

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      const data = await resourcesAPI.list();
      setResources(data);
    } catch (error) {
      console.error('Failed to load resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingResource) {
        await resourcesAPI.update(editingResource.resource_id, formData);
        toast.success('Resource updated');
      } else {
        await resourcesAPI.create(formData);
        toast.success('Resource created');
      }
      loadResources();
      closeModal();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (resourceId) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    try {
      await resourcesAPI.delete(resourceId);
      toast.success('Resource deleted');
      loadResources();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const openEditModal = (resource) => {
    setEditingResource(resource);
    setFormData({
      name: resource.name,
      description: resource.description || '',
      resource_type: resource.resource_type,
      capacity: resource.capacity
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingResource(null);
    setFormData({ name: '', description: '', resource_type: 'room', capacity: 1 });
  };

  const resourceTypes = ['room', 'equipment', 'table', 'chair', 'other'];

  return (
    <DashboardLayout title="Resources">
      <div className="space-y-6">
        <div className="bg-[#2E473B]/5 border border-[#2E473B]/20 rounded-xl p-4">
          <p className="text-sm text-[#2E473B]">
            Resources are rooms, equipment, or other bookable items that can be assigned to appointments.
            Available in Pro plan.
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
            data-testid="add-resource-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Resource
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E5E5E0] p-6 animate-pulse">
                <div className="h-4 w-24 bg-[#E5E5E0] rounded mb-2" />
                <div className="h-3 w-32 bg-[#E5E5E0] rounded" />
              </div>
            ))}
          </div>
        ) : resources.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E0] p-12">
            <div className="empty-state">
              <p className="text-[#6B6B6B] mb-4">No resources yet</p>
              <Button
                onClick={() => setShowModal(true)}
                className="rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white"
              >
                Add First Resource
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map((resource) => (
              <div 
                key={resource.resource_id}
                className="bg-white rounded-2xl border border-[#E5E5E0] p-6"
                data-testid={`resource-card-${resource.resource_id}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-[#1C1C1C]">{resource.name}</h3>
                    <p className="text-sm text-[#6B6B6B] capitalize">{resource.resource_type}</p>
                    {resource.description && (
                      <p className="text-sm text-[#6B6B6B] mt-2">{resource.description}</p>
                    )}
                    <p className="text-xs text-[#6B6B6B] mt-2">Capacity: {resource.capacity}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(resource)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(resource.resource_id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingResource ? 'Edit Resource' : 'Add Resource'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Room 1"
                required
                className="mt-1 rounded-xl"
                data-testid="resource-name-input"
              />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={formData.resource_type}
                onChange={(e) => setFormData({ ...formData, resource_type: e.target.value })}
                className="w-full mt-1 h-10 rounded-xl border border-[#E5E5E0] px-3"
              >
                {resourceTypes.map(type => (
                  <option key={type} value={type} className="capitalize">{type}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                className="mt-1 rounded-xl"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal} className="flex-1 rounded-xl">
                Cancel
              </Button>
              <Button type="submit" className="flex-1 rounded-xl bg-[#2E473B] hover:bg-[#243A2F] text-white" data-testid="save-resource-btn">
                {editingResource ? 'Update' : 'Add'} Resource
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
