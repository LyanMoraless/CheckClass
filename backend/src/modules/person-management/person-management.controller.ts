import { Body, Controller, Post, UseGuards, UseInterceptors } from '@nestjs/common';
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
}
