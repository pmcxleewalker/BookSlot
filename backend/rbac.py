"""
Role-Based Access Control (RBAC) for TimeSlot Pro
Defines permissions for each role and provides middleware for enforcement
"""
from enum import Enum
from typing import Optional, List, Dict, Any, Set
from fastapi import HTTPException, Request
from functools import wraps

from models import UserRole


# Permission definitions
class Permission(str, Enum):
    # Appointments
    APPOINTMENTS_VIEW = "appointments:view"
    APPOINTMENTS_CREATE = "appointments:create"
    APPOINTMENTS_EDIT = "appointments:edit"
    APPOINTMENTS_DELETE = "appointments:delete"
    APPOINTMENTS_VIEW_ALL = "appointments:view_all"  # See all staff appointments
    
    # Staff
    STAFF_VIEW = "staff:view"
    STAFF_CREATE = "staff:create"
    STAFF_EDIT = "staff:edit"
    STAFF_DELETE = "staff:delete"
    
    # Services
    SERVICES_VIEW = "services:view"
    SERVICES_CREATE = "services:create"
    SERVICES_EDIT = "services:edit"
    SERVICES_DELETE = "services:delete"
    
    # Clients
    CLIENTS_VIEW = "clients:view"
    CLIENTS_CREATE = "clients:create"
    CLIENTS_EDIT = "clients:edit"
    CLIENTS_DELETE = "clients:delete"
    
    # Resources
    RESOURCES_VIEW = "resources:view"
    RESOURCES_CREATE = "resources:create"
    RESOURCES_EDIT = "resources:edit"
    RESOURCES_DELETE = "resources:delete"
    
    # Settings
    SETTINGS_VIEW = "settings:view"
    SETTINGS_EDIT = "settings:edit"
    BRANDING_EDIT = "branding:edit"
    
    # Billing & Subscription
    BILLING_VIEW = "billing:view"
    BILLING_MANAGE = "billing:manage"
    INVOICES_VIEW = "invoices:view"
    INVOICES_CREATE = "invoices:create"
    
    # Integrations
    WEBHOOKS_VIEW = "webhooks:view"
    WEBHOOKS_MANAGE = "webhooks:manage"
    API_KEYS_VIEW = "api_keys:view"
    API_KEYS_MANAGE = "api_keys:manage"
    
    # Users & Roles
    USERS_VIEW = "users:view"
    USERS_MANAGE = "users:manage"
    
    # Danger Zone
    TENANT_DELETE = "tenant:delete"
    DATA_EXPORT = "data:export"


