import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AzureOpenAI } from "openai";
import {
  Assistant,
  AssistantCreateParams,
} from "openai/resources/beta/assistants";
import { MessagesPage } from "openai/resources/beta/threads/messages";
import { Thread } from "openai/resources/beta/threads/threads";

@Injectable()
export class AiAssistantService {
  private endpoint: string;
  private apiKey: string;
  private deployment: string;
  private apiVersion: string;
  private maxTokens: number;
  private currentAssistantId: string;
  private assistantsClient: AzureOpenAI;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.get("ai.endpoint");
    this.apiKey = this.configService.get("ai.apiKey");
    this.deployment = this.configService.get("ai.deployment");
    this.apiVersion = this.configService.get("ai.apiVersion");
    this.maxTokens = this.configService.get("ai.maxTokens");

    this.assistantsClient = this.getClient();

    this.createAssistant();
  }

  private getClient = (): AzureOpenAI => {
    const assistantsClient = new AzureOpenAI({
      endpoint: this.endpoint,
      apiVersion: this.apiVersion,
      apiKey: this.apiKey,
    });
    return assistantsClient;
  };

  private createAssistant = async (): Promise<void> => {
    const options: AssistantCreateParams = {
      model: this.deployment,
      name: "API Instructor",
      instructions:
        "You are a personal API Instructor. Give the response accordingly.",
    };
    // Create an assistant
    const assistantResponse: Assistant =
      await this.assistantsClient.beta.assistants.create(options);
    this.currentAssistantId = assistantResponse.id;
  };

  public async generateText(
    prompt: string,
    threadId?: string,
  ): Promise<{ result: string; threadId?: string }> {
    if (!this.currentAssistantId) {
      throw new BadRequestException("Assistant not created yet");
    }
    try {
      const role = "user";
      const message = prompt;

      let currentThreadId = threadId;

      if (!currentThreadId) {
        // Create an thread if it does not exist
        const assistantThread: Thread =
          await this.assistantsClient.beta.threads.create({});
        currentThreadId = assistantThread.id;
      }

      // Add a user question to the existing thread
      await this.assistantsClient.beta.threads.messages.create(
        currentThreadId,
        {
          role,
          content: message,
        },
      );

      // Run the thread and poll it until it is in a terminal state
      await this.assistantsClient.beta.threads.runs.createAndPoll(
        currentThreadId,
        {
          assistant_id: this.currentAssistantId,
        },
        { pollIntervalMs: 500 },
      );

      // Get the messages
      const runMessages: MessagesPage =
        await this.assistantsClient.beta.threads.messages.list(currentThreadId);
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
      throw new BadRequestException(e);
    }
  }
}
