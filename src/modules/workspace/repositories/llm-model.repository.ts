import { Inject , Injectable } from "@nestjs/common";
import { Db } from "mongodb";

// ---- Enum
import { Collections } from "@src/modules/common/enum/database.collection.enum";

// ---- Payload
import { LlmConfigPayload } from "../payloads/ai-assistant.payload";

// ---- Services
import { ContextService } from "@src/modules/common/services/context.service";

@Injectable()
  export class LlmModelRepository {
    constructor(
      @Inject("DATABASE_CONNECTION") private db: Db,
      private readonly contextService: ContextService,
    ) {}

  async getModelConfig(payload: LlmConfigPayload): Promise<any | null> {
    const { model, modelVersion } = payload;

    const result = await this.db.collection(Collections.LLMMODELS).findOne(
      { model, "modelVersions.name": modelVersion },
      { projection: { "modelVersions.$": 1 } }
    );

    if (!result || !result.modelVersions?.[0]) {
      return null;
    }

    const versionData = result.modelVersions[0];

    return {
      model,
      modelVersion: versionData.name,
      configuration: versionData.configuration,
    };
  }
}
