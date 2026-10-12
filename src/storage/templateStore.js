import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

export const DEFAULT_OTP_TEMPLATE = `Your WA-USERAUTH verification code is {{otp}}.

Enter this code in the login window to continue.
This code expires in 5 minutes. Do not share it with anyone.`;

export class TemplateStore {
  /**
   * @param {string} [filePath]
   */
  constructor(filePath = config.templateFilePath) {
    this.filePath = filePath;
    this.dirPath = path.dirname(this.filePath);
    this.currentTemplate = DEFAULT_OTP_TEMPLATE;
    this.maxLength = 1000;
    this.isLoaded = false;
  }

  ensureDir() {
    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath, { recursive: true });
    }
  }

  load() {
    this.ensureDir();
    if (!fs.existsSync(this.filePath)) {
      this._writeAtomicSync({ template: DEFAULT_OTP_TEMPLATE, updatedAt: new Date().toISOString() });
      this.currentTemplate = DEFAULT_OTP_TEMPLATE;
      this.isLoaded = true;
      return;
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      if (data && typeof data.template === 'string') {
        this.validateTemplate(data.template);
        this.currentTemplate = data.template;
      } else {
        this.currentTemplate = DEFAULT_OTP_TEMPLATE;
      }
    } catch {
      this.currentTemplate = DEFAULT_OTP_TEMPLATE;
    }
    this.isLoaded = true;
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
      throw new Error(`Failed to save template: ${err.message}`);
    }
  }

  /**
   * Validates that template contains EXACTLY ONE {{otp}} placeholder and respects length limits.
   */
  validateTemplate(template) {
    if (typeof template !== 'string' || !template.trim()) {
      throw new Error('Template must be a non-empty text string.');
    }

    if (template.length > this.maxLength) {
      throw new Error(`Template exceeds maximum length of ${this.maxLength} characters (current length: ${template.length}).`);
    }

    const matches = template.match(/\{\{otp\}\}/g);
    if (!matches || matches.length === 0) {
      throw new Error("Template must contain the reserved '{{otp}}' placeholder.");
    }

    if (matches.length > 1) {
      throw new Error(`Template must contain exactly one '{{otp}}' placeholder, but found ${matches.length}.`);
    }

    // Check for malformed variants
    const malformedSingle = template.replace(/\{\{otp\}\}/g, '');
    if (/\{\{.*otp.*\}\}/i.test(malformedSingle) || /\{otp\}|\{\{otp\}|\{otp\}\}/i.test(malformedSingle)) {
      throw new Error("Template contains malformed OTP placeholder. Only exact '{{otp}}' is permitted.");
    }

    return true;
  }

  getTemplate() {
    if (!this.isLoaded) this.load();
    return this.currentTemplate;
  }

  async setTemplate(template) {
    if (!this.isLoaded) this.load();
    this.validateTemplate(template);
    this.currentTemplate = template;
    this._writeAtomicSync({
      template: this.currentTemplate,
      updatedAt: new Date().toISOString()
    });
    return this.currentTemplate;
  }

  async resetToDefault() {
    this.currentTemplate = DEFAULT_OTP_TEMPLATE;
    this._writeAtomicSync({
      template: DEFAULT_OTP_TEMPLATE,
      updatedAt: new Date().toISOString(),
      resetAt: new Date().toISOString()
    });
    return this.currentTemplate;
  }

  /**
   * Renders the template for outbound messaging
   */
  render(otp) {
    if (!this.isLoaded) this.load();
    const cleanOtp = String(otp || '').trim();
    if (!cleanOtp) {
      throw new Error('Cannot render template without an active OTP value');
    }
    return this.currentTemplate.replace(/\{\{otp\}\}/g, cleanOtp);
  }

  /**
   * Live preview for admin UI
   */
  getPreview(sampleOtp = '123456') {
    if (!this.isLoaded) this.load();
    return this.currentTemplate.replace(/\{\{otp\}\}/g, sampleOtp);
  }
}

export const defaultTemplateStore = new TemplateStore();
