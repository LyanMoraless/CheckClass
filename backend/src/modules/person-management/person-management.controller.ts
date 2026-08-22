import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CreatePersonDto } from './dto/create-person.dto';
import { PersonManagementService } from './person-management.service';

@Controller('v1/users')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_USERS)
export class PersonManagementController {
  constructor(private readonly personManagementService: PersonManagementService) {}

  @Post()
  create(@Body() body: CreatePersonDto) {
    return this.personManagementService.createPerson(body);
  }

  // Added for the admin frontend: other screens (enrollment, wristband
  // issue, permission-group membership) need to look up a personId by name.
  // Method-level override (does NOT widen the class-level MANAGE_USERS
  // gate, which still covers create()): ClassGroupController.enroll() is
  // gated MANAGE_INSTITUTION_STRUCTURE and needs a personId to enroll
  // someone, so that permission alone must also be enough to list here.
  @Get()
  @RequirePermission(Permission.MANAGE_USERS, Permission.MANAGE_INSTITUTION_STRUCTURE)
  list() {
    return this.personManagementService.list();
  }
}
