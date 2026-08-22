import { Body, Controller, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-auth.guard';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
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
}
