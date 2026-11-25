import jwt from 'jsonwebtoken';
import { get } from '../config/database.js';

/**
 * Sign-in tokens. Each carries the user's token_version (`tv`); changing the
 * password bumps the version, which ends every session signed in before it.
 */

const TOKEN_LIFETIME = '7d';

export const jwtSecret = () => Buffer.from(process.env.JWT_SECRET, 'base64');

/** A token for this user, at their current token_version. */
export function signToken(userId) {
  const user = get('SELECT id, email, token_version FROM users WHERE id = ?', [userId]);
  return jwt.sign({ id: user.id, email: user.email, tv: user.token_version ?? 0 }, jwtSecret(), { expiresIn: TOKEN_LIFETIME });
}

/**
 * The token's claims if it is valid and still current, else null. Tokens from
 * before versioning have no `tv` and count as version 0.
 */
export function verifyToken(token) {
  let claims;
  try {
    claims = jwt.verify(token, jwtSecret());
  } catch {
    return null;
  }
  const user = get('SELECT token_version FROM users WHERE id = ?', [claims.id]);
  if (!user || (claims.tv ?? 0) !== (user.token_version ?? 0)) return null;
  return claims;
}
