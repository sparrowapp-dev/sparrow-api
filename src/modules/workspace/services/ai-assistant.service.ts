import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AzureOpenAI } from "openai";
import {
  Assistant,
  AssistantCreateParams,
} from "openai/resources/beta/assistants";
import { MessagesPage } from "openai/resources/beta/threads/messages";
import { Thread } from "openai/resources/beta/threads/threads";
import { AIResponseDto, PromptPayload } from "../payloads/ai-assistant.payload";

@Injectable()
export class AiAssistantService {
  private endpoint: string;
  private apiKey: string;
  private deployment: string;
  private apiVersion: string;
  private maxTokens: number;
  private assistantsClient: AzureOpenAI;
  private assistant = {
    name: "API Instructor",
  };

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.get("ai.endpoint");
    this.apiKey = this.configService.get("ai.apiKey");
    this.deployment = this.configService.get("ai.deployment");
    this.apiVersion = this.configService.get("ai.apiVersion");
    this.maxTokens = this.configService.get("ai.maxTokens");

    this.assistantsClient = this.getClient();
  }

  /**
   * Creates and returns a new instance of the AzureOpenAI client.
   *
   * @returns  A new instance of the AzureOpenAI client.
   */
  private getClient = (): AzureOpenAI => {
    const assistantsClient = new AzureOpenAI({
      endpoint: this.endpoint,
      apiVersion: this.apiVersion,
      apiKey: this.apiKey,
    });
    return assistantsClient;
  };

  /**
   * Asynchronously creates a new assistant and sets the current assistant ID.
   *
   * @returns  A promise that resolves when the assistant is created.
   */
  private createAssistant = async (_instructions: string): Promise<string> => {
    const options: AssistantCreateParams = {
      model: this.deployment,
      name: this.assistant.name,
      instructions: _instructions,
    };
    // Create an assistant
    const assistantResponse: Assistant =
      await this.assistantsClient.beta.assistants.create(options);
    return assistantResponse.id;
  };

  /**
   * Generates text based on a given prompt using an assistant.
   *
   * @param  data - The prompt input data to generate a response.
   * @returns A promise that resolves with the generated text and optional thread ID.
   */
  public async generateText(data: PromptPayload): Promise<AIResponseDto> {
    const { text: prompt, threadId, instructions } = data;
    const assistantId = await this.createAssistant(instructions);
    if (!assistantId) {
      throw new BadRequestException("AI Assistant not created!");
    }

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
    await this.assistantsClient.beta.threads.messages.create(currentThreadId, {
      role,
      content: message,
    });

    // Run the thread and poll it until it is in a terminal state
    await this.assistantsClient.beta.threads.runs.createAndPoll(
      currentThreadId,
      {
        assistant_id: assistantId,
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
            result: item.text?.value || "",
            threadId: currentThreadId,
          };
        }
      }
    }
    return { result: "", threadId: currentThreadId };
  }
}
