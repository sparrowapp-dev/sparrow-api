import { Injectable } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class EncryptionService {
  private readonly secret = process.env.ENCRYPTION_SECRET || 'my-static-secret-key';
  private readonly iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');

  encrypt(text: string): string {
    const key = CryptoJS.enc.Utf8.parse(this.secret.padEnd(32, ' '));

    const encrypted = CryptoJS.AES.encrypt(text, key, {
      iv: this.iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return encrypted.ciphertext.toString(CryptoJS.enc.Base64); // Only ciphertext
  }

  decrypt(base64CipherText: string): string {
    const key = CryptoJS.enc.Utf8.parse(this.secret.padEnd(32, ' '));

    const encryptedHex = CryptoJS.enc.Base64.parse(base64CipherText);
    const encrypted = CryptoJS.lib.CipherParams.create({
      ciphertext: encryptedHex,
    });

    const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
      iv: this.iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
  }
}
