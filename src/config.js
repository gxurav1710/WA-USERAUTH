import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to parse allowed apps: "appKey1:secret1,appKey2:secret2"
function parseAllowedApps(raw) {
  const map = new Map();
  if (!raw) {
    map.set('app_default_demo', 'secret_default_demo_key_998877');
    return map;
  }
  const pairs = raw.split(',').map(p => p.trim()).filter(Boolean);
  for (const pair of pairs) {
    const [key, secret] = pair.split(':');
    if (key && secret) {
      map.set(key.trim(), secret.trim());
    }
  }
  if (map.size === 0) {
    map.set('app_default_demo', 'secret_default_demo_key_998877');
  }
  return map;
}

export const config = {
  rootDir,
  dataDir: path.resolve(rootDir, 'data'),
  usersFilePath: path.resolve(rootDir, 'data/users.json'),
  rateLimitsFilePath: path.resolve(rootDir, 'data/rate_limits.json'),
  templateFilePath: path.resolve(rootDir, 'data/template.json'),
  sessionMetaFilePath: path.resolve(rootDir, 'data/whatsapp_session.json'),

  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  adminPassword: process.env.ADMIN_PASSWORD || 'admin_password_123',
  adminSessionSecret: process.env.ADMIN_SESSION_SECRET || 'dev_admin_session_secret_change_in_prod',

  allowedApps: parseAllowedApps(process.env.ALLOWED_APPS),
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '*')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),

  captcha: {
    provider: (process.env.CAPTCHA_PROVIDER || 'mock').toLowerCase(),
    siteKey: process.env.TURNSTILE_SITE_KEY || '',
    secretKey: process.env.TURNSTILE_SECRET_KEY || ''
  },

  otp: {
    minIntervalSeconds: parseInt(process.env.OTP_MIN_INTERVAL_SECONDS || '60', 10),
    max15Min: parseInt(process.env.OTP_MAX_15MIN || '3', 10),
    max1Hr: parseInt(process.env.OTP_MAX_1HR || '5', 10),
    max24Hr: parseInt(process.env.OTP_MAX_24HR || '10', 10),
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
    expirySeconds: parseInt(process.env.OTP_EXPIRY_SECONDS || '300', 10),
    ipMax15Min: parseInt(process.env.RATE_LIMIT_IP_MAX_15MIN || '30', 10)
  },

  whatsapp: {
    adapter: (process.env.WHATSAPP_ADAPTER || 'berry').toLowerCase(),
    sessionId: process.env.WHATSAPP_SESSION_ID || 'wa_userauth_session',
    sessionPath: path.resolve(rootDir, process.env.WHATSAPP_SESSION_PATH || 'data/berry_auth'),
    databasePath: path.resolve(rootDir, process.env.BERRY_SQLITE_PATH || process.env.WHATSAPP_DATABASE_PATH || 'data/berry_store.db')
  }
};
