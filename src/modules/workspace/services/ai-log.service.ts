import { Injectable } from "@nestjs/common";

// ---- Models and Payloads
import { LogDTO } from "../payloads/ai-log.payload";

// ---- Repository
import { AiLogRepository } from "../repositories/ai-log.repository";

@Injectable()
export class AiLogService {
  constructor(private readonly ailogrepository: AiLogRepository) {}

  async addLog(payload: LogDTO): Promise<void> {
    await this.ailogrepository.addLogs(
      {
        userId: payload.userId,
        emailId: payload.emailId,
        activity: payload.activity,
        model: payload.model,
        tokenConsumed: payload.tokenConsumed,
        thread_id: payload.thread_id,
      },
      payload.userId,
    );
  }

  async getTokenUsageReport(start: Date, end: Date) {
    return this.ailogrepository.getTokenUsageReport(start, end);
  }
}
