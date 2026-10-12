import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { defaultUserStore } from './storage/userStore.js';
import { defaultRateLimitStore } from './storage/rateLimitStore.js';
import { defaultTemplateStore } from './storage/templateStore.js';
import { defaultBerryAdapter } from './messaging/berryAdapter.js';
import { defaultCaptchaVerifier } from './security/captcha.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createAdminRouter } from './routes/adminRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function createApp(options = {}) {
  const app = express();
  const userStore = options.userStore || defaultUserStore;
  const rateLimitStore = options.rateLimitStore || defaultRateLimitStore;
  const templateStore = options.templateStore || defaultTemplateStore;
  const adapter = options.adapter || defaultBerryAdapter;
  const captchaVerifier = options.captchaVerifier || defaultCaptchaVerifier;

  // 1. CORS Configuration
  const allowedOrigins = config.corsAllowedOrigins;
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Password', 'X-App-Key']
  }));

  // 2. Body Parser
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 3. Static Assets: Public integration script, admin panel, demo portal
  const publicDir = path.join(rootDir, 'public');
  app.use(express.static(publicDir));

  // 4. GET /health
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'WA-USERAUTH',
      version: '1.0.0',
      whatsapp: adapter.getStatus(),
      usersCount: userStore.countUsers(),
      timestamp: new Date().toISOString()
    });
  });

  // 5. GET /api/v1/config/public (Delivers public siteKey to modal without exposing secrets)
  app.get('/api/v1/config/public', (req, res) => {
    res.status(200).json({
      success: true,
      captcha: captchaVerifier.getPublicConfig(),
      resendCooldown: config.otp.resendCooldownSeconds
    });
  });

  // 6. Mount Routers
  app.use('/api/v1/auth', createAuthRouter(options));
  app.use('/api/v1/admin', createAdminRouter(options));

  // 7. Route redirects for friendly URLs
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(publicDir, 'admin/index.html'));
  });

  app.get('/demo', (req, res) => {
    res.sendFile(path.join(publicDir, 'demo/index.html'));
  });

  // 8. 404 Handler
  app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
  });

  // 9. Error Handler
  app.use((err, req, res, next) => {
    console.error('[WA-USERAUTH Error]', err);
    res.status(500).json({
      success: false,
      error: config.nodeEnv === 'production' ? 'Internal server error' : err.message
    });
  });

  return app;
}

export async function startServer(options = {}) {
  // Ensure stores are initialized
  defaultUserStore.load();
  defaultRateLimitStore.load();
  defaultTemplateStore.load();

  // Initialize WhatsApp Berry Adapter in background
  if (config.whatsapp.adapter !== 'none') {
    defaultBerryAdapter.initialize().catch(err => {
      console.warn(`[BerryAdapter] Initial pairing loop warning: ${err.message}`);
    });
  }

  const app = createApp(options);
  const port = options.port || config.port;
  const host = options.host || config.host;

  return new Promise((resolve) => {
    const server = app.listen(port, host, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 WA-USERAUTH is running on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
      console.log(`📦 Integration Script: http://localhost:${port}/wa-userauth.js`);
      console.log(`🛡️  Admin Dashboard:    http://localhost:${port}/admin`);
      console.log(`✨ Live Demo Page:     http://localhost:${port}/demo`);
      console.log(`======================================================\n`);
      resolve({ app, server });
    });
  });
}
