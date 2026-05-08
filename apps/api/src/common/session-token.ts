import { createHmac, timingSafeEqual } from 'crypto';

export type SessionRole = 'consumer' | 'business';

export interface SessionUser {
  userId: string;
  role: SessionRole;
  name: string;
}

interface SessionPayload extends SessionUser {
  exp: number;
}

const DEV_ONLY_SESSION_SECRET = 'dev-only-session-secret-change-prod-32ch';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  const configured = process.env.AUTH_SESSION_SECRET || process.env.ENCRYPTION_KEY;
  if (configured) return configured;
  if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'test') {
    return DEV_ONLY_SESSION_SECRET;
  }
  throw new Error('AUTH_SESSION_SECRET or ENCRYPTION_KEY is required for session tokens');
}

function sign(payload: string) {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(user: SessionUser) {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token: string): SessionUser {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) throw new Error('Malformed session token');

  const expected = sign(encoded);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid session signature');
  }

  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as SessionPayload;
  if (!payload.userId || !['consumer', 'business'].includes(payload.role) || !payload.name) {
    throw new Error('Invalid session payload');
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Expired session token');
  }

  return { userId: payload.userId, role: payload.role, name: payload.name };
}
