import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AzureOpenAI } from "openai";
import {
  Assistant,
  AssistantCreateParams,
} from "openai/resources/beta/assistants";
import { Message, MessagesPage } from "openai/resources/beta/threads/messages";
import { Run } from "openai/resources/beta/threads/runs/runs";
import { Thread } from "openai/resources/beta/threads/threads";

@Injectable()
export class AiSupportService {
  private endpoint;
  private apiKey;
  private deployment;
  private apiVersion;
  private maxTokens: number;
  private apiModel: string;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.get("ai.endpoint");
    this.apiKey = this.configService.get("ai.apiKey");
    this.deployment = this.configService.get("ai.deployment");
    this.apiVersion = this.configService.get("ai.apiVersion");

    this.apiModel = this.configService.get("ai.apiModel");
    this.maxTokens = this.configService.get("ai.maxTokens");
  }

  private getClient = (): AzureOpenAI => {
    const assistantsClient = new AzureOpenAI({
      endpoint: this.endpoint,
      apiVersion: this.apiVersion,
      apiKey: this.apiKey,
    });
    return assistantsClient;
  };

  public async generateText(
    equation: string,
    threadId?: string,
  ): Promise<{ result: string; threadId?: string }> {
    try {
      const assistantsClient = this.getClient();

      const options: AssistantCreateParams = {
        model: this.deployment,
        name: "API Instructor",
        instructions:
          "You are a personal API Instructor. Give the response accordingly.",
      };

      const role = "user";
      const message = ` ${equation}`;

      let currentThreadId = threadId;

      // Create an assistant
      const assistantResponse: Assistant =
        await assistantsClient.beta.assistants.create(options);
      const currentAssistantId = assistantResponse.id;

      if (!currentThreadId) {
        // Create an thread if it does not exist
        const assistantThread: Thread =
          await assistantsClient.beta.threads.create({});
        currentThreadId = assistantThread.id;
      }

      // Add a user question to the existing thread
      await assistantsClient.beta.threads.messages.create(currentThreadId, {
        role,
        content: message,
      });

      // Run the thread and poll it until it is in a terminal state
      await assistantsClient.beta.threads.runs.createAndPoll(
        currentThreadId,
        {
          assistant_id: currentAssistantId,
        },
        { pollIntervalMs: 500 },
      );

      // Get the messages
      const runMessages: MessagesPage =
        await assistantsClient.beta.threads.messages.list(currentThreadId);
      for await (const runMessageDatum of runMessages) {
        for (const item of runMessageDatum.content) {
          if (item.type === "text") {
            return {
              result: item.text?.value || "No solution found.",
              threadId: currentThreadId,
            };
          }
        }
      }

      return { result: "No solution found.", threadId: currentThreadId };
    } catch (e) {
      return e;
    }
  }
}
