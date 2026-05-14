import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';

function mockContext(secret?: string) {
  const req: any = { headers: {} };
  if (secret) req.headers['x-admin-secret'] = secret;
  return {
    req,
    context: {
      switchToHttp: () => ({ getRequest: () => req }),
    } as any,
  };
}

describe('AdminAuthGuard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('requires an explicit admin secret outside demo or test mode', () => {
    delete process.env.ADMIN_API_SECRET;
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'false';
    const guard = new AdminAuthGuard();
    const { context } = mockContext('demo-admin-secret');

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('accepts the configured admin secret and attaches an admin user', () => {
    process.env.ADMIN_API_SECRET = 'real-secret';
    process.env.NODE_ENV = 'production';
    const guard = new AdminAuthGuard();
    const { req, context } = mockContext('real-secret');

    expect(guard.canActivate(context)).toBe(true);
    expect(req.user).toMatchObject({ role: 'admin', userId: 'trustpay-admin' });
  });
});
