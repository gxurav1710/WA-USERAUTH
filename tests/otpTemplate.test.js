import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TemplateStore, DEFAULT_OTP_TEMPLATE } from '../src/storage/templateStore.js';

describe('Admin-Configurable OTP Delivery Message Template', () => {
  const testDir = path.resolve('data/test_templates');
  const testFile = path.join(testDir, 'template.json');

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

  test('Validates and accepts custom multi-line text with unicode, emoji, and exactly one {{otp}}', async () => {
    const store = new TemplateStore(testFile);
    const custom = `🌟 Welcome to MyStore!
Your verification code is: *{{otp}}* 🔒

This code will expire in 5 minutes.
Never share this code with anyone.`;

    await store.setTemplate(custom);
    assert.equal(store.getTemplate(), custom);

    // Verify rendered output replaces {{otp}} exactly
    const rendered = store.render('849201');
    assert.ok(rendered.includes('Your verification code is: *849201* 🔒'));
    assert.ok(!rendered.includes('{{otp}}'));
  });

  test('Rejects templates missing the {{otp}} placeholder', async () => {
    const store = new TemplateStore(testFile);
    await assert.rejects(
      async () => {
        await store.setTemplate('Your code is 123456. Enter it now.');
      },
      /must contain the reserved '\{\{otp\}\}' placeholder/
    );
  });

  test('Rejects templates containing duplicate {{otp}} placeholders', async () => {
    const store = new TemplateStore(testFile);
    await assert.rejects(
      async () => {
        await store.setTemplate('Code is {{otp}}. Again, enter {{otp}} to login.');
      },
      /must contain exactly one '\{\{otp\}\}' placeholder, but found 2/
    );
  });

  test('Rejects templates containing malformed placeholder variants', async () => {
    const store = new TemplateStore(testFile);
    await assert.rejects(
      async () => {
        await store.setTemplate('Your code is {otp}. Enter to continue.');
      },
      /must contain the reserved '\{\{otp\}\}' placeholder/
    );
  });

  test('Rejects templates exceeding maximum length', async () => {
    const store = new TemplateStore(testFile);
    const huge = 'A'.repeat(1005) + '{{otp}}';
    await assert.rejects(
      async () => {
        await store.setTemplate(huge);
      },
      /exceeds maximum length/
    );
  });

  test('Restores default template', async () => {
    const store = new TemplateStore(testFile);
    await store.setTemplate('Hello {{otp}}');
    assert.equal(store.getTemplate(), 'Hello {{otp}}');

    await store.resetToDefault();
    assert.equal(store.getTemplate(), DEFAULT_OTP_TEMPLATE);
  });

  test('Template persists across server restarts in separate template.json file', async () => {
    const store1 = new TemplateStore(testFile);
    const custom = 'Login OTP: {{otp}} - Valid for 5 min.';
    await store1.setTemplate(custom);

    // Re-initialize from disk
    const store2 = new TemplateStore(testFile);
    store2.load();
    assert.equal(store2.getTemplate(), custom);
    assert.equal(store2.render('445566'), 'Login OTP: 445566 - Valid for 5 min.');
  });
});
