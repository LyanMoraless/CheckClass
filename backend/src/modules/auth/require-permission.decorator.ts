import { SetMetadata } from '@nestjs/common';
import { Permission } from './permission.enum';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

// Marks a route as needing at least one of the listed permission-group
// permissions (checked by PermissionCheckInterceptor, OR semantics — the
// caller passes if they hold any one of them). Deliberately separate from
// JwtAuthGuard, which only establishes identity — not every authenticated
// route requires a specific permission (e.g. pending-review resolution uses
// RULE-ATT-12's leadership chain instead, checked inside
// PendingReviewService itself).
export const RequirePermission = (...permissions: Permission[]) => SetMetadata(REQUIRED_PERMISSION_KEY, permissions);
