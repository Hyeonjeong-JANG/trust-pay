import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';

function mockContext(secret?: string, adminId?: string) {
  const req: any = { headers: {} };
  if (secret) req.headers['x-admin-secret'] = secret;
  if (adminId) req.headers['x-admin-id'] = adminId;
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

  it('requires explicit admin credentials outside demo or test mode', () => {
    delete process.env.ADMIN_API_SECRET;
    delete process.env.ADMIN_ID;
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'false';
    const guard = new AdminAuthGuard();
    const { context } = mockContext('admin1234', 'admin');

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('accepts the configured admin credentials and attaches an admin user', () => {
    process.env.ADMIN_ID = 'ops-admin';
    process.env.ADMIN_API_SECRET = 'real-secret';
    process.env.NODE_ENV = 'production';
    const guard = new AdminAuthGuard();
    const { req, context } = mockContext('real-secret', 'ops-admin');

    expect(guard.canActivate(context)).toBe(true);
    expect(req.user).toMatchObject({ role: 'admin', userId: 'trustpay-admin' });
  });

  it('rejects the configured secret when the admin id is missing', () => {
    process.env.ADMIN_ID = 'ops-admin';
    process.env.ADMIN_API_SECRET = 'real-secret';
    process.env.NODE_ENV = 'production';
    const guard = new AdminAuthGuard();
    const { context } = mockContext('real-secret');

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('accepts admin/admin1234 as the local demo admin credentials', () => {
    delete process.env.ADMIN_API_SECRET;
    delete process.env.ADMIN_ID;
    process.env.NODE_ENV = 'development';
    const guard = new AdminAuthGuard();
    const { req, context } = mockContext('admin1234', 'admin');

    expect(guard.canActivate(context)).toBe(true);
    expect(req.user).toMatchObject({ role: 'admin', userId: 'trustpay-admin' });
  });
});
