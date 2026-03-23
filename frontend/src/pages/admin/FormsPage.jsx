import React from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../App';
import { Button } from '../../components/ui/button';
import { FileText, Plus } from 'lucide-react';

const FormsPage = () => {
  const { tenant } = useAuth();
  const isPro = tenant?.plan === 'pro';

  return (
    <AdminLayout title="Forms">
      {!isPro ? (
        <div className="card-flat py-12 text-center">
          <FileText className="w-12 h-12 text-[#E5E5E5] mx-auto mb-4" />
          <h3 className="font-semibold text-[#0A0A0A] mb-2">Custom Forms is a Pro Feature</h3>
          <p className="text-[#666666] mb-4">Upgrade to Pro to create custom intake forms and questionnaires</p>
          <Button className="btn-primary">Upgrade to Pro</Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-[#666666]">Create custom intake forms for your clients</p>
            <Button className="btn-primary flex items-center gap-2" data-testid="add-form-btn">
              <Plus className="w-4 h-4" />
              Create Form
            </Button>
          </div>

          <div className="card-flat py-12 text-center">
            <FileText className="w-12 h-12 text-[#E5E5E5] mx-auto mb-4" />
            <h3 className="font-semibold text-[#0A0A0A] mb-2">No forms yet</h3>
            <p className="text-[#666666] mb-4">Create intake forms to collect client information before appointments</p>
            <Button className="btn-primary">Create Your First Form</Button>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default FormsPage;
