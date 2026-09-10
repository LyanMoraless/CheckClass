import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInstitutionalMachineDto } from './dto/create-institutional-machine.dto';
import { UpdateInstitutionalMachineDto } from './dto/update-institutional-machine.dto';
import { InstitutionalMachineService } from './institutional-machine.service';

// RULE-DEV-04/15: no @RequirePermission here — authority is checked inside
// InstitutionalMachineService via LeadershipScopeService (Direção/Reitoria),
// the same pattern CourseController/ClassGroupController use for
// RULE-INST-09, not the Permission-enum/PermissionCheckInterceptor mechanism
// (RULE-ACC-08 confirms no dedicated code exists for this).
@Controller('v1/device-identity/institutional-machines')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class InstitutionalMachineController {
  constructor(private readonly machineService: InstitutionalMachineService) {}

  @Post()
  create(@Body() body: CreateInstitutionalMachineDto, @Req() request: AuthenticatedRequest) {
    return this.machineService.create(body, request.personId);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.machineService.list(request.personId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) {
    return this.machineService.get(id, request.personId);
  }

  // Covers both "editar" and "dar baixa" (RULE-DEV-15) — baixa is just
  // setting status to decommissioned/stolen via the same partial update.
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateInstitutionalMachineDto, @Req() request: AuthenticatedRequest) {
    return this.machineService.update(id, body, request.personId);
  }
}
