import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ConfirmDateOfBirthDto } from './dto/confirm-date-of-birth.dto';
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

  // RULE-GRD-05 read-control allowlist: no method-level @RequirePermission
  // override here (unlike list() above) — this stays under the class-level
  // MANAGE_USERS gate only, since the raw date_of_birth value is
  // Secretaria-exclusive. Used to pre-fill the Secretaria's own confirmation
  // form.
  @Get(':personId/date-of-birth')
  getDateOfBirth(@Param('personId', ParseUUIDPipe) personId: string) {
    return this.personManagementService.getDateOfBirthDetail(personId);
  }

  // RULE-GRD-07: presencial confirmation, Secretaria-only (same allowlist
  // reasoning as getDateOfBirth above). confirmedByPersonId always comes
  // from the verified JWT, never from the request body — same idiom as
  // every other "who did this" audit field in this codebase (e.g.
  // DeviceBindingController.upsertConfig).
  @Patch(':personId/date-of-birth')
  confirmDateOfBirth(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Body() body: ConfirmDateOfBirthDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.personManagementService.confirmDateOfBirth(personId, body.dateOfBirth, request.personId);
  }
}
