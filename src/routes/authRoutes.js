import express from 'express';
import { normalizeMobile, defaultUserStore } from '../storage/userStore.js';
import { defaultRateLimiter } from '../security/rateLimiter.js';
import { defaultCaptchaVerifier } from '../security/captcha.js';
import { defaultOtpChallengeManager } from '../security/otp.js';
import { defaultMessageTransport } from '../messaging/transport.js';
import { defaultAuthResultTokenManager } from '../security/token.js';

export function createAuthRouter(options = {}) {
  const router = express.Router();
  const userStore = options.userStore || defaultUserStore;
  const rateLimiter = options.rateLimiter || defaultRateLimiter;
  const captchaVerifier = options.captchaVerifier || defaultCaptchaVerifier;
  const challengeManager = options.challengeManager || defaultOtpChallengeManager;
  const messageTransport = options.messageTransport || defaultMessageTransport;
  const tokenManager = options.tokenManager || defaultAuthResultTokenManager;

  // 0. GET /api/v1/auth/captcha/new (Visual text-numeric CAPTCHA challenge)
  router.get('/captcha/new', (req, res) => {
    try {
      const challenge = captchaVerifier.createChallenge();
      return res.status(200).json({
        success: true,
        captchaId: challenge.captchaId,
        svg: challenge.svg,
        provider: captchaVerifier.provider
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 1. POST /api/v1/auth/check-user
  router.post('/check-user', async (req, res) => {
    try {
      const { mobile } = req.body || {};
      if (!mobile) {
        return res.status(400).json({ success: false, error: 'Mobile number is required' });
      }

      const norm = normalizeMobile(mobile);
      if (!norm || norm.length < 8) {
        return res.status(400).json({ success: false, error: 'Invalid international mobile number format' });
      }

      const exists = userStore.hasUser(norm);
      return res.status(200).json({
        success: true,
        exists,
        mobile: norm
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. POST /api/v1/auth/otp/send
  router.post('/otp/send', async (req, res) => {
    try {
      const { mobile, captchaToken, captchaId, captchaCode, isResend, name, email, appKey } = req.body || {};

      if (!mobile) {
        return res.status(400).json({ success: false, error: 'Mobile number is required' });
      }

      const norm = normalizeMobile(mobile);
      if (!norm || norm.length < 8) {
        return res.status(400).json({ success: false, error: 'Invalid mobile number format' });
      }

      // Check if user already exists
      const isExisting = userStore.hasUser(norm);

      // If new user, validate name and email
      if (!isExisting) {
        if (!name || typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ success: false, error: 'Full name is required for new registration.' });
        }
        if (!email || typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
          return res.status(400).json({ success: false, error: 'A valid email address is required for new registration.' });
        }
      }

      // 1. CAPTCHA verification (supports alphanumeric {captchaId, captchaCode} or token)
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      const tokenToVerify = (captchaId && captchaCode)
        ? { captchaId, captchaCode }
        : captchaToken;

      const captchaResult = await captchaVerifier.verifyToken(tokenToVerify, clientIp);
      if (!captchaResult.success) {
        return res.status(403).json({
          success: false,
          error: captchaResult.error || 'CAPTCHA verification failed.',
          code: 'CAPTCHA_REQUIRED'
        });
      }

      // 2. Rate limiting check (normalized mobile and IP)
      const rateResult = await rateLimiter.checkAndRecordDispatch({
        mobile: norm,
        ip: clientIp,
        isResend: !!isResend,
        now: Date.now()
      });

      if (!rateResult.allowed) {
        res.setHeader('Retry-After', String(rateResult.retryAfter));
        return res.status(429).json({
          success: false,
          error: rateResult.message,
          retryAfter: rateResult.retryAfter,
          reason: rateResult.reason
        });
      }

      // 3. Create fresh OTP challenge (stores hash only)
      const { rawOtp, expiresAt } = challengeManager.createChallenge({
        mobile: norm,
        isNewUser: !isExisting,
        name: isExisting ? '' : name,
        email: isExisting ? '' : email
      });

      // 4. Dispatch OTP message via Berry transport
      const dispatchResult = await messageTransport.sendOtpMessage(norm, rawOtp);

      if (!dispatchResult.success && !dispatchResult.simulated) {
        // Rollback challenge if message dispatch failed outright
        challengeManager.clearChallenge(norm);
        return res.status(503).json({
          success: false,
          error: dispatchResult.error || 'WhatsApp delivery failed. Please verify that WhatsApp is paired.',
          whatsappStatus: dispatchResult.status
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Verification code sent to WhatsApp.',
        mobile: norm,
        expiresIn: Math.ceil((expiresAt - Date.now()) / 1000),
        resendCooldown: rateResult.resendCooldown || 60,
        isNewUser: !isExisting
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. POST /api/v1/auth/otp/verify
  router.post('/otp/verify', async (req, res) => {
    try {
      const { mobile, otp, appKey } = req.body || {};

      if (!mobile || !otp) {
        return res.status(400).json({ success: false, error: 'Mobile number and verification code are required.' });
      }

      const norm = normalizeMobile(mobile);
      const verifyResult = challengeManager.verifyChallenge(norm, otp);

      if (!verifyResult.success) {
        return res.status(400).json({
          success: false,
          error: verifyResult.error,
          reason: verifyResult.reason,
          remainingAttempts: verifyResult.remainingAttempts
        });
      }

      // User account resolution
      let user = userStore.getUser(norm);

      if (!user) {
        // New user! Create record with ONLY 3 fields: name, mobile, email
        const signupData = verifyResult.signupData || {};
        if (!signupData.name || !signupData.email) {
          return res.status(400).json({
            success: false,
            error: 'Incomplete registration details for new user.'
          });
        }

        user = await userStore.createUser({
          name: signupData.name,
          mobile: norm,
          email: signupData.email
        });
      }
      // For existing users: existing profile is authoritative. Never overwrite name or email!

      // Generate short-lived, single-use signed authentication result token
      const authToken = tokenManager.issueToken({
        appKey: appKey || 'app_default_demo',
        user: {
          name: user.name,
          mobile: user.mobile,
          email: user.email
        },
        ttlSeconds: 300
      });

      return res.status(200).json({
        success: true,
        message: 'Authentication successful.',
        authToken,
        user: {
          name: user.name,
          mobile: user.mobile,
          email: user.email
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. POST /api/v1/auth/result/verify (Server-to-Server validation for integrating developers)
  router.post('/result/verify', async (req, res) => {
    try {
      const { authToken, appKey, appSecret } = req.body || {};

      if (!authToken) {
        return res.status(400).json({ valid: false, error: 'authToken is required.' });
      }

      const validation = tokenManager.verifyAndConsumeToken(authToken, appKey, appSecret);

      if (!validation.valid) {
        return res.status(401).json({
          valid: false,
          error: validation.error
        });
      }

      return res.status(200).json({
        valid: true,
        appKey: validation.appKey,
        user: validation.user
      });
    } catch (err) {
      return res.status(500).json({ valid: false, error: err.message });
    }
  });

  return router;
}
