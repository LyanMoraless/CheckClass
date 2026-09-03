import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePermissionGroupDto } from './create-permission-group.dto';
import { Permission } from '../permission.enum';

// RULE-ACC-07: camera permissions narrowed from six codes to five,
// FOLLOW_CAMERA_EVENTS removed entirely from the Permission enum. There's no
// DB-level CHECK constraint on permission_group_permission.permission_code
// (varchar(50), see AddAuthAndPermissionGroups migration) — @IsEnum(Permission,
// { each: true }) on this DTO is the *only* runtime gate keeping a stale or
// malicious client from persisting a permission code that no longer exists.
// permission-group.service.spec.ts and permission-group.controller.spec.ts
// both call their subject directly with already-TypeScript-typed
// Permission[] values, which only catches a removed member at compile time —
// this spec exercises the same plainToInstance+validate path NestJS's global
// ValidationPipe runs in production, against a raw string payload the way an
// actual (e.g. stale frontend/old bookmarked request) HTTP body would arrive.
describe('CreatePermissionGroupDto', () => {
  async function validatePermissions(permissions: unknown) {
    const dto = plainToInstance(CreatePermissionGroupDto, { name: 'Some Group', permissions });
    const errors = await validate(dto);
    return errors.filter((error) => error.property === 'permissions');
  }

  test('test_permissions_currentlyValidCameraCodes_allAccepted', async () => {
    const errors = await validatePermissions([
      Permission.VIEW_CAMERA,
      Permission.VIEW_SECTOR_CAMERAS,
      Permission.FULLSCREEN_CAMERA,
      Permission.ACCESS_CAMERA_RECORDINGS,
      Permission.ADMINISTER_CAMERA_DEVICES,
    ]);

    expect(errors).toHaveLength(0);
  });

  // The exact regression this spec exists to catch: 'follow_camera_events'
  // was a valid Permission value before RULE-ACC-07 removed it, and must now
  // be rejected by @IsEnum rather than silently persisted.
  test('test_permissions_followCameraEvents_rejectedAsNoLongerAValidPermission', async () => {
    const errors = await validatePermissions(['follow_camera_events']);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  test('test_permissions_mixOfValidAndRemovedCode_stillRejected', async () => {
    const errors = await validatePermissions([Permission.VIEW_CAMERA, 'follow_camera_events']);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  test('test_permissions_arbitraryUnknownString_rejected', async () => {
    const errors = await validatePermissions(['not_a_real_permission']);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  test('test_permissions_emptyArray_accepted', async () => {
    const errors = await validatePermissions([]);

    expect(errors).toHaveLength(0);
  });
});
