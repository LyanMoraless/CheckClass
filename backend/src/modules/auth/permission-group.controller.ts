import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AssignPersonToGroupDto } from './dto/assign-person-to-group.dto';
import { CreatePermissionGroupDto } from './dto/create-permission-group.dto';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import { PermissionCheckInterceptor } from './permission-check.interceptor';
import { Permission } from './permission.enum';
import { PermissionGroupService } from './permission-group.service';
import { RequirePermission } from './require-permission.decorator';

// Group management is scoped under MANAGE_USERS (confirmed 2026-08-22:
// "cadastrar/editar/desativar pessoas; atribuir a grupos" covers creating
// the groups people get assigned to too — no separate permission for it).
@Controller('v1/permission-groups')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_USERS)
export class PermissionGroupController {
  constructor(private readonly permissionGroupService: PermissionGroupService) {}

  // Added for the admin frontend: assigning a member needs a list of
  // existing groups to choose from.
  @Get()
  list() {
    return this.permissionGroupService.listGroups();
  }

  @Post()
  async create(@Body() body: CreatePermissionGroupDto, @Req() request: AuthenticatedRequest) {
    // Security review finding: MANAGE_USERS alone must not let a caller
    // grant permissions they don't themselves hold — otherwise it's
    // equivalent to full admin via self-service group creation. The one
    // legitimate exception (granting every permission with no prior holder)
    // is TenantBootstrapService calling the service directly, not this route.
    const ownPermissions = await this.permissionGroupService.getPermissionsForPerson(request.personId);
    const notOwned = body.permissions.filter((permission) => !ownPermissions.includes(permission));
    if (notOwned.length > 0) {
      throw new ForbiddenException(`Cannot grant permission(s) you don't hold yourself: ${notOwned.join(', ')}`);
    }

    const group = await this.permissionGroupService.createGroup(body.name, body.permissions);
    return { permissionGroupId: group.id };
  }

  @Post(':permissionGroupId/members')
  async assignMember(
    @Param('permissionGroupId', ParseUUIDPipe) permissionGroupId: string,
    @Body() body: AssignPersonToGroupDto,
  ) {
    await this.permissionGroupService.assignPersonToGroup(body.personId, permissionGroupId);
    return { permissionGroupId, personId: body.personId };
  }
}
