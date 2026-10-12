import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Normalizes phone numbers to standard E.164 international format (+[country][national]).
 * Strips whitespace, dashes, parentheses. Prepends '+' if missing.
 * Handles standard defaults (e.g. 10 digits assumed to be India if 91 prefix missing, or direct clean).
 */
export function normalizeMobile(raw) {
  if (!raw) return '';
  let str = String(raw).trim().replace(/[\s\-\(\)]/g, '');
  if (str.startsWith('+')) {
    str = '+' + str.slice(1).replace(/[^0-9]/g, '');
  } else {
    str = str.replace(/[^0-9]/g, '');
    if (str.length === 10) {
      str = '+91' + str;
    } else if (str.length === 11 && str.startsWith('0')) {
      str = '+91' + str.slice(1);
    } else {
      str = '+' + str;
    }
  }
  return str;
}

export class UserStore {
  /**
   * @param {string} [filePath]
   */
  constructor(filePath = config.usersFilePath) {
    this.filePath = filePath;
    this.dirPath = path.dirname(this.filePath);
    this.writeQueue = Promise.resolve();
    this.cache = new Map();
    this.isLoaded = false;
  }

  ensureDir() {
    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath, { recursive: true });
    }
  }

  /**
   * Strictly validates that a user record contains ONLY and EXACTLY:
   * name, mobile, email.
   * Throws an error if any field is missing or any extraneous field exists.
   */
  static validateUserRecord(record, expectedKey = null) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error('User record must be a plain object');
    }

    const allowedKeys = ['name', 'mobile', 'email'];
    const keys = Object.keys(record);

    // Strict validation: must have exactly 3 fields
    if (keys.length !== 3) {
      throw new Error(`User record must contain exactly 3 fields (name, mobile, email). Found ${keys.length} fields: ${keys.join(', ')}`);
    }

    for (const key of allowedKeys) {
      if (!keys.includes(key)) {
        throw new Error(`Missing required field '${key}' in user record`);
      }
    }

    for (const key of keys) {
      if (!allowedKeys.includes(key)) {
        throw new Error(`Prohibited field '${key}' in user record. Only name, mobile, email are permitted.`);
      }
    }

    if (typeof record.name !== 'string' || !record.name.trim()) {
      throw new Error('User name must be a non-empty string');
    }

    if (typeof record.mobile !== 'string' || !record.mobile.trim() || !record.mobile.startsWith('+')) {
      throw new Error('User mobile must be a valid E.164 phone number starting with +');
    }

    if (expectedKey && record.mobile !== expectedKey) {
      throw new Error(`User mobile '${record.mobile}' does not match dictionary key '${expectedKey}'`);
    }

    if (typeof record.email !== 'string' || !record.email.includes('@') || !record.email.includes('.')) {
      throw new Error('User email must be a valid email address');
    }

    return {
      name: record.name.trim(),
      mobile: record.mobile.trim(),
      email: record.email.trim().toLowerCase()
    };
  }

  /**
   * Safely loads users from users.json.
   * Handles missing files and corrupted JSON safely.
   */
  load() {
    this.ensureDir();
    this.cache.clear();

    if (!fs.existsSync(this.filePath)) {
      // Initialize fresh file with empty object
      this._writeAtomicSync({});
      this.isLoaded = true;
      return;
    }

    let rawData;
    try {
      rawData = fs.readFileSync(this.filePath, 'utf8');
    } catch (err) {
      throw new Error(`Failed to read user database file ${this.filePath}: ${err.message}`);
    }

    if (!rawData.trim()) {
      this._writeAtomicSync({});
      this.isLoaded = true;
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawData);
    } catch (err) {
      // Protect existing user data from silent deletion: backup corrupted file
      const backupPath = `${this.filePath}.corrupted.${Date.now()}`;
      try {
        fs.copyFileSync(this.filePath, backupPath);
      } catch {}
      throw new Error(`Corrupted user database JSON in ${this.filePath}. Preserved backup at ${backupPath}: ${err.message}`);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const backupPath = `${this.filePath}.invalid.${Date.now()}`;
      try {
        fs.copyFileSync(this.filePath, backupPath);
      } catch {}
      throw new Error(`Invalid root structure in ${this.filePath}. Expected an object dictionary.`);
    }

    // Populate and validate cache
    for (const [key, userObj] of Object.entries(parsed)) {
      const normalizedKey = normalizeMobile(key);
      const validated = UserStore.validateUserRecord(userObj, normalizedKey);
      this.cache.set(normalizedKey, validated);
    }

    this.isLoaded = true;
  }

  _writeAtomicSync(dataObj) {
    this.ensureDir();
    const tmpPath = `${this.filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    const serialized = JSON.stringify(dataObj, null, 2);

    try {
      fs.writeFileSync(tmpPath, serialized, { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {}
      throw new Error(`Atomic write to user database failed: ${err.message}`);
    }
  }

  async _save() {
    return new Promise((resolve, reject) => {
      this.writeQueue = this.writeQueue.then(() => {
        try {
          const dataObj = {};
          for (const [key, user] of this.cache.entries()) {
            dataObj[key] = {
              name: user.name,
              mobile: user.mobile,
              email: user.email
            };
          }
          this._writeAtomicSync(dataObj);
          resolve();
        } catch (err) {
          reject(err);
        }
      }).catch(err => {
        reject(err);
      });
    });
  }

  /**
   * Returns user by normalized mobile number
   */
  getUser(mobile) {
    if (!this.isLoaded) this.load();
    const normalized = normalizeMobile(mobile);
    const user = this.cache.get(normalized);
    if (!user) return null;
    return { name: user.name, mobile: user.mobile, email: user.email };
  }

  /**
   * Checks whether a user exists
   */
  hasUser(mobile) {
    if (!this.isLoaded) this.load();
    const normalized = normalizeMobile(mobile);
    return this.cache.has(normalized);
  }

  /**
   * Creates a new user record.
   * STRICT REQUIREMENT: Only name, mobile, email.
   * Throws if user already exists or validation fails.
   */
  async createUser(userRecord) {
    if (!this.isLoaded) this.load();
    if (!userRecord || typeof userRecord !== 'object') {
      throw new Error('User record must be an object');
    }

    const normalized = normalizeMobile(userRecord.mobile);

    if (this.cache.has(normalized)) {
      throw new Error(`User with mobile ${normalized} already exists`);
    }

    // Clone record and ensure mobile is normalized for validation
    const candidate = { ...userRecord, mobile: normalized };
    const validated = UserStore.validateUserRecord(candidate, normalized);

    this.cache.set(normalized, validated);
    await this._save();
    return { name: validated.name, mobile: validated.mobile, email: validated.email };
  }

  /**
   * Returns all users as array of { name, mobile, email }
   */
  getAllUsers() {
    if (!this.isLoaded) this.load();
    const list = [];
    for (const user of this.cache.values()) {
      list.push({
        name: user.name,
        mobile: user.mobile,
        email: user.email
      });
    }
    return list;
  }

  countUsers() {
    if (!this.isLoaded) this.load();
    return this.cache.size;
  }
}

export const defaultUserStore = new UserStore();
