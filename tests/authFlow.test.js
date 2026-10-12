import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { UserStore } from '../src/storage/userStore.js';
import { OtpChallengeManager } from '../src/security/otp.js';
import { AuthResultTokenManager } from '../src/security/token.js';

describe('Authentication Flow, OTP Challenges & Token Verification', () => {
  const testDir = path.resolve('data/test_auth_flow');
  const testUsersFile = path.join(testDir, 'users.json');

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

  test('New User Registration Flow: creates record with strictly 3 fields', async () => {
    const userStore = new UserStore(testUsersFile);
    userStore.load();
    const challengeManager = new OtpChallengeManager();
    const tokenManager = new AuthResultTokenManager();

    const mobile = '+919876543210';
    assert.equal(userStore.hasUser(mobile), false);

    // 1. Create challenge for new user
    const { rawOtp } = challengeManager.createChallenge({
      mobile,
      isNewUser: true,
      name: 'Aditi Verma',
      email: 'aditi@example.com'
    });

    assert.ok(rawOtp);
    assert.equal(rawOtp.length, 6);

    // 2. Verify challenge
    const outcome = challengeManager.verifyChallenge(mobile, rawOtp);
    assert.equal(outcome.success, true);
    assert.equal(outcome.isNewUser, true);
    assert.deepEqual(outcome.signupData, { name: 'Aditi Verma', email: 'aditi@example.com' });

    // 3. User created in store ONLY upon verification
    const newUser = await userStore.createUser({
      name: outcome.signupData.name,
      mobile,
      email: outcome.signupData.email
    });

    assert.deepEqual(Object.keys(newUser).sort(), ['email', 'mobile', 'name'].sort());

    // 4. Issue auth token
    const authToken = tokenManager.issueToken({
      appKey: 'app_default_demo',
      user: newUser
    });
    assert.ok(authToken);

    // 5. Backend validates token
    const backendResult = tokenManager.verifyAndConsumeToken(authToken, 'app_default_demo');
    assert.equal(backendResult.valid, true);
    assert.equal(backendResult.user.name, 'Aditi Verma');
    assert.equal(backendResult.user.mobile, '+919876543210');
    assert.equal(backendResult.user.email, 'aditi@example.com');
  });

  test('Existing User Login Flow: stored profile is authoritative and untouched', async () => {
    const userStore = new UserStore(testUsersFile);
    userStore.load();
    const challengeManager = new OtpChallengeManager();

    const mobile = '+919876543210';
    // Pre-existing user
    await userStore.createUser({
      name: 'Original Authoritative Name',
      mobile,
      email: 'original@example.com'
    });

    assert.equal(userStore.hasUser(mobile), true);

    // Login creates challenge for existing user
    const { rawOtp } = challengeManager.createChallenge({
      mobile,
      isNewUser: false
    });

    const verifyResult = challengeManager.verifyChallenge(mobile, rawOtp);
    assert.equal(verifyResult.success, true);
    assert.equal(verifyResult.isNewUser, false);

    // Authoritative profile preserved
    const profile = userStore.getUser(mobile);
    assert.equal(profile.name, 'Original Authoritative Name');
    assert.equal(profile.email, 'original@example.com');
  });

  test('Rejects incorrect OTP with attempt countdown; locks out after max attempts', () => {
    const challengeManager = new OtpChallengeManager({ maxAttempts: 3 });
    const mobile = '+919876543210';
    const { rawOtp } = challengeManager.createChallenge({ mobile });

    // Attempt 1: wrong
    const r1 = challengeManager.verifyChallenge(mobile, '000000');
    assert.equal(r1.success, false);
    assert.equal(r1.reason, 'invalid_code');
    assert.equal(r1.remainingAttempts, 2);

    // Attempt 2: wrong
    const r2 = challengeManager.verifyChallenge(mobile, '111111');
    assert.equal(r2.success, false);
    assert.equal(r2.remainingAttempts, 1);

    // Attempt 3: wrong -> locks out
    const r3 = challengeManager.verifyChallenge(mobile, '222222');
    assert.equal(r3.success, false);
    assert.equal(r3.reason, 'max_attempts_exceeded');

    // Attempt 4: even with correct OTP, challenge has been invalidated!
    const r4 = challengeManager.verifyChallenge(mobile, rawOtp);
    assert.equal(r4.success, false);
    assert.equal(r4.reason, 'not_found');
  });

  test('Rejects expired OTP challenges', () => {
    const challengeManager = new OtpChallengeManager({ expirySeconds: -1 }); // already expired
    const mobile = '+919876543210';
    const { rawOtp } = challengeManager.createChallenge({ mobile });

    const result = challengeManager.verifyChallenge(mobile, rawOtp);
    assert.equal(result.success, false);
    assert.equal(result.reason, 'expired');
  });

  test('Enforces single-use OTP semantics (cannot reuse verified code)', () => {
    const challengeManager = new OtpChallengeManager();
    const mobile = '+919876543210';
    const { rawOtp } = challengeManager.createChallenge({ mobile });

    // 1st verification succeeds
    const r1 = challengeManager.verifyChallenge(mobile, rawOtp);
    assert.equal(r1.success, true);

    // 2nd verification with same code fails immediately
    const r2 = challengeManager.verifyChallenge(mobile, rawOtp);
    assert.equal(r2.success, false);
    assert.equal(r2.reason, 'not_found');
  });

  test('Enforces single-use authToken verification (replay protection)', () => {
    const tokenManager = new AuthResultTokenManager();
    const user = { name: 'Test User', mobile: '+919876543210', email: 'test@example.com' };

    const token = tokenManager.issueToken({
      appKey: 'app_default_demo',
      user
    });

    // 1st verification succeeds
    const v1 = tokenManager.verifyAndConsumeToken(token, 'app_default_demo');
    assert.equal(v1.valid, true);

    // 2nd verification with same token fails as already consumed
    const v2 = tokenManager.verifyAndConsumeToken(token, 'app_default_demo');
    assert.equal(v2.valid, false);
    assert.match(v2.error, /already been consumed/);
  });
});
