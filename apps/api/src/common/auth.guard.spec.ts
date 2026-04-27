import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

function mockContext(headers: Record<string, string>, params: Record<string, string> = {}): ExecutionContext {
  const req = {
    headers,
    params,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const guard = new AuthGuard();

  it('should throw if x-user-id header missing', () => {
    const ctx = mockContext({ 'x-user-role': 'consumer' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw if x-user-role header missing', () => {
    const ctx = mockContext({ 'x-user-id': 'user-1' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw if x-user-role is invalid', () => {
    const ctx = mockContext({ 'x-user-id': 'user-1', 'x-user-role': 'admin' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should pass and attach user to request', () => {
    const ctx = mockContext({ 'x-user-id': 'user-1', 'x-user-role': 'consumer' });
    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
    const req = ctx.switchToHttp().getRequest();
    expect((req as any).user).toEqual({ userId: 'user-1', role: 'consumer' });
  });
});
