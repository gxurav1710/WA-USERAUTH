import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { UserStore, normalizeMobile } from '../src/storage/userStore.js';

describe('UserStore & Strict 3-Field Record Enforcements', () => {
  const testDir = path.resolve('data/test_user_store');
  const testFile = path.join(testDir, 'users.json');

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

  test('Normalize mobile numbers to E.164 format', () => {
    assert.equal(normalizeMobile('9876543210'), '+919876543210');
    assert.equal(normalizeMobile('+1 (555) 234-5678'), '+15552345678');
    assert.equal(normalizeMobile('+44 7911 123456'), '+447911123456');
    assert.equal(normalizeMobile('+971 50 123 4567'), '+971501234567');
  });

  test('Strictly creates and persists user with ONLY name, mobile, email', async () => {
    const store = new UserStore(testFile);
    store.load();

    const created = await store.createUser({
      name: 'Rohan Sharma',
      mobile: '+919876543210',
      email: 'rohan@example.com'
    });

    assert.equal(created.name, 'Rohan Sharma');
    assert.equal(created.mobile, '+919876543210');
    assert.equal(created.email, 'rohan@example.com');

    // Inspect the actual JSON file on disk
    const diskContent = JSON.parse(fs.readFileSync(testFile, 'utf8'));
    assert.ok(diskContent['+919876543210']);
    const diskRecord = diskContent['+919876543210'];

    const keys = Object.keys(diskRecord);
    assert.equal(keys.length, 3, 'Record on disk must have EXACTLY 3 fields');
    assert.deepEqual(keys.sort(), ['email', 'mobile', 'name'].sort());
    assert.equal(diskRecord.name, 'Rohan Sharma');
    assert.equal(diskRecord.mobile, '+919876543210');
    assert.equal(diskRecord.email, 'rohan@example.com');
  });

  test('Rejects user creation with prohibited extra fields (e.g. id, role, password, timestamps)', async () => {
    const store = new UserStore(testFile);
    store.load();

    await assert.rejects(
      async () => {
        await store.createUser({
          name: 'Hacker',
          mobile: '+919999999999',
          email: 'hacker@example.com',
          role: 'admin', // PROHIBITED
          createdAt: Date.now() // PROHIBITED
        });
      },
      /User record must contain exactly 3 fields/
    );
  });

  test('Rejects missing required fields', async () => {
    const store = new UserStore(testFile);
    store.load();

    await assert.rejects(
      async () => {
        await store.createUser({
          name: 'Incomplete',
          mobile: '+919876543210'
          // missing email
        });
      },
      /User record must contain exactly 3 fields/
    );
  });

  test('Prevents duplicate user creation', async () => {
    const store = new UserStore(testFile);
    store.load();

    await store.createUser({
      name: 'Original',
      mobile: '+919876543210',
      email: 'orig@example.com'
    });

    await assert.rejects(
      async () => {
        await store.createUser({
          name: 'Duplicate',
          mobile: '+919876543210',
          email: 'dup@example.com'
        });
      },
      /already exists/
    );
  });

  test('Preserves existing user profile and does not overwrite', async () => {
    const store = new UserStore(testFile);
    store.load();

    await store.createUser({
      name: 'Authoritative Name',
      mobile: '+919876543210',
      email: 'authoritative@example.com'
    });

    // Re-instantiate store from disk
    const store2 = new UserStore(testFile);
    store2.load();

    const user = store2.getUser('+919876543210');
    assert.equal(user.name, 'Authoritative Name');
    assert.equal(user.email, 'authoritative@example.com');
  });

  test('Handles corrupted JSON by creating backup without silently destroying data', () => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(testFile, 'CORRUPTED_JSON_DATA{{{', 'utf8');

    const store = new UserStore(testFile);
    assert.throws(() => {
      store.load();
    }, /Corrupted user database JSON/);

    // Verify backup was preserved on disk
    const files = fs.readdirSync(testDir);
    const backup = files.find(f => f.startsWith('users.json.corrupted.'));
    assert.ok(backup, 'Corrupted file backup must exist to preserve data');
  });
});
