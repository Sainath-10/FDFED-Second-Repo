import { ConfigService } from '@nestjs/config';

/** Tokens signed with a guessable fallback secret could be forged, so startup fails instead. */
export function requireJwtSecret(config: ConfigService): string {
  const secret = String(config.get<string>('JWT_SECRET') || '').trim();
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Add it to backend/.env (see .env.example) before starting the API.');
  }
  return secret;
}
