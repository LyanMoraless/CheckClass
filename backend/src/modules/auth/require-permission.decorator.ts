import { SetMetadata } from '@nestjs/common';
import { Permission } from './permission.enum';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

// Marks a route as needing a specific permission-group permission (checked by
// PermissionCheckInterceptor). Deliberately separate from JwtAuthGuard,
// which only establishes identity — not every authenticated route requires
// a specific permission (e.g. pending-review resolution uses RULE-ATT-12's
// leadership chain instead, checked inside PendingReviewService itself).
export const RequirePermission = (permission: Permission) => SetMetadata(REQUIRED_PERMISSION_KEY, permission);
