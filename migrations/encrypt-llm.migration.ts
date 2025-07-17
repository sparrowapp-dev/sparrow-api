import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class EncryptLlmApiKeysMigration  implements OnModuleInit {
  private hasRun = false;
  private readonly secret: string;
  private readonly iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');

  constructor(
    @Inject('DATABASE_CONNECTION') private readonly db: Db,
    private readonly configService: ConfigService,
  ) {
    this.secret = this.configService.get('ai.encryptionSecret');
  }

  async onModuleInit(): Promise<void> {
    if (this.hasRun) return;

    try {
      console.log('\x1b[34m[Migration]\x1b[0m Encrypting API keys in llmconversation...');

      const llmConversationCollection = this.db.collection('llmconversation');
      const fields = ['openai', 'anthropic', 'deepseek', 'google'];

      const documents = await llmConversationCollection.find({}).toArray();

      for (const doc of documents) {
        const updates: Record<string, any> = {};
        let needsUpdate = false;

        for (const field of fields) {
          if (Array.isArray(doc[field])) {
            const updatedArray = doc[field].map((entry: any) => {
              if (entry?.value && !this.isEncrypted(entry.value)) {
                const encrypted = this.encrypt(entry.value);
                needsUpdate = true;
                return { ...entry, value: encrypted };
              }
              return entry;
            });
            updates[field] = updatedArray;
          }
        }

        if (needsUpdate) {
          await llmConversationCollection.updateOne(
            { _id: new ObjectId(doc._id) },
            { $set: updates },
          );
          console.log(`Updated document _id: ${doc._id}`);
        }
      }

      this.hasRun = true;
      console.log('\x1b[32m[Migration]\x1b[0m Encryption completed successfully.');
    } catch (err) {
      console.error('[Migration Error]', err);
    }
  }

  private encrypt(text: string): string {
    const key = CryptoJS.enc.Utf8.parse(this.secret.padEnd(32, ' '));
    const encrypted = CryptoJS.AES.encrypt(text, key, {
      iv: this.iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
  }

  private isEncrypted(value: string): boolean {
    // Basic check: OpenAI key pattern usually starts with 'sk-'
    return /^[A-Za-z0-9+/=]{32,}$/.test(value) && !value.startsWith('sk-');
  }
}