# Role -> Permissions mapping
ROLE_PERMISSIONS: Dict[UserRole, Set[Permission]] = {
    UserRole.OWNER: {
        # Owners have ALL permissions
        Permission.APPOINTMENTS_VIEW,
        Permission.APPOINTMENTS_CREATE,
        Permission.APPOINTMENTS_EDIT,
        Permission.APPOINTMENTS_DELETE,
        Permission.APPOINTMENTS_VIEW_ALL,
        Permission.STAFF_VIEW,
        Permission.STAFF_CREATE,
        Permission.STAFF_EDIT,
        Permission.STAFF_DELETE,
        Permission.SERVICES_VIEW,
        Permission.SERVICES_CREATE,
        Permission.SERVICES_EDIT,
        Permission.SERVICES_DELETE,
        Permission.CLIENTS_VIEW,
        Permission.CLIENTS_CREATE,
        Permission.CLIENTS_EDIT,
        Permission.CLIENTS_DELETE,
        Permission.RESOURCES_VIEW,
        Permission.RESOURCES_CREATE,
        Permission.RESOURCES_EDIT,
        Permission.RESOURCES_DELETE,
        Permission.SETTINGS_VIEW,
        Permission.SETTINGS_EDIT,
        Permission.BRANDING_EDIT,
        Permission.BILLING_VIEW,
        Permission.BILLING_MANAGE,
        Permission.INVOICES_VIEW,
        Permission.INVOICES_CREATE,
        Permission.WEBHOOKS_VIEW,
        Permission.WEBHOOKS_MANAGE,
        Permission.API_KEYS_VIEW,
        Permission.API_KEYS_MANAGE,
        Permission.USERS_VIEW,
        Permission.USERS_MANAGE,
        Permission.TENANT_DELETE,
        Permission.DATA_EXPORT,
    },
    
    UserRole.ADMIN: {
        # Admins can do most things except delete tenant or manage billing
        Permission.APPOINTMENTS_VIEW,
        Permission.APPOINTMENTS_CREATE,
        Permission.APPOINTMENTS_EDIT,
        Permission.APPOINTMENTS_DELETE,
        Permission.APPOINTMENTS_VIEW_ALL,
        Permission.STAFF_VIEW,
        Permission.STAFF_CREATE,
        Permission.STAFF_EDIT,
        Permission.STAFF_DELETE,
        Permission.SERVICES_VIEW,
        Permission.SERVICES_CREATE,
        Permission.SERVICES_EDIT,
        Permission.SERVICES_DELETE,
        Permission.CLIENTS_VIEW,
        Permission.CLIENTS_CREATE,
        Permission.CLIENTS_EDIT,
        Permission.CLIENTS_DELETE,
        Permission.RESOURCES_VIEW,
        Permission.RESOURCES_CREATE,
        Permission.RESOURCES_EDIT,
        Permission.RESOURCES_DELETE,
        Permission.SETTINGS_VIEW,
        Permission.SETTINGS_EDIT,
        Permission.BRANDING_EDIT,
        Permission.BILLING_VIEW,  # Can view but not manage
        Permission.INVOICES_VIEW,
        Permission.INVOICES_CREATE,
        Permission.WEBHOOKS_VIEW,
        Permission.WEBHOOKS_MANAGE,
        Permission.API_KEYS_VIEW,
        Permission.API_KEYS_MANAGE,
        Permission.USERS_VIEW,
        Permission.USERS_MANAGE,
        Permission.DATA_EXPORT,
    },
    
    UserRole.MANAGER: {
        # Managers can manage day-to-day operations
        Permission.APPOINTMENTS_VIEW,
        Permission.APPOINTMENTS_CREATE,
        Permission.APPOINTMENTS_EDIT,
        Permission.APPOINTMENTS_DELETE,
        Permission.APPOINTMENTS_VIEW_ALL,
        Permission.STAFF_VIEW,
        Permission.STAFF_CREATE,
        Permission.STAFF_EDIT,
        # Cannot delete staff
        Permission.SERVICES_VIEW,
        Permission.SERVICES_CREATE,
        Permission.SERVICES_EDIT,
        # Cannot delete services
        Permission.CLIENTS_VIEW,
        Permission.CLIENTS_CREATE,
        Permission.CLIENTS_EDIT,
        Permission.CLIENTS_DELETE,
        Permission.RESOURCES_VIEW,
        Permission.RESOURCES_CREATE,
        Permission.RESOURCES_EDIT,
        Permission.SETTINGS_VIEW,
        # Cannot edit settings
        Permission.INVOICES_VIEW,
        Permission.INVOICES_CREATE,
        Permission.USERS_VIEW,
    },
    
    UserRole.STAFF: {
        # Staff can only manage their own appointments and view things
        Permission.APPOINTMENTS_VIEW,  # Own appointments only
        Permission.APPOINTMENTS_CREATE,
        Permission.APPOINTMENTS_EDIT,  # Own appointments only
        # Cannot delete appointments
        Permission.STAFF_VIEW,  # View only
        Permission.SERVICES_VIEW,
        Permission.CLIENTS_VIEW,
        Permission.CLIENTS_CREATE,
        Permission.RESOURCES_VIEW,
    },
}


def has_permission(role: UserRole, permission: Permission) -> bool:
    """Check if a role has a specific permission"""
    role_perms = ROLE_PERMISSIONS.get(role, set())
    return permission in role_perms


def get_role_permissions(role: UserRole) -> List[str]:
    """Get list of permissions for a role"""
    return [p.value for p in ROLE_PERMISSIONS.get(role, set())]


async def require_permission(
    request: Request,
    user: Any,
    permission: Permission,
    resource_owner_id: Optional[str] = None
):
    """
    Check if user has required permission.
    Raises HTTPException if not authorized.
    
    For staff role, also checks if they own the resource (for edit operations).
    """
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_role = UserRole(user.role) if isinstance(user.role, str) else user.role
    
    # Check basic permission
    if not has_permission(user_role, permission):
        raise HTTPException(
            status_code=403,
            detail=f"Permission denied. Required: {permission.value}"
        )
    
    # For staff role, check ownership for certain operations
    if user_role == UserRole.STAFF and resource_owner_id:
        # Staff can only edit their own appointments/resources
        # Get staff_id for this user
        if hasattr(user, 'staff_id') and user.staff_id != resource_owner_id:
            raise HTTPException(
                status_code=403,
                detail="You can only modify your own resources"
            )
    
    return True


def check_permission(permission: Permission):
    """
    Decorator to check permission before endpoint execution.
    Use after authentication middleware.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = kwargs.get('request')
            if not request:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            
            if not request:
                raise HTTPException(status_code=500, detail="Request not found")
            
            # User should be attached by auth middleware
            user = getattr(request.state, 'user', None)
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            await require_permission(request, user, permission)
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


# Permission groups for common operations
APPOINTMENT_WRITE_PERMS = {
    Permission.APPOINTMENTS_CREATE,
    Permission.APPOINTMENTS_EDIT,
    Permission.APPOINTMENTS_DELETE
}

ADMIN_PERMS = {
    Permission.SETTINGS_EDIT,
    Permission.BILLING_MANAGE,
    Permission.USERS_MANAGE,
    Permission.TENANT_DELETE
}

MANAGER_PERMS = {
    Permission.STAFF_CREATE,
    Permission.STAFF_EDIT,
    Permission.SERVICES_CREATE,
    Permission.SERVICES_EDIT,
    Permission.INVOICES_CREATE
}
