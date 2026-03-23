const API_URL = process.env.REACT_APP_BACKEND_URL;

// Generic fetch wrapper with auth
async function fetchAPI(endpoint, options = {}) {
  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }

  return response.json();
}

// Auth APIs
export const authAPI = {
  login: (email, password) => 
    fetchAPI('/api/auth/login', { method: 'POST', body: { email, password } }),
  
  register: (name, email, password) => 
    fetchAPI('/api/auth/register', { method: 'POST', body: { name, email, password } }),
  
  logout: () => 
    fetchAPI('/api/auth/logout', { method: 'POST' }),
  
  me: () => 
    fetchAPI('/api/auth/me'),
  
  processSession: (sessionId) => 
    fetchAPI('/api/auth/session', { method: 'POST', body: { session_id: sessionId } }),
};

// Onboarding APIs
export const onboardingAPI = {
  createBusiness: (data) => 
    fetchAPI('/api/onboarding/create-business', { method: 'POST', body: data }),
  
  getIndustryTemplate: (industry) => 
    fetchAPI(`/api/onboarding/industry-templates/${industry}`),
  
  applyTemplate: (services) => 
    fetchAPI('/api/onboarding/apply-template', { method: 'POST', body: { services } }),
};

// Staff APIs
export const staffAPI = {
  list: () => fetchAPI('/api/staff'),
  
  get: (staffId) => fetchAPI(`/api/staff/${staffId}`),
  
  create: (data) => 
    fetchAPI('/api/staff', { method: 'POST', body: data }),
  
  update: (staffId, data) => 
    fetchAPI(`/api/staff/${staffId}`, { method: 'PUT', body: data }),
  
  updateSchedule: (staffId, workingHours) => 
    fetchAPI(`/api/staff/${staffId}/schedule`, { method: 'PUT', body: { working_hours: workingHours } }),
  
  delete: (staffId) => 
    fetchAPI(`/api/staff/${staffId}`, { method: 'DELETE' }),
};

// Services APIs
export const servicesAPI = {
  list: () => fetchAPI('/api/services'),
  
  get: (serviceId) => fetchAPI(`/api/services/${serviceId}`),
  
  create: (data) => 
    fetchAPI('/api/services', { method: 'POST', body: data }),
  
  update: (serviceId, data) => 
    fetchAPI(`/api/services/${serviceId}`, { method: 'PUT', body: data }),
  
  delete: (serviceId) => 
    fetchAPI(`/api/services/${serviceId}`, { method: 'DELETE' }),
};

// Resources APIs
export const resourcesAPI = {
  list: () => fetchAPI('/api/resources'),
  
  create: (data) => 
    fetchAPI('/api/resources', { method: 'POST', body: data }),
  
  update: (resourceId, data) => 
    fetchAPI(`/api/resources/${resourceId}`, { method: 'PUT', body: data }),
  
  delete: (resourceId) => 
    fetchAPI(`/api/resources/${resourceId}`, { method: 'DELETE' }),
};

// Clients APIs
export const clientsAPI = {
  list: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return fetchAPI(`/api/clients${queryParams ? `?${queryParams}` : ''}`);
  },
  
  get: (clientId) => fetchAPI(`/api/clients/${clientId}`),
  
  create: (data) => 
    fetchAPI('/api/clients', { method: 'POST', body: data }),
  
  update: (clientId, data) => 
    fetchAPI(`/api/clients/${clientId}`, { method: 'PUT', body: data }),
};

// Appointments APIs
export const appointmentsAPI = {
  list: (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return fetchAPI(`/api/appointments${queryParams ? `?${queryParams}` : ''}`);
  },
  
  get: (appointmentId) => fetchAPI(`/api/appointments/${appointmentId}`),
  
  create: (data) => 
    fetchAPI('/api/appointments', { method: 'POST', body: data }),
  
  update: (appointmentId, data) => 
    fetchAPI(`/api/appointments/${appointmentId}`, { method: 'PUT', body: data }),
  
  cancel: (appointmentId, reason) => 
    fetchAPI(`/api/appointments/${appointmentId}/cancel`, { method: 'POST', body: { reason } }),
  
  complete: (appointmentId) => 
    fetchAPI(`/api/appointments/${appointmentId}/complete`, { method: 'POST' }),
  
  markNoShow: (appointmentId) => 
    fetchAPI(`/api/appointments/${appointmentId}/no-show`, { method: 'POST' }),
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: () => fetchAPI('/api/dashboard/stats'),
  
  getUpcoming: (limit = 10) => fetchAPI(`/api/dashboard/upcoming?limit=${limit}`),
};

// Settings APIs
export const settingsAPI = {
  getBusiness: () => fetchAPI('/api/settings/business'),
  
  updateBusiness: (data) => 
    fetchAPI('/api/settings/business', { method: 'PUT', body: data }),
};

// Subscription APIs
export const subscriptionAPI = {
  get: () => fetchAPI('/api/subscription'),
  
  upgrade: (plan) => 
    fetchAPI('/api/subscription/upgrade', { method: 'POST', body: { plan } }),
};

// Webhooks APIs
export const webhooksAPI = {
  list: () => fetchAPI('/api/webhooks'),
  
  create: (data) => 
    fetchAPI('/api/webhooks', { method: 'POST', body: data }),
  
  delete: (webhookId) => 
    fetchAPI(`/api/webhooks/${webhookId}`, { method: 'DELETE' }),
  
  getEvents: () => fetchAPI('/api/webhooks/events'),
};

// API Keys APIs
export const apiKeysAPI = {
  list: () => fetchAPI('/api/api-keys'),
  
  create: (name, permissions) => 
    fetchAPI('/api/api-keys', { method: 'POST', body: { name, permissions } }),
  
  delete: (apiKeyId) => 
    fetchAPI(`/api/api-keys/${apiKeyId}`, { method: 'DELETE' }),
};

// Public booking APIs (no auth required)
export const publicAPI = {
  getServices: (tenantSlug) => 
    fetchAPI(`/api/public/${tenantSlug}/services`),
  
  getStaff: (tenantSlug, serviceId) => {
    const params = serviceId ? `?service_id=${serviceId}` : '';
    return fetchAPI(`/api/public/${tenantSlug}/staff${params}`);
  },
  
  getAvailability: (tenantSlug, serviceId, date, staffId) => {
    const params = new URLSearchParams({ service_id: serviceId, date });
    if (staffId) params.append('staff_id', staffId);
    return fetchAPI(`/api/public/${tenantSlug}/availability?${params}`);
  },
  
  createBooking: (tenantSlug, data) => 
    fetchAPI(`/api/public/${tenantSlug}/book`, { method: 'POST', body: data }),
  
  getAppointment: (appointmentId) => 
    fetchAPI(`/api/public/manage/${appointmentId}`),
  
  cancelAppointment: (appointmentId, email) => 
    fetchAPI(`/api/public/manage/${appointmentId}/cancel`, { method: 'POST', body: { email } }),
};

export default {
  auth: authAPI,
  onboarding: onboardingAPI,
  staff: staffAPI,
  services: servicesAPI,
  resources: resourcesAPI,
  clients: clientsAPI,
  appointments: appointmentsAPI,
  dashboard: dashboardAPI,
  settings: settingsAPI,
  subscription: subscriptionAPI,
  webhooks: webhooksAPI,
  apiKeys: apiKeysAPI,
  public: publicAPI,
};
