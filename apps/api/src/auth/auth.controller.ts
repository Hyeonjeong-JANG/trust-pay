import { Controller, Post, Body, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { requestCodeSchema, verifyCodeSchema } from '@prepaid-shield/validators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-code')
  @UsePipes(new ZodValidationPipe(requestCodeSchema))
  requestCode(
    @Body()
    dto: {
      phone?: string;
      email?: string;
      role: 'consumer' | 'business';
      name?: string;
    },
  ) {
    return this.authService.requestCode(dto);
  }

  @Post('verify-code')
  @UsePipes(new ZodValidationPipe(verifyCodeSchema))
  verifyCode(
    @Body()
    dto: {
      phone?: string;
      email?: string;
      role: 'consumer' | 'business';
      name?: string;
      code: string;
    },
  ) {
    return this.authService.verifyCode(dto);
  }
}
