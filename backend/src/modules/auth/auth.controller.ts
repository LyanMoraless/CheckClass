import { Body, Controller, Get, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedRequest, JwtAuthGuard, JwtPayload } from './jwt-auth.guard';
import { Permission } from './permission.enum';
import { PermissionGroupService } from './permission-group.service';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly permissionGroupService: PermissionGroupService,
  ) {}

  @Post('login')
  // Security review finding: the app-wide default throttle (100 req/min)
  // was sized for the device-ingestion endpoint, a materially weaker bar
  // against online brute-forcing of a human password. 10/min per IP is
  // still generous for a legitimate user mistyping a password, but bounds
  // an automated guessing loop.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() body: LoginDto): Promise<{ accessToken: string }> {
    const { personId, tenantId } = await this.authService.login(body.cpf, body.password);
    const payload: JwtPayload = { personId, tenantId };
    return { accessToken: this.jwtService.sign(payload) };
  }

  // Added for the admin frontend (no other consumer needs it yet): lets the
  // UI know which of the 4 permissions the logged-in person holds, so it can
  // hide/disable actions instead of only reacting to a 403 after the fact.
  // Deliberately returns ALL 4 checked individually rather than exposing
  // permission-group membership itself — the frontend only ever needs the
  // yes/no answer per permission, not the groups behind it.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(TenantContextInterceptor)
  async me(@Req() request: AuthenticatedRequest): Promise<{ personId: string; permissions: Permission[] }> {
    const permissions = await this.permissionGroupService.getPermissionsForPerson(request.personId);
    return { personId: request.personId, permissions };
  }
}
