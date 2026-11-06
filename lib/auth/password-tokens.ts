import crypto from 'crypto';
import { getDb } from '@/lib/db';

/**
 * Single-use password setup/reset tokens.
 *
 * Only the SHA-256 hash of each token is stored; the raw token exists only in
 * the emailed link. Tokens expire after 60 minutes and are consumed atomically.
 */

const COLLECTION = 'password_tokens';
const TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes

interface PasswordTokenDoc {
  email: string;
  token_hash: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

let indexesEnsured = false;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function getCollection() {
  const db = await getDb();
  const collection = db.collection<PasswordTokenDoc>(COLLECTION);

  if (!indexesEnsured) {
    // Index creation is best-effort: a failure (e.g. writes blocked) must not
    // break token lookups. Expiry is also enforced in queries, so correctness
    // does not depend on the TTL index. Retried on the next call if it fails.
    try {
      // TTL index: MongoDB deletes documents once expires_at has passed
      await collection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
      await collection.createIndex({ token_hash: 1 }, { unique: true });
      await collection.createIndex({ email: 1, created_at: -1 });
      indexesEnsured = true;
    } catch (error) {
      console.error('[PasswordTokens] Failed to ensure indexes:', error);
    }
  }

  return collection;
}

/**
 * Create a token for the given email. Returns the raw token (for the link);
 * only its hash is persisted.
 */
export async function createPasswordToken(email: string): Promise<string> {
  const collection = await getCollection();
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();

  await collection.insertOne({
    email: email.toLowerCase(),
    token_hash: hashToken(token),
    expires_at: new Date(now.getTime() + TOKEN_TTL_MS),
    used: false,
    created_at: now,
  });

  return token;
}

/**
 * Atomically mark a valid, unused, unexpired token as used.
 * Returns the associated email, or null if the token is invalid.
 */
export async function consumePasswordToken(token: string): Promise<string | null> {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
    return null;
  }

  const collection = await getCollection();
  const doc = await collection.findOneAndUpdate(
    {
      token_hash: hashToken(token),
      used: false,
      expires_at: { $gt: new Date() },
    },
    { $set: { used: true } },
    { returnDocument: 'after' }
  );

  return doc?.email ?? null;
}

/**
 * True if a token was created for this email within the given window.
 * Used to rate-limit reset requests.
 */
export async function hasRecentPasswordToken(email: string, windowMs: number): Promise<boolean> {
  const collection = await getCollection();
  const recent = await collection.findOne({
    email: email.toLowerCase(),
    created_at: { $gt: new Date(Date.now() - windowMs) },
  });
  return recent !== null;
}

/** Build the one-click setup link for a raw token. */
export function buildSetPasswordUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL || 'https://www.tswi-ai.com';
  return `${base}/set-password?token=${token}`;
}
