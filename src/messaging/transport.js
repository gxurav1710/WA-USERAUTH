import { defaultBerryAdapter } from './berryAdapter.js';
import { defaultTemplateStore } from '../storage/templateStore.js';

export class MessageTransport {
  constructor(adapter = defaultBerryAdapter, templateStore = defaultTemplateStore) {
    this.adapter = adapter;
    this.templateStore = templateStore;
  }

  /**
   * Dispatches the customized OTP message to a recipient mobile number
   *
   * @param {string} mobile Recipient E.164 phone number
   * @param {string} rawOtp Cryptographically generated 6-digit OTP
   * @returns {Promise<{ success: boolean, delivered: boolean, error?: string, id?: string, simulated?: boolean }>}
   */
  async sendOtpMessage(mobile, rawOtp) {
    if (!rawOtp || typeof rawOtp !== 'string') {
      throw new Error('Valid OTP is required for dispatch.');
    }

    // 1. Render message from validated template
    const messageText = this.templateStore.render(rawOtp);

    // 2. Dispatch via Berry transport adapter
    const result = await this.adapter.sendMessage(mobile, messageText);
    return result;
  }

  getStatus() {
    return this.adapter.getStatus();
  }

  getClientInfo() {
    return this.adapter.getClientInfo();
  }
}

export const defaultMessageTransport = new MessageTransport();
