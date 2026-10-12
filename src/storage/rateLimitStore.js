import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { normalizeMobile } from './userStore.js';

export class RateLimitStore {
  /**
   * @param {string} [filePath]
   */
  constructor(filePath = config.rateLimitsFilePath) {
    this.filePath = filePath;
    this.dirPath = path.dirname(this.filePath);
    this.phones = new Map(); // phone -> { lastSentAt, lastResentAt, timestamps: [] }
    this.ips = new Map();    // ip -> { timestamps: [] }
    this.locks = new Map();  // key -> Promise chain to prevent race conditions
    this.writeQueue = Promise.resolve();
    this.isLoaded = false;
  }

  ensureDir() {
    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath, { recursive: true });
    }
  }

  load() {
    this.ensureDir();
    this.phones.clear();
    this.ips.clear();

    if (!fs.existsSync(this.filePath)) {
      this._writeAtomicSync({ phones: {}, ips: {} });
      this.isLoaded = true;
      return;
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      if (!raw.trim()) {
        this.isLoaded = true;
        return;
      }
      const data = JSON.parse(raw);
      const now = Date.now();
      const retentionMs = 24 * 60 * 60 * 1000; // 24 hours

      if (data.phones && typeof data.phones === 'object') {
        for (const [phone, pData] of Object.entries(data.phones)) {
          const normPhone = normalizeMobile(phone);
          const validTimestamps = Array.isArray(pData.timestamps)
            ? pData.timestamps.filter(ts => typeof ts === 'number' && now - ts <= retentionMs)
            : [];
          this.phones.set(normPhone, {
            lastSentAt: pData.lastSentAt || 0,
            lastResentAt: pData.lastResentAt || 0,
            timestamps: validTimestamps
          });
        }
      }

      if (data.ips && typeof data.ips === 'object') {
        for (const [ip, iData] of Object.entries(data.ips)) {
          const validTimestamps = Array.isArray(iData.timestamps)
            ? iData.timestamps.filter(ts => typeof ts === 'number' && now - ts <= 15 * 60 * 1000)
            : [];
          this.ips.set(ip, { timestamps: validTimestamps });
        }
      }

      this.isLoaded = true;
    } catch (err) {
      // In case of read failure, preserve and start fresh
      this.isLoaded = true;
    }
  }

  _writeAtomicSync(dataObj) {
    this.ensureDir();
    const tmpPath = `${this.filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(dataObj, null, 2), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {}
    }
  }

  async _save() {
    return new Promise((resolve) => {
      this.writeQueue = this.writeQueue.then(() => {
        try {
          const out = { phones: {}, ips: {} };
          for (const [phone, data] of this.phones.entries()) {
            if (data.timestamps.length > 0 || data.lastSentAt > 0) {
              out.phones[phone] = {
                lastSentAt: data.lastSentAt,
                lastResentAt: data.lastResentAt,
                timestamps: data.timestamps
              };
            }
          }
          for (const [ip, data] of this.ips.entries()) {
            if (data.timestamps.length > 0) {
              out.ips[ip] = { timestamps: data.timestamps };
            }
          }
          this._writeAtomicSync(out);
        } catch {}
        resolve();
      }).catch(() => resolve());
    });
  }

  /**
   * Acquires a lock for a specific key (phone or IP) to prevent parallel race conditions
   */
  async acquireLock(key) {
    const currentLock = this.locks.get(key) || Promise.resolve();
    let release;
    const newLock = new Promise((resolve) => {
      release = resolve;
    });
    this.locks.set(key, currentLock.then(() => newLock));
    await currentLock;
    return () => {
      release();
      if (this.locks.get(key) === newLock) {
        this.locks.delete(key);
      }
    };
  }

  getPhoneRecord(mobile) {
    if (!this.isLoaded) this.load();
    const norm = normalizeMobile(mobile);
    let record = this.phones.get(norm);
    if (!record) {
      record = { lastSentAt: 0, lastResentAt: 0, timestamps: [] };
      this.phones.set(norm, record);
    }
    return record;
  }

  getIpRecord(ip) {
    if (!this.isLoaded) this.load();
    let record = this.ips.get(ip);
    if (!record) {
      record = { timestamps: [] };
      this.ips.set(ip, record);
    }
    return record;
  }

  async recordPhoneDispatch(mobile, isResend = false, now = Date.now()) {
    const norm = normalizeMobile(mobile);
    const record = this.getPhoneRecord(norm);
    record.lastSentAt = now;
    if (isResend) {
      record.lastResentAt = now;
    }
    record.timestamps.push(now);
    await this._save();
  }

  async recordIpHit(ip, now = Date.now()) {
    if (!ip) return;
    const record = this.getIpRecord(ip);
    record.timestamps.push(now);
    await this._save();
  }

  clear() {
    this.phones.clear();
    this.ips.clear();
    this._writeAtomicSync({ phones: {}, ips: {} });
  }
}

export const defaultRateLimitStore = new RateLimitStore();
