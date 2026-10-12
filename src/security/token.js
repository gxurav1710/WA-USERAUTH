import crypto from 'node:crypto';
import { config } from '../config.js';

export class AuthResultTokenManager {
  constructor(options = {}) {
    this.sessionSecret = options.sessionSecret || config.adminSessionSecret;
    this.consumedResultIds = new Map(); // resultId -> timestamp
  }

  pruneConsumed() {
    const now = Date.now();
    const ttl = 10 * 60 * 1000; // 10 minutes
    for (const [id, ts] of this.consumedResultIds.entries()) {
      if (now - ts > ttl) {
        this.consumedResultIds.delete(id);
      }
    }
  }

  /**
   * Generates a short-lived, single-use signed authentication result token.
   *
   * @param {Object} params
   * @param {string} params.appKey
   * @param {{ name: string, mobile: string, email: string }} params.user
   * @param {number} [params.ttlSeconds=300]
   * @returns {string} Signed token
   */
  issueToken({ appKey = 'app_default_demo', user, ttlSeconds = 300 }) {
    this.pruneConsumed();

    const resultId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);

    const payload = {
      resultId,
      appKey: String(appKey || 'app_default_demo').trim(),
      user: {
        name: user.name,
        mobile: user.mobile,
        email: user.email
      },
      iat: now,
      exp: expiresAt
    };

    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const secret = config.allowedApps.get(payload.appKey) || this.sessionSecret;
    const hmac = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

    return `${payloadStr}.${hmac}`;
  }

  /**
   * Verifies and immediately consumes a single-use authentication result token.
   *
   * @param {string} token
   * @param {string} [expectedAppKey]
   * @param {string} [providedSecret]
   * @returns {{ valid: boolean, error?: string, user?: { name: string, mobile: string, email: string }, appKey?: string }}
   */
  verifyAndConsumeToken(token, expectedAppKey = null, providedSecret = null) {
    this.pruneConsumed();

    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Auth token is missing or invalid' };
    }

    const parts = token.trim().split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Malformed authentication token format' };
    }

    const [payloadStr, signature] = parts;

    let payload;
    try {
      payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    } catch {
      return { valid: false, error: 'Invalid token payload encoding' };
    }

    if (!payload.resultId || !payload.exp || !payload.user) {
      return { valid: false, error: 'Incomplete token payload' };
    }

    // Check expiry
    const now = Date.now();
    if (now > payload.exp) {
      return { valid: false, error: 'Authentication token has expired' };
    }

    // Check single-use
    if (this.consumedResultIds.has(payload.resultId)) {
      return { valid: false, error: 'Authentication token has already been consumed (single-use)' };
    }

    // Verify app key if expected
    if (expectedAppKey && payload.appKey !== expectedAppKey) {
      return { valid: false, error: `Token application key mismatch (expected ${expectedAppKey}, got ${payload.appKey})` };
    }

    // Verify HMAC signature
    const secret = providedSecret || config.allowedApps.get(payload.appKey) || this.sessionSecret;
    const expectedHmac = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

    const isValidSig = signature.length === expectedHmac.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac));

    if (!isValidSig) {
      return { valid: false, error: 'Invalid token signature or untrusted application secret' };
    }

    // Consume token!
    this.consumedResultIds.set(payload.resultId, now);

    return {
      valid: true,
      appKey: payload.appKey,
      user: {
        name: payload.user.name,
        mobile: payload.user.mobile,
        email: payload.user.email
      }
    };
  }
}

export const defaultAuthResultTokenManager = new AuthResultTokenManager();
