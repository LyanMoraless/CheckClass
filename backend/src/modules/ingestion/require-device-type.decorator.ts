import { SetMetadata } from '@nestjs/common';

export const REQUIRED_DEVICE_TYPE_KEY = 'requiredDeviceType';

// Marks a device-authenticated route as accepting only devices whose
// device_type is one of the listed values (OR semantics, mirrors
// @RequirePermission's shape) — checked by DeviceAuthGuard right after
// authentication succeeds. Turns device_type from purely descriptive
// metadata into an enforced capability boundary: one device-auth mechanism
// now spans two domains of differing sensitivity (attendance ingestion and
// security ingestion), so a leaked attendance-reader API key must never
// also authenticate against the security-ingestion gateway, and vice versa.
export const RequireDeviceType = (...deviceTypes: string[]) => SetMetadata(REQUIRED_DEVICE_TYPE_KEY, deviceTypes);
