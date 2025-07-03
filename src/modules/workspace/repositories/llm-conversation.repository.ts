import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { ConfigService } from "@nestjs/config";

// Enum
import { Collections } from "@src/modules/common/enum/database.collection.enum";
import { LlmConversation , ConversationModel , UserConversationModel } from "../payloads/llm-conversation.payload";
import { BlobStorageService } from "@src/modules/common/services/blobStorage.service";

@Injectable()
export class LlmConversationRepository {

  private conversationLimit: number;
  private readonly blobStorageService: BlobStorageService

  constructor(
    @Inject("DATABASE_CONNECTION") private db: Db,
    private readonly configService: ConfigService
  ) {
   this.conversationLimit = this.configService.get("ai.conversationLimit");
  }


  async getConversations(
    provider: string,
    apiKey: string,
  ): Promise<any[] | null> {
    const collection = this.db.collection(Collections.LLMCONVERSATION);
    const providerField = provider.toLowerCase();
 
    const document = await collection.findOne({
      [providerField]: {
        $elemMatch: {
          value: apiKey,
        },
      },
    });
 
    if (!document || !document[providerField]) {
      return null;
    }
 
    const providerEntry = document[providerField].find(
      (entry: { value: string }) => entry.value === apiKey,
    );
 
    const conversations = providerEntry?.conversations;
    await new Promise((resolve) => setTimeout(resolve, 10000));
 
    // Sort by date and time, latest first
    return (
      conversations?.sort(
        (
          a: { date: string; time: string },
          b: { date: string; time: string },
        ) =>
          new Date(`${b.date} ${b.time}`).getTime() -
          new Date(`${a.date} ${a.time}`).getTime(),
      ) ?? null
    );
  }


  async insertConversation(
    provider: string,
    apiKey: string,
    conversation: ConversationModel
  ): Promise<string> {
    const collection = this.db.collection(Collections.LLMCONVERSATION);
    const providerField = provider.toLowerCase();

    const conversationWithId = {
      ...conversation,
      id: `${providerField}-conv-${uuidv4()}`,
      conversation: conversation.conversation ?? [],
    };

    // Step 1: Try to find a doc that has this provider
    const providerDoc = await collection.findOne({
      [providerField]: { $exists: true },
    });

    if (providerDoc) {
      // Look for matching API key
      const apiKeyEntryIndex = providerDoc[providerField].findIndex(
        (entry: any) => entry.value === apiKey
      );

      if (apiKeyEntryIndex !== -1) {
        // Get existing conversations
        const existingConversations = providerDoc[providerField][apiKeyEntryIndex].conversations || [];

        let updatedConversations: ConversationModel[] = [];
        const conversationLimit = this.conversationLimit ?? 30;

        if (existingConversations.length >= conversationLimit) {
          const removedConversation = existingConversations[0];

          // Delete files in removedConversation.fileURL if present
          if (Array.isArray(removedConversation.fileURL)) {
            for (const fileUrl of removedConversation.fileURL) {
              try {
                await this.blobStorageService.deleteAiDocByUrl(fileUrl);
              } catch (err) {
                console.warn(`Failed to delete file ${fileUrl}:`, err.message);
              }
            }
          }

          // Slice to keep last 29 and make room for new one
          updatedConversations = [
            ...existingConversations.slice(-(conversationLimit - 1)),
            conversationWithId,
          ];
        } else {
          updatedConversations = [...existingConversations, conversationWithId];
        }


        const updateQuery = {
          $set: {
            [`${providerField}.${apiKeyEntryIndex}.conversations`]: updatedConversations,
          },
        };

        await collection.updateOne({ _id: providerDoc._id }, updateQuery);
      } else {
        // API key doesn't exist — add new entry
        const updateQuery = {
          $push: {
            [providerField]: {
              value: apiKey,
              conversations: [conversationWithId],
            },
          },
        };
        await collection.updateOne({ _id: providerDoc._id }, updateQuery);
      }

      return conversationWithId.id;
    }

    // Step 2: No document found for this provider — insert a new one
    const newProviderEntry = {
      [providerField]: [
        {
          value: apiKey,
          conversations: [conversationWithId],
        },
      ],
    };

    await collection.insertOne(newProviderEntry);
    return conversationWithId.id;
}

  /**
   * Adds a conversation to the given provider and API key group.
   *
   * @param provider e.g. "openAI"
   * @param apiKey e.g. "sk-openai-abc-123"
   * @param conversation conversation object to insert
   */
  async updateConversationData(
    provider: string,
    apiKey: string,
    conversationId: string,
    updateOps: Record<string, any>
  ): Promise<void> {
    try {
      const collection = this.db.collection(Collections.LLMCONVERSATION);
      const providerField = provider.toLowerCase();

      if (!updateOps || Object.keys(updateOps).length === 0) return;

      const result = await collection.updateOne(
        {
          [`${providerField}.value`]: apiKey,
          [`${providerField}.conversations.id`]: conversationId,
        },
        updateOps,
        {
          arrayFilters: [
            { "apiKeyElem.value": apiKey },
            { "convElem.id": conversationId },
          ],
        }
      );

      if (result.matchedCount === 0) {
        throw new Error("Conversation not found to update.");
      }
    } catch (error) {
      console.error("Error in updateConversationData:", error);
      throw new Error("Failed to update conversation in DB.");
    }
  }

  async deleteConversation(provider: string, apiKey: string, conversationId: string): Promise<void> {
    const collection = this.db.collection(Collections.LLMCONVERSATION);
    const providerField = provider.toLowerCase();

    // Step 1: Find the provider doc
    const providerDoc = await collection.findOne({
      [`${providerField}.value`]: apiKey,
    });

    // Step 2: Find the conversation to delete
    const apiKeyEntry = providerDoc[providerField].find((entry: any) => entry.value === apiKey);

    const conversationToDelete = apiKeyEntry.conversations.find(
      (conv: any) => conv.id === conversationId
    );

    if (conversationToDelete?.fileURL && Array.isArray(conversationToDelete.fileURL)) {
      for (const fileUrl of conversationToDelete.fileURL) {
        try {
          await this.blobStorageService.deleteAiDocByUrl(fileUrl);
        } catch (err) {
          console.warn(`Failed to delete blob file: ${fileUrl}`, err.message);
        }
      }
    }

    // Step 3: Actually delete the conversation
    await collection.updateOne(
      {
        [`${providerField}.value`]: apiKey,
      },
      {
        $pull: {
          [`${providerField}.$.conversations`]: { id: conversationId },
        },
      }
    );
  }
}