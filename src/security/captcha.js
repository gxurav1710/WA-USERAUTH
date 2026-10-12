import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Generates an ambiguous-free alphanumeric code (excluding 0, O, 1, I, l).
 */
export function generateAlphanumericCode(length = 5) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[crypto.randomInt(0, chars.length)];
  }
  return result;
}

/**
 * Generates a distorted, high-contrast SVG image for an alphanumeric code.
 * Includes noise lines, interference arcs, random rotations, and distinct colors.
 */
export function generateCaptchaSvg(code) {
  const width = 180;
  const height = 52;
  const colors = ['#34d399', '#38bdf8', '#f59e0b', '#ec4899', '#a78bfa', '#e2e8f0'];

  // Random noise lines
  let noiseLines = '';
  for (let i = 0; i < 4; i++) {
    const x1 = crypto.randomInt(0, 30);
    const y1 = crypto.randomInt(10, height - 10);
    const x2 = crypto.randomInt(width - 30, width);
    const y2 = crypto.randomInt(10, height - 10);
    const stroke = colors[crypto.randomInt(0, colors.length)];
    const strokeWidth = (Math.random() * 1.5 + 1).toFixed(1);
    const qx = crypto.randomInt(40, width - 40);
    const qy = crypto.randomInt(5, height - 5);
    noiseLines += `<path d="M ${x1} ${y1} Q ${qx} ${qy} ${x2} ${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" opacity="0.45"/>`;
  }

  // Random noise dots
  let noiseDots = '';
  for (let i = 0; i < 20; i++) {
    const cx = crypto.randomInt(5, width - 5);
    const cy = crypto.randomInt(5, height - 5);
    const r = (Math.random() * 1.5 + 0.8).toFixed(1);
    const fill = colors[crypto.randomInt(0, colors.length)];
    noiseDots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="0.3"/>`;
  }

  // Render each character with random rotation, translation, and colors
  let charElements = '';
  const charSpacing = (width - 30) / code.length;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const x = 20 + i * charSpacing;
    const y = crypto.randomInt(33, 38);
    const rot = crypto.randomInt(-18, 19);
    const color = colors[i % colors.length];

    charElements += `
      <g transform="rotate(${rot} ${x} ${y})">
        <text x="${x}" y="${y}" font-family="monospace, -apple-system, sans-serif" font-size="28" font-weight="800" fill="${color}" letter-spacing="2">
          ${char}
        </text>
      </g>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#090d16; border-radius:8px; border:1px solid #334155; user-select:none;">
    <rect width="${width}" height="${height}" fill="#090d16" rx="8"/>
    ${noiseLines}
    ${noiseDots}
    ${charElements}
  </svg>`;
}

export class CaptchaVerifier {
  /**
   * @param {Object} [options]
   * @param {string} [options.provider]
   * @param {string} [options.siteKey]
   * @param {string} [options.secretKey]
   * @param {string} [options.nodeEnv]
   */
  constructor(options = {}) {
    this.provider = (options.provider !== undefined ? options.provider : (config.captcha.provider || 'alphanumeric')).toLowerCase();
    this.siteKey = options.siteKey !== undefined ? options.siteKey : (config.captcha.siteKey || '');
    this.secretKey = options.secretKey !== undefined ? options.secretKey : (config.captcha.secretKey || '');
    this.nodeEnv = (options.nodeEnv !== undefined ? options.nodeEnv : (config.nodeEnv || 'development')).toLowerCase();

    // Map: captchaId -> { code: string, expiresAt: number, consumed: boolean }
    this.alphanumericChallenges = new Map();

    // Replay protection: consumed tokens map token -> timestamp
    this.consumedTokens = new Map();
  }

  pruneExpired() {
    const now = Date.now();
    for (const [id, c] of this.alphanumericChallenges.entries()) {
      if (now > c.expiresAt) {
        this.alphanumericChallenges.delete(id);
      }
    }
    const ttl = 10 * 60 * 1000;
    for (const [token, ts] of this.consumedTokens.entries()) {
      if (now - ts > ttl) {
        this.consumedTokens.delete(token);
      }
    }
  }

  /**
   * Creates a fresh text-numeric visual CAPTCHA challenge.
   * @returns {{ captchaId: string, svg: string }}
   */
  createChallenge() {
    this.pruneExpired();
    const captchaId = crypto.randomUUID();
    const code = generateAlphanumericCode(5);
    const svg = generateCaptchaSvg(code);

    // Stored in memory with 5-minute TTL
    this.alphanumericChallenges.set(captchaId, {
      code,
      expiresAt: Date.now() + (5 * 60 * 1000),
      consumed: false
    });

    return { captchaId, svg };
  }

  /**
   * Verifies an alphanumeric text-numeric CAPTCHA challenge.
   *
   * @param {string} captchaId
   * @param {string} userInput
   * @returns {{ success: boolean, error?: string }}
   */
  verifyAlphanumeric(captchaId, userInput) {
    this.pruneExpired();

    if (!captchaId || !userInput) {
      return {
        success: false,
        error: 'Please enter the characters shown in the CAPTCHA image.'
      };
    }

    const challenge = this.alphanumericChallenges.get(captchaId);
    if (!challenge) {
      return {
        success: false,
        error: 'CAPTCHA challenge expired or not found. Please click refresh to get a new image.'
      };
    }

    if (Date.now() > challenge.expiresAt) {
      this.alphanumericChallenges.delete(captchaId);
      return {
        success: false,
        error: 'CAPTCHA expired. Please click refresh to get a new image.'
      };
    }

    if (challenge.consumed) {
      this.alphanumericChallenges.delete(captchaId);
      return {
        success: false,
        error: 'This CAPTCHA has already been used. Please solve a fresh challenge.'
      };
    }

    const cleanInput = String(userInput || '').trim().toUpperCase();
    const expected = challenge.code.toUpperCase();

    if (cleanInput !== expected) {
      return {
        success: false,
        error: 'Incorrect CAPTCHA characters. Please check the image and try again.'
      };
    }

    // Success! Single-use: mark consumed and remove
    challenge.consumed = true;
    this.alphanumericChallenges.delete(captchaId);

    return { success: true };
  }

  /**
   * Verifies the CAPTCHA response token (Turnstile, Alphanumeric JSON, or Mock).
   *
   * @param {string|Object} token
   * @param {string} [clientIp]
   * @returns {Promise<{ success: boolean, error?: string, provider?: string }>}
   */
  async verifyToken(token, clientIp = '') {
    this.pruneExpired();

    if (!token) {
      return {
        success: false,
        error: 'CAPTCHA completion is required before OTP delivery.'
      };
    }

    // Check if token is an alphanumeric challenge payload (JSON or 'captchaId:input')
    let parsedAlphanumeric = null;
    if (typeof token === 'object') {
      parsedAlphanumeric = token;
    } else if (typeof token === 'string') {
      const trimmed = token.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          parsedAlphanumeric = JSON.parse(trimmed);
        } catch {}
      } else if (trimmed.includes(':') && !trimmed.startsWith('cf-') && !trimmed.startsWith('test-')) {
        const [cId, cCode] = trimmed.split(':');
        if (cId && cCode) {
          parsedAlphanumeric = { captchaId: cId, captchaCode: cCode };
        }
      }
    }

    // If alphanumeric challenge payload was provided:
    if (parsedAlphanumeric && parsedAlphanumeric.captchaId) {
      const alphaResult = this.verifyAlphanumeric(
        parsedAlphanumeric.captchaId,
        parsedAlphanumeric.captchaCode || parsedAlphanumeric.code || parsedAlphanumeric.input
      );
      return {
        success: alphaResult.success,
        error: alphaResult.error,
        provider: 'alphanumeric'
      };
    }

    const cleanToken = typeof token === 'string' ? token.trim() : '';

    // Replay prevention for token strings
    if (this.consumedTokens.has(cleanToken)) {
      return {
        success: false,
        error: 'This CAPTCHA token has already been used. Please complete a fresh challenge.'
      };
    }

    // Production safety guardrail: mock mode is strictly prohibited in production
    if (this.nodeEnv === 'production' && this.provider === 'mock') {
      return {
        success: false,
        error: 'Server security configuration error: Mock CAPTCHA provider cannot be used in production.'
      };
    }

    // Mock Provider for test suites & dev
    if (this.provider === 'mock' || this.nodeEnv === 'test') {
      if (
        cleanToken === 'cf-mock-token-dev' ||
        cleanToken === 'test-valid-captcha' ||
        cleanToken.startsWith('cf-mock-valid') ||
        cleanToken.endsWith('-valid') ||
        cleanToken === 'bypass-dev-captcha'
      ) {
        this.consumedTokens.set(cleanToken, Date.now());
        return { success: true, provider: 'mock' };
      }

      return {
        success: false,
        error: 'CAPTCHA challenge verification failed (invalid mock token).'
      };
    }

    // Live Cloudflare Turnstile
    if (this.provider === 'turnstile') {
      if (!this.secretKey) {
        return {
          success: false,
          error: 'CAPTCHA provider secret key is not configured on the server.'
        };
      }

      try {
        const formData = new URLSearchParams();
        formData.append('secret', this.secretKey);
        formData.append('response', cleanToken);
        if (clientIp) formData.append('remoteip', clientIp);

        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });

        if (!res.ok) {
          return {
            success: false,
            error: `CAPTCHA provider verification error (HTTP ${res.status}).`
          };
        }

        const outcome = await res.json();
        if (outcome && outcome.success === true) {
          this.consumedTokens.set(cleanToken, Date.now());
          return { success: true, provider: 'turnstile' };
        }

        const errCodes = Array.isArray(outcome['error-codes']) ? outcome['error-codes'].join(', ') : 'challenge-failed';
        return {
          success: false,
          error: `CAPTCHA challenge verification failed (${errCodes}). Please try again.`
        };
      } catch (networkErr) {
        return {
          success: false,
          error: `CAPTCHA verification unreachable: ${networkErr.message}`
        };
      }
    }

    return {
      success: false,
      error: 'Invalid CAPTCHA token format. Please solve the text CAPTCHA image.'
    };
  }

  getPublicConfig() {
    return {
      provider: this.provider,
      siteKey: this.siteKey,
      isMock: this.provider === 'mock' || this.nodeEnv === 'test'
    };
  }
}

export const defaultCaptchaVerifier = new CaptchaVerifier();
