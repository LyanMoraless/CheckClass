import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CameraService } from './camera.service';
import { CreateCameraDto } from './dto/create-camera.dto';

// RULE-ACC-07's six camera-permission codes are independent — list() and
// create() are gated differently, so each route sets its own
// @RequirePermission rather than relying on a single class-level default
// (same per-route override pattern PermissionCheckInterceptor documents).
@Controller('v1/cameras')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
export class CameraController {
  constructor(private readonly cameraService: CameraService) {}

  @Get()
  // OR semantics: either "view a specific camera" or "view a sector's
  // cameras" is enough to see the inventory list. Deliberately not narrowed
  // further this round — RULE-ACC-07's per-camera/per-sector distinction
  // isn't scoped by a parameter yet, so the same list is returned either way.
  @RequirePermission(Permission.VIEW_CAMERA, Permission.VIEW_SECTOR_CAMERAS)
  list() {
    return this.cameraService.list();
  }

  @Post()
  @RequirePermission(Permission.ADMINISTER_CAMERA_DEVICES)
  create(@Body() body: CreateCameraDto) {
    return this.cameraService.create(body);
  }
}
