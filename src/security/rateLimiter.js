import { config } from '../config.js';
import { normalizeMobile } from '../storage/userStore.js';
import { defaultRateLimitStore } from '../storage/rateLimitStore.js';

export class RateLimiter {
  constructor(store = defaultRateLimitStore, opts = {}) {
    this.store = store;
    this.opts = {
      minIntervalSeconds: opts.minIntervalSeconds ?? config.otp.minIntervalSeconds,
      max15Min: opts.max15Min ?? config.otp.max15Min,
      max1Hr: opts.max1Hr ?? config.otp.max1Hr,
      max24Hr: opts.max24Hr ?? config.otp.max24Hr,
      resendCooldownSeconds: opts.resendCooldownSeconds ?? config.otp.resendCooldownSeconds,
      ipMax15Min: opts.ipMax15Min ?? config.otp.ipMax15Min
    };
  }

  /**
   * Evaluates if an OTP dispatch to the given mobile & IP is permitted.
   * If permitted, records the dispatch and returns { allowed: true }.
   * If blocked, returns { allowed: false, retryAfter: number, reason: string, message: string }.
   * Prevents concurrency race conditions using mutex locking.
   */
  async checkAndRecordDispatch({ mobile, ip, isResend = false, now = Date.now() }) {
    const normMobile = normalizeMobile(mobile);
    if (!normMobile) {
      return {
        allowed: false,
        retryAfter: 0,
        reason: 'invalid_mobile',
        message: 'Invalid mobile number'
      };
    }

    // Acquire lock on mobile to serialize parallel requests
    const releaseLock = await this.store.acquireLock(normMobile);

    try {
      const pRecord = this.store.getPhoneRecord(normMobile);

      // 1. Min interval between deliveries to same number (default 60s)
      const elapsedSinceLast = now - pRecord.lastSentAt;
      const minIntervalMs = this.opts.minIntervalSeconds * 1000;
      if (pRecord.lastSentAt > 0 && elapsedSinceLast < minIntervalMs) {
        const retryAfter = Math.ceil((minIntervalMs - elapsedSinceLast) / 1000);
        return {
          allowed: false,
          retryAfter,
          reason: 'interval_cooldown',
          message: `Please wait ${retryAfter}s before requesting another verification code.`
        };
      }

      // 2. Resend cooldown check
      if (isResend && pRecord.lastResentAt > 0) {
        const elapsedSinceResend = now - pRecord.lastResentAt;
        const resendCooldownMs = this.opts.resendCooldownSeconds * 1000;
        if (elapsedSinceResend < resendCooldownMs) {
          const retryAfter = Math.ceil((resendCooldownMs - elapsedSinceResend) / 1000);
          return {
            allowed: false,
            retryAfter,
            reason: 'resend_cooldown',
            message: `Please wait ${retryAfter}s before resending code.`
          };
        }
      }

      // 3. Shared rolling window counters: filter timestamps
      const window15m = 15 * 60 * 1000;
      const window1h = 60 * 60 * 1000;
      const window24h = 24 * 60 * 60 * 1000;

      const timestamps15m = pRecord.timestamps.filter(ts => now - ts < window15m);
      const timestamps1h = pRecord.timestamps.filter(ts => now - ts < window1h);
      const timestamps24h = pRecord.timestamps.filter(ts => now - ts < window24h);

      // Max in rolling 15 minutes (default 3)
      if (timestamps15m.length >= this.opts.max15Min) {
        const oldest = timestamps15m[0];
        const retryAfter = Math.max(1, Math.ceil((oldest + window15m - now) / 1000));
        return {
          allowed: false,
          retryAfter,
          reason: 'rolling_15min_limit',
          message: `Too many OTP requests for this number. Please try again in ${retryAfter}s.`
        };
      }

      // Max in rolling 1 hour (default 5)
      if (timestamps1h.length >= this.opts.max1Hr) {
        const oldest = timestamps1h[0];
        const retryAfter = Math.max(1, Math.ceil((oldest + window1h - now) / 1000));
        return {
          allowed: false,
          retryAfter,
          reason: 'rolling_1hr_limit',
          message: `Hourly OTP quota exceeded for this number. Retry in ${retryAfter}s.`
        };
      }

      // Max in rolling 24 hours (default 10)
      if (timestamps24h.length >= this.opts.max24Hr) {
        const oldest = timestamps24h[0];
        const retryAfter = Math.max(1, Math.ceil((oldest + window24h - now) / 1000));
        return {
          allowed: false,
          retryAfter,
          reason: 'rolling_24hr_limit',
          message: `Daily OTP quota exceeded for this number. Retry in ${retryAfter}s.`
        };
      }

      // 4. IP check (rolling 15m)
      if (ip) {
        const iRecord = this.store.getIpRecord(ip);
        const ipTimestamps = iRecord.timestamps.filter(ts => now - ts < window15m);
        if (ipTimestamps.length >= this.opts.ipMax15Min) {
          const oldest = ipTimestamps[0];
          const retryAfter = Math.max(1, Math.ceil((oldest + window15m - now) / 1000));
          return {
            allowed: false,
            retryAfter,
            reason: 'ip_rate_limit',
            message: `Too many requests from your IP address. Please retry in ${retryAfter}s.`
          };
        }
      }

      // All checks passed! Record dispatch atomically.
      await this.store.recordPhoneDispatch(normMobile, isResend, now);
      if (ip) {
        await this.store.recordIpHit(ip, now);
      }

      return {
        allowed: true,
        resendCooldown: this.opts.resendCooldownSeconds
      };
    } finally {
      releaseLock();
    }
  }
}

export const defaultRateLimiter = new RateLimiter();
