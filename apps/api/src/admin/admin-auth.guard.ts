import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

export interface AdminUser {
  userId: string;
  role: 'admin';
  name: string;
}

function getAdminSecret(): string {
  if (process.env.ADMIN_API_SECRET) return process.env.ADMIN_API_SECRET;
  if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return 'admin1234';
  }
  throw new UnauthorizedException('ADMIN_API_SECRET is required for admin access');
}

function getAdminId(): string {
  if (process.env.ADMIN_ID) return process.env.ADMIN_ID;
  if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return 'admin';
  }
  throw new UnauthorizedException('ADMIN_ID is required for admin access');
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const providedId = req.headers['x-admin-id'];
    const provided = req.headers['x-admin-secret'];
    const expectedId = getAdminId();
    const expected = getAdminSecret();
    if (typeof providedId !== 'string' || providedId !== expectedId || typeof provided !== 'string' || provided !== expected) {
      throw new UnauthorizedException('관리자 인증이 필요합니다');
    }
    req.user = { userId: 'trustpay-admin', role: 'admin', name: 'TrustPay 운영자' } satisfies AdminUser;
    return true;
  }
}
