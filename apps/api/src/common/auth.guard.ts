import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

const VALID_ROLES = ['consumer', 'business'] as const;

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userId = req.headers['x-user-id'];
    const role = req.headers['x-user-role'];

    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException('x-user-id 헤더가 필요합니다');
    }
    if (!role || !VALID_ROLES.includes(role as any)) {
      throw new UnauthorizedException('유효한 x-user-role 헤더가 필요합니다 (consumer | business)');
    }

    req.user = { userId, role };
    return true;
  }
}
