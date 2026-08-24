import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CreateWristbandCategoryAreaPermissionDto } from './dto/create-wristband-category-area-permission.dto';
import { CreateWristbandCategoryDto } from './dto/create-wristband-category.dto';
import { IssueWristbandDto } from './dto/issue-wristband.dto';
import { WristbandService } from './wristband.service';

// Wristbands are a person's physical identity credential (RULE-ACC-01), so
// this sits under MANAGE_USERS rather than MANAGE_INSTITUTION_STRUCTURE —
// closer in spirit to the CPF/credential management PersonManagementService
// already handles than to courses/rooms/sessions.
@Controller('v1/wristbands')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_USERS)
export class WristbandController {
  constructor(private readonly wristbandService: WristbandService) {}

  @Post('categories')
  createCategory(@Body() body: CreateWristbandCategoryDto) {
    return this.wristbandService.createCategory(body.name);
  }

  @Get('categories')
  listCategories() {
    return this.wristbandService.listCategories();
  }

  @Post()
  issue(@Body() body: IssueWristbandDto) {
    return this.wristbandService.issue(body);
  }

  @Post(':wristbandId/revoke')
  async revoke(@Param('wristbandId', ParseUUIDPipe) wristbandId: string) {
    await this.wristbandService.revoke(wristbandId);
    return { wristbandId, status: 'inactive' };
  }

  @Get()
  listByPerson(@Query('personId', ParseUUIDPipe) personId: string) {
    return this.wristbandService.listByPerson(personId);
  }

  // RULE-ACC-02's area/bloco/período grant is institutional structure
  // configuration, not identity-credential management — same conceptual
  // bucket AreaController sits under, so these two routes override the
  // controller's default MANAGE_USERS with MANAGE_INSTITUTION_STRUCTURE
  // (per-route override pattern PermissionCheckInterceptor documents).
  @Post('categories/:categoryId/area-permissions')
  @RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
  grantAreaPermission(@Param('categoryId', ParseUUIDPipe) categoryId: string, @Body() body: CreateWristbandCategoryAreaPermissionDto) {
    return this.wristbandService.grantAreaPermission({
      wristbandCategoryId: categoryId,
      areaId: body.areaId,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
    });
  }

  @Get('categories/:categoryId/area-permissions')
  @RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
  listAreaPermissions(@Param('categoryId', ParseUUIDPipe) categoryId: string) {
    return this.wristbandService.listAreaPermissionsByCategory(categoryId);
  }
}
