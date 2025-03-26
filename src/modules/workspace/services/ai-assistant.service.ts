import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
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
  ChatBotPayload,
  ErrorResponsePayload,
} from "../payloads/ai-assistant.payload";

// ---- Services
import { ContextService } from "@src/modules/common/services/context.service";
import { ProducerService } from "@src/modules/common/services/kafka/producer.service";
import { ChatbotStatsService } from "./chatbot-stats.service";
import { UserService } from "../../identity/services/user.service";

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
  private monthlyTokenLimit: number;
  private assistantId: string;
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
    private readonly chatbotStatsService: ChatbotStatsService,
    private readonly userService: UserService,
  ) {
    // Retrieve configuration from environment variables
    this.endpoint = this.configService.get("ai.endpoint");
    this.apiKey = this.configService.get("ai.apiKey");
    this.deployment = this.configService.get("ai.deployment");
    this.apiVersion = this.configService.get("ai.apiVersion");
    this.maxTokens = this.configService.get("ai.maxTokens");
    this.monthlyTokenLimit = this.configService.get("ai.monthlyTokenLimit");
    this.assistantId = this.configService.get("ai.assistantId");

    // Initialize the AzureOpenAI client
    try {
      this.assistantsClient = this.getClient();
    } catch (e) {
      console.error(e);
    }
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
    const user = this.contextService.get("user");
    const stat = await this.chatbotStatsService.getIndividualStat(
      user?._id?.toString(),
    );
    const currentYearMonth = this.chatbotStatsService.getCurrentYearMonth();
    if (
      stat?.tokenStats &&
      stat.tokenStats?.yearMonth === currentYearMonth &&
      stat.tokenStats.tokenUsage > (this.monthlyTokenLimit || 0)
    ) {
      throw new BadRequestException("Limit reached");
    }
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
          max_completion_tokens: this.maxTokens || 0,
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
        max_completion_tokens: this.maxTokens || 0,
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

  /**
   * Generates stream wise response based on a given prompt using an assistant.
   * @param data - Prompt input data to generate a response.
   * @returns A promise that resolves with the generated text, thread ID, and message ID.
   * @throws BadRequestException if the assistant cannot be created.
   */
  public async generateTextChatBot(
    data: ChatBotPayload,
    client: Socket,
  ): Promise<void> {
    try {
      const parsedData = typeof data === "string" ? JSON.parse(data) : data;
      const text = parsedData.userInput;
      let threadId = parsedData.threadId;
      const tabId = parsedData.tabId;
      const emailId = parsedData.emailId;
      const apiData = parsedData.apiData || "Data not available";

      const user = await this.userService.getUserByEmail(emailId);
      const stat = await this.chatbotStatsService.getIndividualStat(
        user?._id?.toString(),
      );
      const currentYearMonth = this.chatbotStatsService.getCurrentYearMonth();
      if (
        stat?.tokenStats &&
        stat.tokenStats?.yearMonth === currentYearMonth &&
        stat.tokenStats.tokenUsage > (this.monthlyTokenLimit || 0)
      ) {
        client.emit(`assistant-response_${tabId}`, {
          messages: "Limit Reached. Can you please try again after some time.",
        });
        throw new BadRequestException("Limit reached");
      }

      // Validate payload
      if (!text) {
        throw new BadRequestException(
          "Invalid input: 'text' field is required.",
        );
      }

      if (!this.assistantsClient) {
        throw new InternalServerErrorException(
          "AI assistant client is not initialized.",
        );
      }

      const runAssistant = async () => {
        try {
          if (!threadId) {
            console.log("Creating a new thread");
            const assistantThread =
              await this.assistantsClient.beta.threads.create({});
            threadId = assistantThread.id;
          }

          await this.assistantsClient.beta.threads.messages.create(threadId, {
            role: "user",
            content: `{Text: ${text} , API data: ${apiData} }`,
          });

          const assistantResponse =
            await this.assistantsClient.beta.assistants.retrieve(
              this.assistantId,
            );
          const runResponse =
            await this.assistantsClient.beta.threads.runs.create(threadId, {
              assistant_id: assistantResponse.id,
            });

          let runStatus = runResponse.status;
          while (runStatus === "queued" || runStatus === "in_progress") {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            const runStatusResponse =
              await this.assistantsClient.beta.threads.runs.retrieve(
                threadId,
                runResponse.id,
              );
            runStatus = runStatusResponse.status;
          }

          if (runStatus === "completed") {
            const messagesResponse =
              await this.assistantsClient.beta.threads.messages.list(threadId);

            const completedRun =
              await this.assistantsClient.beta.threads.runs.retrieve(
                threadId,
                runResponse.id,
              );
            const tokenUsage = completedRun.usage || {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            };

            const latestAssistantMessage = messagesResponse.data
              .filter((message) => message.role === "assistant")
              .sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime(),
              )[0];

            const assistantReply = latestAssistantMessage.content
              .filter((item) => item.type === "text")
              .map((item) => item.text.value)
              .join(" ");

            client.emit(`assistant-response_${tabId}`, {
              messages: assistantReply,
              thread_Id: threadId,
            });

            const id = user._id.toString();

            const kafkaMessage = {
              userId: id,
              tokenCount: tokenUsage,
            };
            await this.producerService.produce(
              TOPIC.AI_RESPONSE_GENERATED_TOPIC,
              {
                value: JSON.stringify(kafkaMessage),
              },
            );
          } else {
            console.error(
              `Run status is ${runStatus}, unable to fetch messages.`,
            );
            throw new InternalServerErrorException(
              "Assistant could not complete the request.",
            );
          }
        } catch (error) {
          client.emit(`assistant-response_${tabId}`, {
            messages:
              "Some Issue Occurred in Processing your Request. Please try again",
            thread_Id: threadId,
          });
        }
      };

      runAssistant();
    } catch (error) {
      client.emit("assistant-response", {
        messages: "Please try again",
        thread_Id: null,
      });
    }
  }

  public async specificError(text: ErrorResponsePayload): Promise<string> {
    try {
      if (!text) {
        throw new BadRequestException(
          "Invalid input: 'text' field is required.",
        );
      }

      const curl = text.curl;
      const error = text.error;

      const prompt =
        "You are provided with two things. One is cURL and second is the error message. You need to provide the solution for the error message.";

      const userMessage = `This is the cURL: ${curl} and this is the Error: ${error}`;

      const messages: { role: "system" | "user"; content: string }[] = [
        { role: "system", content: prompt },
        { role: "user", content: userMessage },
      ];

      const response = await this.assistantsClient.chat.completions.create({
        model: "sparrow",
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024,
      });

      const result =
        response.choices[response.choices.length - 1].message.content.trim();
      return result;
    } catch (error) {
      console.error("Error processing specificError:", error);
      throw new InternalServerErrorException(
        "An error occurred while processing the request.",
      );
    }
  }
}
