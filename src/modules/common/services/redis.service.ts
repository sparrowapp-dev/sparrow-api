import { Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
@Injectable()
export class RedisService {
  constructor(private readonly redis: Redis) {}

  async set(key: string, value?: string, ttl?: number) {
    if (ttl) {
      return await this.redis.set(key, value ?? 1, "EX", ttl);
    }
    return await this.redis.set(key, value ?? 1);
  }
}
