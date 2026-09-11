import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInstitutionalNetworkRangeDto } from './dto/create-institutional-network-range.dto';
import { UpdateInstitutionalNetworkRangeDto } from './dto/update-institutional-network-range.dto';
import { InstitutionalNetworkRangeService } from './institutional-network-range.service';

// GAP-10/RULE-DEV-14: no @RequirePermission here — authority is checked
// inside InstitutionalNetworkRangeService via LeadershipScopeService
// (Direção/Reitoria), the same pattern InstitutionalMachineController/
// DeviceBindingConfigService's config endpoints already use, not the
// Permission-enum/PermissionCheckInterceptor mechanism (RULE-ACC-08
// confirms no dedicated code exists for this kind of tenant-level
// inventory/config table).
@Controller('v1/institutional-network/ranges')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class InstitutionalNetworkRangeController {
  constructor(private readonly rangeService: InstitutionalNetworkRangeService) {}

  @Post()
  create(@Body() body: CreateInstitutionalNetworkRangeDto, @Req() request: AuthenticatedRequest) {
    return this.rangeService.create(body, request.personId);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.rangeService.list(request.personId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) {
    return this.rangeService.get(id, request.personId);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateInstitutionalNetworkRangeDto, @Req() request: AuthenticatedRequest) {
    return this.rangeService.update(id, body, request.personId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) {
    return this.rangeService.remove(id, request.personId);
  }
}
