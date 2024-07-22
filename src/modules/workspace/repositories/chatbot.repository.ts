import { Inject, Injectable } from "@nestjs/common";
import { ContextService } from "@src/modules/common/services/context.service";
import { Db } from "mongodb";

@Injectable()
export class ChatbotRepository {
  constructor(
    @Inject("DATABASE_CONNECTION") private db: Db,
    private readonly contextService: ContextService,
  ) {}
}
