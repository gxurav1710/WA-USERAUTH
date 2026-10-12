import crypto from 'node:crypto';
import { config } from '../config.js';
import { normalizeMobile } from '../storage/userStore.js';

export function generateSecureOtp() {
  // Cryptographically secure 6-digit random integer between 100000 and 999999 inclusive
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(otp, salt) {
  return crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
}

export class OtpChallengeManager {
  constructor(options = {}) {
    this.expirySeconds = options.expirySeconds ?? config.otp.expirySeconds;
    this.maxAttempts = options.maxAttempts ?? config.otp.maxAttempts;
    // Map: normalizedMobile -> challengeRecord
    this.challenges = new Map();
  }

  pruneExpired() {
    const now = Date.now();
    for (const [mobile, c] of this.challenges.entries()) {
      if (now > c.expiresAt) {
        this.challenges.delete(mobile);
      }
    }
  }

  /**
   * Creates a new OTP challenge, invalidating any existing challenge for this mobile.
   * Only the SHA-256 hash of the OTP is retained in memory.
   *
   * @param {Object} params
   * @param {string} params.mobile
   * @param {boolean} [params.isNewUser=false]
   * @param {string} [params.name]
   * @param {string} [params.email]
   * @returns {{ rawOtp: string, expiresAt: number, remainingAttempts: number }}
   */
  createChallenge({ mobile, isNewUser = false, name = '', email = '' }) {
    this.pruneExpired();
    const normMobile = normalizeMobile(mobile);
    const rawOtp = generateSecureOtp();
    const salt = crypto.randomBytes(16).toString('hex');
    const otpHash = hashOtp(rawOtp, salt);

    const expiresAt = Date.now() + (this.expirySeconds * 1000);
    const challenge = {
      mobile: normMobile,
      otpHash,
      salt,
      expiresAt,
      remainingAttempts: this.maxAttempts,
      isNewUser: !!isNewUser,
      signupData: isNewUser ? { name: String(name || '').trim(), email: String(email || '').trim().toLowerCase() } : null,
      createdAt: Date.now()
    };

    // Any previous OTP is invalidated immediately upon creating replacement
    this.challenges.set(normMobile, challenge);

    return {
      rawOtp,
      expiresAt,
      remainingAttempts: challenge.remainingAttempts
    };
  }

  /**
   * Verifies an OTP code against active challenge.
   * Enforces expiry, single-use semantics, timing-safe hash comparison, and attempt counting.
   *
   * @param {string} mobile
   * @param {string} code
   * @returns {{ success: boolean, reason?: string, error?: string, remainingAttempts?: number, signupData?: any, isNewUser?: boolean }}
   */
  verifyChallenge(mobile, code) {
    const normMobile = normalizeMobile(mobile);
    const challenge = this.challenges.get(normMobile);

    if (!challenge) {
      return {
        success: false,
        reason: 'not_found',
        error: 'No active verification code found for this number. Please request a new code.'
      };
    }

    const now = Date.now();
    if (now > challenge.expiresAt) {
      this.challenges.delete(normMobile);
      return {
        success: false,
        reason: 'expired',
        error: 'Verification code has expired. Please request a new code.'
      };
    }

    this.pruneExpired();

    if (challenge.remainingAttempts <= 0) {
      this.challenges.delete(normMobile);
      return {
        success: false,
        reason: 'max_attempts_exceeded',
        error: 'Too many incorrect attempts. This code is now invalid. Please request a new code.'
      };
    }

    challenge.remainingAttempts -= 1;

    // Check OTP hash using timing-safe comparison
    const providedClean = String(code || '').trim();
    const candidateHash = hashOtp(providedClean, challenge.salt);

    const isMatch = candidateHash.length === challenge.otpHash.length &&
      crypto.timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(challenge.otpHash, 'hex'));

    if (!isMatch) {
      if (challenge.remainingAttempts <= 0) {
        this.challenges.delete(normMobile);
        return {
          success: false,
          reason: 'max_attempts_exceeded',
          error: 'Maximum verification attempts exceeded. Please request a new code.',
          remainingAttempts: 0
        };
      }
      return {
        success: false,
        reason: 'invalid_code',
        error: `Incorrect verification code. ${challenge.remainingAttempts} attempt(s) remaining.`,
        remainingAttempts: challenge.remainingAttempts
      };
    }

    // Success! Single-use: delete challenge immediately
    const signupData = challenge.signupData;
    const isNewUser = challenge.isNewUser;
    this.challenges.delete(normMobile);

    return {
      success: true,
      signupData,
      isNewUser
    };
  }

  clearChallenge(mobile) {
    const normMobile = normalizeMobile(mobile);
    this.challenges.delete(normMobile);
  }
}

export const defaultOtpChallengeManager = new OtpChallengeManager();
