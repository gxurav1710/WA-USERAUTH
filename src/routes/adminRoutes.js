import express from 'express';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { defaultUserStore } from '../storage/userStore.js';
import { defaultTemplateStore } from '../storage/templateStore.js';
import { defaultBerryAdapter } from '../messaging/berryAdapter.js';

export function createAdminRouter(options = {}) {
  const router = express.Router();
  const userStore = options.userStore || defaultUserStore;
  const templateStore = options.templateStore || defaultTemplateStore;
  const adapter = options.adapter || defaultBerryAdapter;

  // Helper to create admin session token
  function createAdminToken() {
    const payload = { admin: true, exp: Date.now() + (24 * 60 * 60 * 1000) };
    const pStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', config.adminSessionSecret).update(pStr).digest('base64url');
    return `${pStr}.${sig}`;
  }

  // Middleware to verify admin token
  function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null) || req.query.token;
    const headerPassword = req.headers['x-admin-password'];

    // Direct password check fallback for headless scripts/API keys
    if (headerPassword && headerPassword === config.adminPassword) {
      return next();
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Administrative authorization token required.' });
    }

    const [pStr, sig] = token.split('.');
    if (!pStr || !sig) {
      return res.status(401).json({ success: false, error: 'Malformed administrative token.' });
    }

    const expectedSig = crypto.createHmac('sha256', config.adminSessionSecret).update(pStr).digest('base64url');
    if (sig !== expectedSig) {
      return res.status(401).json({ success: false, error: 'Invalid administrative token signature.' });
    }

    try {
      const payload = JSON.parse(Buffer.from(pStr, 'base64url').toString('utf8'));
      if (Date.now() > payload.exp) {
        return res.status(401).json({ success: false, error: 'Administrative token has expired.' });
      }
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid administrative token payload.' });
    }

    next();
  }

  // 1. POST /api/v1/admin/login
  router.post('/login', (req, res) => {
    const { password } = req.body || {};
    if (!password || password !== config.adminPassword) {
      return res.status(401).json({ success: false, error: 'Incorrect administrator password.' });
    }

    const token = createAdminToken();
    return res.status(200).json({
      success: true,
      message: 'Admin authenticated successfully.',
      token
    });
  });

  // Protect all following routes with requireAdmin
  router.use(requireAdmin);

  // 1b. GET /api/v1/admin/stream (Real-Time Server-Sent Events for instant pairing & status updates)
  router.get('/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const sendUpdate = (status = null, phoneNumber = null, qr = null) => {
      const clientInfo = adapter.getClientInfo();
      const currentQr = qr || adapter.getQrCode();
      const currentStatus = status || adapter.getStatus();
      const phone = phoneNumber || clientInfo.phoneNumber;

      const payload = {
        status: currentStatus,
        connected: currentStatus === 'CONNECTED',
        phoneNumber: phone,
        platform: clientInfo.platform,
        qrCode: currentQr?.dataUrl || currentQr?.raw || (typeof currentQr === 'string' ? currentQr : null),
        timestamp: new Date().toISOString()
      };

      try {
        res.write(`event: whatsapp_update\ndata: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {}
    };

    // Send immediate initial status
    sendUpdate();

    const onReady = (info) => sendUpdate('CONNECTED', info?.phoneNumber);
    const onStatus = (status) => sendUpdate(status);
    const onQr = (qr) => sendUpdate('QR_READY', null, qr);
    const onDisc = () => sendUpdate('DISCONNECTED');

    adapter.on('ready', onReady);
    adapter.on('status', onStatus);
    adapter.on('qr', onQr);
    adapter.on('disconnected', onDisc);

    const heartbeat = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      adapter.removeListener('ready', onReady);
      adapter.removeListener('status', onStatus);
      adapter.removeListener('qr', onQr);
      adapter.removeListener('disconnected', onDisc);
    });
  });

  // 2. GET /api/v1/admin/status
  router.get('/status', (req, res) => {
    const clientInfo = adapter.getClientInfo();
    const qr = adapter.getQrCode();

    res.status(200).json({
      success: true,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      whatsapp: {
        status: adapter.getStatus(),
        phoneNumber: clientInfo.phoneNumber,
        platform: clientInfo.platform,
        sessionId: clientInfo.sessionId,
        hasQrCode: !!qr
      },
      users: {
        totalRegistered: userStore.countUsers()
      },
      timestamp: new Date().toISOString()
    });
  });

  // 3. GET /api/v1/admin/qr
  router.get('/qr', (req, res) => {
    const qr = adapter.getQrCode();
    const status = adapter.getStatus();
    const clientInfo = adapter.getClientInfo();

    res.status(200).json({
      success: true,
      status,
      connected: status === 'CONNECTED',
      phoneNumber: clientInfo.phoneNumber,
      qrCode: qr?.dataUrl || qr?.raw || (typeof qr === 'string' ? qr : null),
      raw: qr?.raw || (typeof qr === 'string' ? qr : null),
      available: !!qr
    });
  });

  // 4. POST /api/v1/admin/pair/reconnect
  router.post('/pair/reconnect', async (req, res) => {
    try {
      await adapter.reconnect();
      let qr = null;
      if (typeof adapter.waitForQrCode === 'function') {
        qr = await adapter.waitForQrCode(4000);
      } else {
        qr = adapter.getQrCode();
      }

      res.status(200).json({
        success: true,
        message: 'Pairing re-initialized. Fresh QR code ready.',
        status: adapter.getStatus(),
        qrCode: qr?.dataUrl || qr?.raw || (typeof qr === 'string' ? qr : null)
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. POST /api/v1/admin/pair/disconnect
  router.post('/pair/disconnect', async (req, res) => {
    try {
      await adapter.disconnect({ cleanSession: true });
      res.status(200).json({
        success: true,
        message: 'WhatsApp session disconnected and credentials purged from disk.',
        status: adapter.getStatus()
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. GET /api/v1/admin/users
  // Strictly returns only name, mobile, email
  router.get('/users', (req, res) => {
    try {
      const users = userStore.getAllUsers();
      res.status(200).json({
        success: true,
        count: users.length,
        users
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 7. GET /api/v1/admin/template
  router.get('/template', (req, res) => {
    const current = templateStore.getTemplate();
    const preview = templateStore.getPreview('123456');

    res.status(200).json({
      success: true,
      template: current,
      preview,
      placeholder: '{{otp}}'
    });
  });

  // 8. POST /api/v1/admin/template
  router.post('/template', async (req, res) => {
    try {
      const { template } = req.body || {};
      if (!template || typeof template !== 'string') {
        return res.status(400).json({ success: false, error: 'Template text is required.' });
      }

      await templateStore.setTemplate(template);
      const preview = templateStore.getPreview('123456');

      res.status(200).json({
        success: true,
        message: 'Message template updated successfully.',
        template: templateStore.getTemplate(),
        preview
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 9. POST /api/v1/admin/template/reset
  router.post('/template/reset', async (req, res) => {
    try {
      await templateStore.resetToDefault();
      const preview = templateStore.getPreview('123456');

      res.status(200).json({
        success: true,
        message: 'Template restored to default configuration.',
        template: templateStore.getTemplate(),
        preview
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
