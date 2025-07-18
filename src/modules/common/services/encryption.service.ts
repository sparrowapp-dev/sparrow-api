import { Injectable } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EncryptionService {
  private readonly secret: string;
  private readonly iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');

  constructor(private readonly configService: ConfigService) {
    // Now `configService` is initialized and can be safely used
    this.secret = this.configService.get('ai.encryptionSecret');
  }

  encrypt(text: string): string {
    const key = CryptoJS.enc.Utf8.parse(this.secret.padEnd(32, ' ')); // Ensure 256-bit key

    const encrypted = CryptoJS.AES.encrypt(text, key, {
      iv: this.iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return encrypted.ciphertext.toString(CryptoJS.enc.Base64); // Only the ciphertext
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