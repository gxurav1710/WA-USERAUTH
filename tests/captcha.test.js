import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CaptchaVerifier } from '../src/security/captcha.js';

describe('CAPTCHA Verification & Security Guardrails', () => {
  test('Rejects missing or empty CAPTCHA token', async () => {
    const verifier = new CaptchaVerifier({ provider: 'mock', nodeEnv: 'development' });
    const res1 = await verifier.verifyToken('');
    assert.equal(res1.success, false);
    assert.match(res1.error, /CAPTCHA completion is required/);

    const res2 = await verifier.verifyToken(null);
    assert.equal(res2.success, false);
  });

  test('Accepts valid mock tokens in development / test environment', async () => {
    const verifier = new CaptchaVerifier({ provider: 'mock', nodeEnv: 'development' });
    const res = await verifier.verifyToken('cf-mock-token-dev');
    assert.equal(res.success, true);
    assert.equal(res.provider, 'mock');
  });

  test('Rejects invalid mock tokens', async () => {
    const verifier = new CaptchaVerifier({ provider: 'mock', nodeEnv: 'development' });
    const res = await verifier.verifyToken('invalid-random-token-12345');
    assert.equal(res.success, false);
    assert.match(res.error, /verification failed/);
  });

  test('Prevents CAPTCHA token replay (single-use token)', async () => {
    const verifier = new CaptchaVerifier({ provider: 'mock', nodeEnv: 'development' });
    const token = 'cf-mock-valid-unique-token-999';

    // 1st verification: succeeds
    const res1 = await verifier.verifyToken(token);
    assert.equal(res1.success, true);

    // 2nd verification with same token: rejected as replayed
    const res2 = await verifier.verifyToken(token);
    assert.equal(res2.success, false);
    assert.match(res2.error, /already been used/);
  });

  test('Fails closed if mock provider is attempted in production environment', async () => {
    const verifier = new CaptchaVerifier({ provider: 'mock', nodeEnv: 'production' });
    const res = await verifier.verifyToken('cf-mock-token-dev');
    assert.equal(res.success, false);
    assert.match(res.error, /Mock CAPTCHA provider cannot be used in production/);
  });

  test('Fails closed in production if Turnstile secret key is unconfigured', async () => {
    const verifier = new CaptchaVerifier({
      provider: 'turnstile',
      secretKey: '',
      nodeEnv: 'production'
    });
    const res = await verifier.verifyToken('some-token');
    assert.equal(res.success, false);
    assert.match(res.error, /secret key is not configured/);
  });

  test('Fails closed in production when CAPTCHA provider network request fails', async () => {
    const verifier = new CaptchaVerifier({
      provider: 'turnstile',
      secretKey: 'dummy_secret_key',
      nodeEnv: 'production'
    });

    // Mock global fetch to simulate network error
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('Connection reset by peer');
    };

    try {
      const res = await verifier.verifyToken('any-token');
      assert.equal(res.success, false);
      assert.match(res.error, /CAPTCHA verification unreachable/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('Alphanumeric visual CAPTCHA: generates SVG challenge and validates user input', async () => {
    const verifier = new CaptchaVerifier({ provider: 'alphanumeric' });
    const challenge = verifier.createChallenge();

    assert.ok(challenge.captchaId);
    assert.ok(challenge.svg.includes('<svg'));
    assert.ok(challenge.svg.includes('</svg>'));

    // Retrieve internal code for test verification
    const stored = verifier.alphanumericChallenges.get(challenge.captchaId);
    assert.ok(stored);
    assert.equal(typeof stored.code, 'string');
    assert.equal(stored.code.length, 5);

    // Rejects wrong code
    const badRes = verifier.verifyAlphanumeric(challenge.captchaId, 'WRONG');
    assert.equal(badRes.success, false);
    assert.match(badRes.error, /Incorrect CAPTCHA/);

    // Accepts correct code case-insensitively
    const goodRes = verifier.verifyAlphanumeric(challenge.captchaId, stored.code.toLowerCase());
    assert.equal(goodRes.success, true);

    // Rejects replay
    const replayRes = verifier.verifyAlphanumeric(challenge.captchaId, stored.code);
    assert.equal(replayRes.success, false);
  });

  test('verifyToken handles JSON stringified alphanumeric payload', async () => {
    const verifier = new CaptchaVerifier({ provider: 'alphanumeric' });
    const challenge = verifier.createChallenge();
    const stored = verifier.alphanumericChallenges.get(challenge.captchaId);

    const payload = JSON.stringify({
      captchaId: challenge.captchaId,
      captchaCode: stored.code
    });

    const res = await verifier.verifyToken(payload);
    assert.equal(res.success, true);
    assert.equal(res.provider, 'alphanumeric');
  });
});
