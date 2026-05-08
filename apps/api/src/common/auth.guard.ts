import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifySessionToken } from './session-token';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authorization = req.headers.authorization;

    if (!authorization || typeof authorization !== 'string') {
      throw new UnauthorizedException('Authorization Bearer token이 필요합니다');
    }
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authorization Bearer token이 필요합니다');
    }

    try {
      req.user = verifySessionToken(token);
    } catch {
      throw new UnauthorizedException('유효하지 않거나 만료된 세션입니다');
    }
    return true;
  }
}
