import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MobileAuthService } from './mobile-auth.service';
import { PermissionCheckInterceptor } from './permission-check.interceptor';
import { PermissionGroupController } from './permission-group.controller';
import { PermissionGroupService } from './permission-group.service';
import { RefreshTokenService } from './refresh-token.service';
import { TenantBootstrapService } from './tenant-bootstrap.service';

const jwtModule = JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.get<string>('JWT_SECRET'),
    // 8h: roughly one work/school day — reasonable default for a
    // session token; not yet a confirmed product requirement.
    signOptions: { expiresIn: '8h', algorithm: 'HS256' },
    // Security review recommendation: pin verification to the same
    // algorithm explicitly, rather than relying on jsonwebtoken's default
    // inference staying safe across library upgrades (defense-in-depth —
    // a symmetric secret with no paired asymmetric key already rules out
    // classic HS/RS algorithm-confusion today).
    verifyOptions: { algorithms: ['HS256'] },
  }),
});

@Module({
  imports: [jwtModule],
  controllers: [AuthController, PermissionGroupController],
  providers: [
    AuthService,
    PermissionGroupService,
    TenantBootstrapService,
    JwtAuthGuard,
    PermissionCheckInterceptor,
    RefreshTokenService,
    MobileAuthService,
  ],
  // Re-exporting jwtModule too: every module that imports AuthModule for
  // JwtAuthGuard also needs JwtService in scope, or Nest can't resolve the
  // guard's constructor dependency (bit us once already — a guard's
  // provider deps must be resolvable from whichever module actually
  // instantiates it via @UseGuards, not just from AuthModule itself).
  // RefreshTokenService is exported too: it's the reusable
  // revoke-all-for-person primitive a future password-change flow
  // (PersonManagementService today has no credential-update path at all)
  // will need to call on password change.
  exports: [
    jwtModule,
    AuthService,
    PermissionGroupService,
    TenantBootstrapService,
    JwtAuthGuard,
    PermissionCheckInterceptor,
    RefreshTokenService,
  ],
})
export class AuthModule {}
