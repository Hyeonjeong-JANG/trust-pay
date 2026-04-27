import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(
    @Body()
    dto: {
      phone?: string;
      email?: string;
      role: 'consumer' | 'business';
      name?: string;
    },
  ) {
    return this.authService.login(dto);
  }
}
