import { Injectable } from "@nestjs/common";

// Payload
import { ConversationModel, LlmConversation } from "../payloads/llm-conversation.payload";

// Repository
import { LlmConversationRepository } from "../repositories/llm-conversation.repository";

@Injectable()
export class LlmConversationService {
  constructor(
    private readonly llmConversationRepository: LlmConversationRepository,
  ) {}

  // Function to Fetch Conversation from DB
  async getConversation(
    provider: string,
    apiKey: string,
    id?: string
  ): Promise<ConversationModel[] | ConversationModel | null> {
    try {
      const conversations = await this.llmConversationRepository.getConversations(provider, apiKey);

      if (!conversations) {
        return id ? null : [];
      }

      if (id) {
        const conversation = conversations.find((conv: any) => conv.id === id);
        return conversation || null;
      }

      return conversations;
    } catch (error) {
      throw new Error('Unable to retrieve conversations at this time.');
    }
  }

  // Function to Create a root structure of Conversation in DB
  async insertConversation(payload: LlmConversation): Promise<string> {
    try {
      const id = await this.llmConversationRepository.insertConversation(
        payload.provider,
        payload.apiKey,
        payload.data,
      );
      return id;
    } catch (error) {
        throw new Error('Unable to insert Conversation');
      }
  }

  async updateConversation(payload: LlmConversation): Promise<void> {
    try {
      const { provider, apiKey, id: conversationId } = payload;
      
      const data = payload.data as Record<string, any>;
      const providerField = provider.toLowerCase();
      const messagesToAppend = data.conversation ?? [];
      const { conversation, id, ...metaUpdates } = data;

      const updateOps: any = {};

      // Set metadata fields (e.g., title, tokens, etc.)
      for (const key in metaUpdates) {
        const value = metaUpdates[key];
        if (value !== undefined) {
          updateOps.$set = updateOps.$set || {};
          updateOps.$set[`${providerField}.$[apiKeyElem].conversations.$[convElem].${key}`] = value;
        }
      }

      // Push messages to conversation
      if (messagesToAppend.length > 0) {
        updateOps.$push = {
          [`${providerField}.$[apiKeyElem].conversations.$[convElem].conversation`]: {
            $each: messagesToAppend,
          },
        };
      }

      // No operations to perform
      if (!updateOps.$set && !updateOps.$push) return;

      await this.llmConversationRepository.updateConversationData(
        provider,
        apiKey,
        conversationId,
        updateOps
      );
    } catch (error) {
      throw new Error("Failed to update the conversation.");
    }
  }

  async deleteConversation(provider: string, apiKey: string, id: string): Promise<void> {
    try {
      await this.llmConversationRepository.deleteConversation(provider, apiKey, id);
    } catch (error) {
      throw new Error('Unable to delete conversation.');
    }
  }
}