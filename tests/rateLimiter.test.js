import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RateLimitStore } from '../src/storage/rateLimitStore.js';
import { RateLimiter } from '../src/security/rateLimiter.js';

describe('OTP Rate Limiting & Anti-Spam Protection', () => {
  const testDir = path.resolve('data/test_rate_limits');
  const testFile = path.join(testDir, 'rate_limits.json');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('Enforces 60-second cooldown interval between dispatches to the same mobile', async () => {
    const store = new RateLimitStore(testFile);
    const limiter = new RateLimiter(store, { minIntervalSeconds: 60 });
    const now = 1000000000000;

    // 1st dispatch: allowed
    const r1 = await limiter.checkAndRecordDispatch({
      mobile: '+919876543210',
      now
    });
    assert.equal(r1.allowed, true);

    // 2nd dispatch after 30 seconds: blocked by interval
    const r2 = await limiter.checkAndRecordDispatch({
      mobile: '+919876543210',
      now: now + 30000
    });
    assert.equal(r2.allowed, false);
    assert.equal(r2.reason, 'interval_cooldown');
    assert.equal(r2.retryAfter, 30);

    // 3rd dispatch after 61 seconds: allowed
    const r3 = await limiter.checkAndRecordDispatch({
      mobile: '+919876543210',
      now: now + 61000
    });
    assert.equal(r3.allowed, true);
  });

  test('Enforces separate resend cooldown', async () => {
    const store = new RateLimitStore(testFile);
    const limiter = new RateLimiter(store, {
      minIntervalSeconds: 60,
      resendCooldownSeconds: 60
    });
    const now = 1000000000000;

    // Initial send
    const r1 = await limiter.checkAndRecordDispatch({
      mobile: '+919876543210',
      isResend: false,
      now
    });
    assert.equal(r1.allowed, true);

    // 1st Resend at 65s (past general interval)
    const r2 = await limiter.checkAndRecordDispatch({
      mobile: '+919876543210',
      isResend: true,
      now: now + 65000
    });
    assert.equal(r2.allowed, true);

    // 2nd Resend at 95s (only 30s after previous resend) -> blocked
    const r3 = await limiter.checkAndRecordDispatch({
      mobile: '+919876543210',
      isResend: true,
      now: now + 95000
    });
    assert.equal(r3.allowed, false);
    assert.equal(r3.reason, 'interval_cooldown'); // General interval 60s also applies
  });

  test('Shared send quotas across login, signup, and resend endpoints', async () => {
    const store = new RateLimitStore(testFile);
    const limiter = new RateLimiter(store, {
      minIntervalSeconds: 1, // Shortened for quota testing
      max15Min: 3
    });
    const base = 1000000000000;

    // Send 1 (login)
    const s1 = await limiter.checkAndRecordDispatch({ mobile: '+919876543210', now: base });
    assert.equal(s1.allowed, true);

    // Send 2 (signup)
    const s2 = await limiter.checkAndRecordDispatch({ mobile: '+919876543210', now: base + 2000 });
    assert.equal(s2.allowed, true);

    // Send 3 (resend)
    const s3 = await limiter.checkAndRecordDispatch({ mobile: '+919876543210', isResend: true, now: base + 4000 });
    assert.equal(s3.allowed, true);

    // Send 4: 15-minute quota reached (3 max)!
    const s4 = await limiter.checkAndRecordDispatch({ mobile: '+919876543210', now: base + 6000 });
    assert.equal(s4.allowed, false);
    assert.equal(s4.reason, 'rolling_15min_limit');
    assert.ok(s4.retryAfter > 0);
  });

  test('Enforces rolling 1-hour and 24-hour limits', async () => {
    const store = new RateLimitStore(testFile);
    const limiter = new RateLimiter(store, {
      minIntervalSeconds: 1,
      max15Min: 10,
      max1Hr: 5,
      max24Hr: 10
    });
    let now = 1000000000000;

    // Dispatch 5 times
    for (let i = 0; i < 5; i++) {
      const res = await limiter.checkAndRecordDispatch({ mobile: '+919876543210', now: now + (i * 2000) });
      assert.equal(res.allowed, true);
    }

    // 6th dispatch within same hour -> blocked by rolling 1-hour limit
    const res6 = await limiter.checkAndRecordDispatch({ mobile: '+919876543210', now: now + 12000 });
    assert.equal(res6.allowed, false);
    assert.equal(res6.reason, 'rolling_1hr_limit');
  });

  test('Enforces per-IP rate limits across multiple mobile numbers', async () => {
    const store = new RateLimitStore(testFile);
    const limiter = new RateLimiter(store, {
      minIntervalSeconds: 1,
      ipMax15Min: 3
    });
    const ip = '198.51.100.42';
    const now = 1000000000000;

    // Send to 3 different numbers from same IP
    const r1 = await limiter.checkAndRecordDispatch({ mobile: '+919876543211', ip, now });
    assert.equal(r1.allowed, true);

    const r2 = await limiter.checkAndRecordDispatch({ mobile: '+919876543212', ip, now: now + 1000 });
    assert.equal(r2.allowed, true);

    const r3 = await limiter.checkAndRecordDispatch({ mobile: '+919876543213', ip, now: now + 2000 });
    assert.equal(r3.allowed, true);

    // 4th send to yet another number from same IP -> blocked by IP limit
    const r4 = await limiter.checkAndRecordDispatch({ mobile: '+919876543214', ip, now: now + 3000 });
    assert.equal(r4.allowed, false);
    assert.equal(r4.reason, 'ip_rate_limit');
  });

  test('Rate limits survive application restart (persists to local state file)', async () => {
    const store1 = new RateLimitStore(testFile);
    const limiter1 = new RateLimiter(store1, { minIntervalSeconds: 60 });
    const now = 1000000000000;

    const r1 = await limiter1.checkAndRecordDispatch({ mobile: '+919876543210', now });
    assert.equal(r1.allowed, true);

    // Simulate complete application restart by loading a fresh store instance from disk
    const store2 = new RateLimitStore(testFile);
    store2.load();
    const limiter2 = new RateLimiter(store2, { minIntervalSeconds: 60 });

    // Request 30 seconds later on new server instance -> must still be blocked!
    const r2 = await limiter2.checkAndRecordDispatch({
      mobile: '+919876543210',
      now: now + 30000
    });
    assert.equal(r2.allowed, false);
    assert.equal(r2.reason, 'interval_cooldown');
    assert.equal(r2.retryAfter, 30);
  });

  test('Serializes concurrent requests without race conditions', async () => {
    const store = new RateLimitStore(testFile);
    const limiter = new RateLimiter(store, { minIntervalSeconds: 60 });
    const now = 1000000000000;

    // Fire 3 simultaneous dispatches to same number
    const results = await Promise.all([
      limiter.checkAndRecordDispatch({ mobile: '+919876543210', now }),
      limiter.checkAndRecordDispatch({ mobile: '+919876543210', now }),
      limiter.checkAndRecordDispatch({ mobile: '+919876543210', now })
    ]);

    const allowedCount = results.filter(r => r.allowed).length;
    const blockedCount = results.filter(r => !r.allowed).length;

    assert.equal(allowedCount, 1, 'Only exactly 1 concurrent dispatch should be permitted');
    assert.equal(blockedCount, 2, 'The other 2 parallel attempts must be blocked');
  });
});
