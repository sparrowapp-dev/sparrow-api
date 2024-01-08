import { Injectable, CanActivate } from "@nestjs/common";
import { Redis } from "ioredis";
import { ContextService } from "../services/context.service";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class BlacklistGuard implements CanActivate {
  constructor(
    private readonly redis: Redis,
    private readonly contextService: ContextService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(): Promise<boolean> {
    const userKey =
      this.configService.get("app.userBlacklistPrefix") +
      this.contextService.get("user")._id;

    const exists = await this.redis.get(userKey);
    if (exists) {
      return false;
    }
    return true;
  }
}
