import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../src/server.js';
import { UserStore } from '../src/storage/userStore.js';
import { RateLimitStore } from '../src/storage/rateLimitStore.js';
import { RateLimiter } from '../src/security/rateLimiter.js';
import { TemplateStore } from '../src/storage/templateStore.js';
import { CaptchaVerifier } from '../src/security/captcha.js';
import { OtpChallengeManager } from '../src/security/otp.js';
import { MessageTransport } from '../src/messaging/transport.js';
import { BerryAdapter } from '../src/messaging/berryAdapter.js';
import { AuthResultTokenManager } from '../src/security/token.js';
import { config } from '../src/config.js';

describe('End-to-End API Integration Suite', () => {
  const testDir = path.resolve('data/test_integration');
  let serverInstance;
  let serverPort;
  let baseUrl;

  let testUserStore;
  let testRateLimitStore;
  let testRateLimiter;
  let testTemplateStore;
  let testCaptchaVerifier;
  let testChallengeManager;
  let testAdapter;
  let testTransport;
  let testTokenManager;

  let capturedOtp = null;

  before(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    testUserStore = new UserStore(path.join(testDir, 'users.json'));
    testUserStore.load();

    testRateLimitStore = new RateLimitStore(path.join(testDir, 'rate_limits.json'));
    testRateLimitStore.load();
    testRateLimiter = new RateLimiter(testRateLimitStore, { minIntervalSeconds: 1 });

    testTemplateStore = new TemplateStore(path.join(testDir, 'template.json'));
    testTemplateStore.load();

    testCaptchaVerifier = new CaptchaVerifier({ provider: 'mock', nodeEnv: 'test' });
    testChallengeManager = new OtpChallengeManager();

    // Mock BerryAdapter capturing dispatched OTP
    testAdapter = new BerryAdapter({ mode: 'mock' });
    testAdapter.sendMessage = async (to, message) => {
      // Extract OTP from message
      const match = message.match(/\b\d{6}\b/);
      if (match) capturedOtp = match[0];
      return { success: true, delivered: true, simulated: true };
    };

    testTransport = new MessageTransport(testAdapter, testTemplateStore);
    testTokenManager = new AuthResultTokenManager();

    const app = createApp({
      userStore: testUserStore,
      rateLimitStore: testRateLimitStore,
      rateLimiter: testRateLimiter,
      templateStore: testTemplateStore,
      captchaVerifier: testCaptchaVerifier,
      challengeManager: testChallengeManager,
      messageTransport: testTransport,
      tokenManager: testTokenManager,
      adapter: testAdapter
    });

    serverInstance = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => {
        serverPort = s.address().port;
        baseUrl = `http://127.0.0.1:${serverPort}`;
        resolve(s);
      });
    });
  });

  after(() => {
    if (serverInstance) serverInstance.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('GET /health returns healthy status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'healthy');
    assert.equal(body.service, 'WA-USERAUTH');
  });

  test('GET /api/v1/config/public returns public CAPTCHA config without secrets', async () => {
    const res = await fetch(`${baseUrl}/api/v1/config/public`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.captcha);
    assert.equal(body.captcha.secretKey, undefined, 'Must NEVER expose CAPTCHA secret');
  });

  test('Registration & Login API Flow', async () => {
    const mobile = '+919876543210';

    // 1. check-user
    const check1 = await fetch(`${baseUrl}/api/v1/auth/check-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile })
    });
    assert.equal(check1.status, 200);
    const cData1 = await check1.json();
    assert.equal(cData1.exists, false);

    // 2. send OTP for new user
    capturedOtp = null;
    const send1 = await fetch(`${baseUrl}/api/v1/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile,
        captchaToken: 'cf-mock-token-dev',
        name: 'Gaurav Kumar',
        email: 'gaurav@example.com'
      })
    });
    assert.equal(send1.status, 200);
    const sData1 = await send1.json();
    assert.equal(sData1.success, true);
    assert.ok(capturedOtp, 'Message transport must receive generated OTP');

    // 3. verify OTP
    const verify1 = await fetch(`${baseUrl}/api/v1/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile,
        otp: capturedOtp
      })
    });
    assert.equal(verify1.status, 200);
    const vData1 = await verify1.json();
    assert.equal(vData1.success, true);
    assert.ok(vData1.authToken);
    assert.deepEqual(vData1.user, {
      name: 'Gaurav Kumar',
      mobile: '+919876543210',
      email: 'gaurav@example.com'
    });

    // Verify user in store
    assert.equal(testUserStore.hasUser(mobile), true);

    // 4. Server-to-server validation via result/verify
    const s2s = await fetch(`${baseUrl}/api/v1/auth/result/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authToken: vData1.authToken,
        appKey: 'app_default_demo'
      })
    });
    assert.equal(s2s.status, 200);
    const s2sData = await s2s.json();
    assert.equal(s2sData.valid, true);
    assert.deepEqual(s2sData.user, {
      name: 'Gaurav Kumar',
      mobile: '+919876543210',
      email: 'gaurav@example.com'
    });

    // 5. Replay attempt of same authToken must fail
    const replay = await fetch(`${baseUrl}/api/v1/auth/result/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authToken: vData1.authToken,
        appKey: 'app_default_demo'
      })
    });
    assert.equal(replay.status, 401);
  });

  test('Admin endpoints: Authentication, User Table, and Template Editor', async () => {
    // 1. Login with incorrect password -> 401
    const badLogin = await fetch(`${baseUrl}/api/v1/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong_password' })
    });
    assert.equal(badLogin.status, 401);

    // 2. Login with correct password
    const goodLogin = await fetch(`${baseUrl}/api/v1/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: config.adminPassword })
    });
    assert.equal(goodLogin.status, 200);
    const loginData = await goodLogin.json();
    assert.ok(loginData.token);
    const adminToken = loginData.token;

    // 3. User table check: confirms user list has ONLY name, mobile, email
    const usersRes = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(usersRes.status, 200);
    const usersData = await usersRes.json();
    assert.ok(Array.isArray(usersData.users));
    assert.ok(usersData.users.length >= 1);
    const firstUser = usersData.users[0];
    assert.deepEqual(Object.keys(firstUser).sort(), ['email', 'mobile', 'name'].sort());

    // 4. Template CRUD
    const tmplGet = await fetch(`${baseUrl}/api/v1/admin/template`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(tmplGet.status, 200);

    const tmplUpdate = await fetch(`${baseUrl}/api/v1/admin/template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        template: 'Special OTP is: {{otp}}. Thank you!'
      })
    });
    assert.equal(tmplUpdate.status, 200);
    const updatedData = await tmplUpdate.json();
    assert.equal(updatedData.preview, 'Special OTP is: 123456. Thank you!');
  });
});
