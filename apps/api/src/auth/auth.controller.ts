import { Controller, Post, Body, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { loginSchema } from '@prepaid-shield/validators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
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
