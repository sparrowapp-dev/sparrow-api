import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { Db, ObjectId } from "mongodb";
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { ChatBotStats } from "@src/modules/common/models/chatbot-stats.model";

@Injectable()
export class ChatBotStatsAiModelMigration implements OnModuleInit {
  private hasRun = false;
  constructor(@Inject("DATABASE_CONNECTION") private db: Db) {}

  async onModuleInit(): Promise<void> {
    // Check if migration has already run
    if (this.hasRun) return;

    try {
      console.log(
        `\n\x1b[32m[Nest]\x1b[0m \x1b[32mExecuting ChatBotStats AI Model Migration...`,
      );

      const chatbotStatsCollection = this.db.collection<ChatBotStats>(
        Collections.CHATBOTSTATS,
      );

      const documents = await chatbotStatsCollection
        .find({
          tokenStats: { $exists: true },
          aiModel: { $exists: false },
        })
        .toArray();

      for (const doc of documents) {
        const tokenUsage = doc.tokenStats?.tokenUsage || 0;
        const yearMonth = doc.tokenStats?.yearMonth || null;

        const aiModel = {
          gpt: tokenUsage,
          deepseek: 0,
          yearMonth: yearMonth,
        };

        await chatbotStatsCollection.updateOne(
          { _id: new ObjectId(doc._id) },
          { $set: { aiModel } },
        );
      }

      console.log(`Updated ChatBotStats`);
      this.hasRun = true; // Set flag after successful execution
    } catch (error) {
      console.error("Error during ChatBotStats AI Model migration:", error);
    }
  }
}
