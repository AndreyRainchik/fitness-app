import crypto from 'crypto';

/**
 * Encrypts small secrets (third-party API keys) before they are written to
 * the database, so a copy of the database file alone doesn't reveal them.
 *
 * The key comes from SECRETS_ENCRYPTION_KEY when set, otherwise it is derived
 * from JWT_SECRET. Changing either makes stored secrets unreadable; the user
 * then has to enter them again.
 */

function getKey() {
  const material = process.env.SECRETS_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!material) {
    throw new Error('SECRETS_ENCRYPTION_KEY or JWT_SECRET must be set to store API keys');
  }
  return crypto.createHash('sha256').update(`fitness-app-secrets:${material}`).digest();
}

/** Returns "v1:<iv>:<tag>:<ciphertext>" (base64 parts). */
export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Returns the plaintext, or null if the value can't be decrypted with the current key. */
export function decryptSecret(stored) {
  try {
    const [version, iv, tag, ciphertext] = String(stored).split(':');
    if (version !== 'v1') return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
