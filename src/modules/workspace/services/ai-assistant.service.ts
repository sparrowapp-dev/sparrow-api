import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Socket } from "socket.io";

// ---- OpenAI
import { AzureOpenAI } from "openai";
import {
  Assistant,
  AssistantCreateParams,
} from "openai/resources/beta/assistants";
import { MessagesPage } from "openai/resources/beta/threads/messages";
import { Thread } from "openai/resources/beta/threads/threads";

// ---- Payload
import {
  AIResponseDto,
  PromptPayload,
  StreamPromptPayload,
} from "../payloads/ai-assistant.payload";

// ---- Services
import { ContextService } from "@src/modules/common/services/context.service";
import { ProducerService } from "@src/modules/common/services/kafka/producer.service";

// ---- Enums
import { TOPIC } from "@src/modules/common/enum/topic.enum";

/**
 * Service for managing AI Assistant interactions.
 */
@Injectable()
export class AiAssistantService {
  // Properties for AzureOpenAI client configuration
  private endpoint: string;
  private apiKey: string;
  private deployment: string;
  private apiVersion: string;
  private maxTokens: number;
  private assistantsClient: AzureOpenAI;
  // Default assistant configuration
  private assistant = {
    name: "API Instructor",
  };

  /**
   * Constructor for AiAssistantService.
   * @param contextService - Context service to get current user information.
   * @param configService - Config service to retrieve environment variables.
   * @param producerService - Kafka producer service to send messages to Kafka topics.
   */
  constructor(
    private readonly contextService: ContextService,
    private readonly configService: ConfigService,
    private readonly producerService: ProducerService,
  ) {
    // Retrieve configuration from environment variables
    this.endpoint = this.configService.get("ai.endpoint");
    this.apiKey = this.configService.get("ai.apiKey");
    this.deployment = this.configService.get("ai.deployment");
    this.apiVersion = this.configService.get("ai.apiVersion");
    this.maxTokens = this.configService.get("ai.maxTokens");

    // Initialize the AzureOpenAI client
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
   * Asynchronously creates a new assistant with given instructions.
   * @param _instructions - Instructions for the new assistant.
   * @returns A promise that resolves with the assistant ID.
   * @throws BadRequestException if the assistant cannot be created.
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
   * Generates a response based on a given prompt using an assistant.
   * @param data - Prompt input data to generate a response.
   * @returns A promise that resolves with the generated text, thread ID, and message ID.
   * @throws BadRequestException if the assistant cannot be created.
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

    const pollRunner =
      await this.assistantsClient.beta.threads.runs.createAndPoll(
        currentThreadId,
        {
          assistant_id: assistantId,
          max_completion_tokens: this.maxTokens,
        },
        { pollIntervalMs: 500 },
      );

    /**
     * Example implementation for getting data stream-wise in chunks
     * Can be used in future iterations for real-time data streaming
     */
    // Run the thread and stream the responses
    // const stream = await this.assistantsClient.beta.threads.runs.stream(
    //   currentThreadId,
    //   {
    //     assistant_id: assistantId,
    //   },
    //   // { timeout: 10 },
    // );

    // for await (const event of stream) {
    //   if (event.event === "thread.message.delta") {
    //     const data = event.data;
    //     const delta = data.delta;
    //     const content = delta.content;
    //     const textBlock = content[0];
    //     if (textBlock.type === "text") {
    //       const messageValue = textBlock?.text?.value;
    //     }

    //     // await websocket.send(value);
    //   }
    // }

    // Get the messages
    const messageList: MessagesPage =
      await this.assistantsClient.beta.threads.messages.list(currentThreadId);
    const kafkaMessage = {
      userId: this.contextService.get("user")._id,
      tokenCount: pollRunner.usage.total_tokens,
    };
    await this.producerService.produce(TOPIC.AI_RESPONSE_GENERATED_TOPIC, {
      value: JSON.stringify(kafkaMessage),
    });
    for await (const message of messageList) {
      for (const item of message.content) {
        if (item.type === "text") {
          return {
            result: item.text?.value || "",
            threadId: currentThreadId,
            messageId: message.id,
          };
        }
      }
    }
    return { result: "", threadId: currentThreadId, messageId: "" };
  }

  /**
   * Generates stream wise response based on a given prompt using an assistant.
   * @param data - Prompt input data to generate a response.
   * @returns A promise that resolves with the generated text, thread ID, and message ID.
   * @throws BadRequestException if the assistant cannot be created.
   */
  public async generateTextStream(
    data: StreamPromptPayload,
    client: Socket,
  ): Promise<void> {
    const { text: prompt, threadId, instructions } = data;

    // Create assistant
    const assistantId = await this.createAssistant(instructions);
    if (!assistantId) {
      throw new BadRequestException("AI Assistant not created!");
    }

    let currentThreadId = threadId;

    // Create thread
    if (!currentThreadId) {
      const assistantThread = await this.assistantsClient.beta.threads.create(
        {},
      );
      currentThreadId = assistantThread.id;
    }

    // Send message in thread
    await this.assistantsClient.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: prompt,
    });

    // Create Stream for the run in thread
    const stream = await this.assistantsClient.beta.threads.runs.stream(
      currentThreadId,
      {
        assistant_id: assistantId,
        max_completion_tokens: this.maxTokens,
      },
    );
    let total_tokens = 0;

    // Retrieve the events from stream
    for await (const event of stream) {
      let savedMessageId = "";
      // Event for the messages which are created
      if (event.event === "thread.message.delta") {
        const eventData = event.data;
        const delta = eventData.delta;
        const content = delta.content;
        const textBlock = content[0];
        if (textBlock.type === "text") {
          const messageValue = textBlock?.text?.value;
          const response = {
            status: "Messages In Queue",
            result: messageValue || "",
            threadId: currentThreadId,
            messageId: event.data.id,
            tabId: data.tabId,
          };
          client?.emit(`aiResponse_${data.tabId}`, response);
        }
        savedMessageId = event.data.id;
      }
      // Event when thread run completed
      if (event.event === "thread.run.completed") {
        const completedResponse = {
          status: "Completed",
          result: "",
          threadId: currentThreadId,
          messageId: savedMessageId,
          tabId: data.tabId,
        };
        client?.emit(`aiResponse_${data.tabId}`, completedResponse);
        total_tokens = event.data.usage.total_tokens;
      }
      // Event for run failure
      if (event.event === "thread.run.failed") {
        const failedResponse = {
          status: "Failed",
          result: event.data.last_error || "Unknown error",
          threadId: currentThreadId,
          messageId: savedMessageId,
          tabId: data.tabId,
        };
        client?.emit(`aiResponse_${data.tabId}`, failedResponse);
      }
    }
    // Save token details
    const kafkaMessage = {
      userId: this.contextService.get("user")._id,
      tokenCount: total_tokens,
    };
    await this.producerService.produce(TOPIC.AI_RESPONSE_GENERATED_TOPIC, {
      value: JSON.stringify(kafkaMessage),
    });
  }
}
