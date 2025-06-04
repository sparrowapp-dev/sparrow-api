import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Socket } from "socket.io";
import { Server, WebSocket, MessageEvent } from "ws";

// ---- OpenAI
import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { AzureOpenAI , OpenAI } from "openai";
import { createSseStream } from "@azure/core-sse";
import {
  Assistant,
  AssistantCreateParams,
} from "openai/resources/beta/assistants";
import { MessagesPage } from "openai/resources/beta/threads/messages";
import { Thread } from "openai/resources/beta/threads/threads";
import type { IncomingMessage } from "node:http";

// import { GoogleGenAI } from "@google/genai";
import Anthropic from '@anthropic-ai/sdk';

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
import { parseWhitelistedEmailList } from "@src/modules/common/util/email.parser.util";
import {  Models , AiService , ClaudeModelVersion , GoogleModelVersion , OpenAIModelVersion , DeepSeepModelVersion , Roles} from "@src/modules/common/enum/ai-services.enum";

// ---- Instructions
import { instructions } from "@src/modules/common/instructions/prompt";
import { totalmem } from "node:os";
import { Role } from "nest-access-control";
// import { GoogleGenAI } from "@google/genai";

async function initializeGenAI(authKey: string, client?: WebSocket) 
{
  const { GoogleGenAI } = await import('@google/genai');
  try {
    const genAI = new GoogleGenAI({ apiKey: authKey });
    return genAI;
  } catch (error: any) {
      if (client?.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            event: 'error',
            message: 'Invalid Authentication. Please add a valid Google Gemini API key.',
          })
        );
      }
      return null;
  }
}

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
  private gptAssistantsClient: AzureOpenAI;
  private deepseekClient: ReturnType<typeof ModelClient>;
  private monthlyTokenLimit: number;
  private whiteListUserTokenLimit: number;
  private assistantId: string;
  private deepseekEndpoint: string;
  private deepseekApiKey: string;
  private deepseekApiVersion: string;
  private deepseekurl: string;
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
    this.whiteListUserTokenLimit - 100000;
    this.deepseekEndpoint = this.configService.get("ai.deepseekEndpoint");
    this.deepseekApiKey = this.configService.get("ai.deepseekApiKey");
    this.deepseekApiVersion = this.configService.get("ai.deepseekApiVersion");
    this.deepseekurl = this.configService.get("ai.deepseekURL")

    // Initialize the AzureOpenAI client
    try {
      this.gptAssistantsClient = this.getGPTClient();
    } catch (e) {
      console.error(e);
    }

    // Initialize the DeepSeek client
    try {
      this.deepseekClient = this.getDeepSeekClient();
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Creates and returns a new instance of the AzureOpenAI client.
   *
   * @returns  A new instance of the AzureOpenAI client.
   */
  private getGPTClient = (): AzureOpenAI => {
    const gptAssistantsClient = new AzureOpenAI({
      endpoint: this.endpoint,
      apiVersion: this.apiVersion,
      apiKey: this.apiKey,
    });
    return gptAssistantsClient;
  };

  /**
   * Creates and returns a new instance of the DeepSeek client.
   *
   * @returns  A new instance of the DeepSeek client.
   */
  private getDeepSeekClient = (): ReturnType<typeof ModelClient> => {
    const endpoint = this.deepseekEndpoint;
    const apiKey = this.deepseekApiKey;
    const apiVersion = this.deepseekApiVersion;
  
    const client = ModelClient(endpoint, new AzureKeyCredential(apiKey), {apiVersion});
    return client;
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
      await this.gptAssistantsClient.beta.assistants.create(options);
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
    const whitelistEmails = await this.configService.get(
      "whitelist.userEmails",
    );
    let parsedWhiteListEmails: string[] = [];
    if (whitelistEmails) {
      parsedWhiteListEmails = parseWhitelistedEmailList(whitelistEmails) || [];
    }
    if (
      (stat?.tokenStats &&
        stat.tokenStats?.yearMonth === currentYearMonth &&
        stat.tokenStats.tokenUsage > (this.monthlyTokenLimit || 0) &&
        !parsedWhiteListEmails.includes(user?.email)) ||
      (stat?.tokenStats &&
        stat.tokenStats?.yearMonth === currentYearMonth &&
        parsedWhiteListEmails.includes(user?.email) &&
        stat.tokenStats.tokenUsage > this.whiteListUserTokenLimit)
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
        await this.gptAssistantsClient.beta.threads.create({});
      currentThreadId = assistantThread.id;
    }

    // Add a user question to the existing thread
    await this.gptAssistantsClient.beta.threads.messages.create(currentThreadId, {
      role,
      content: message,
    });

    // Run the thread and poll it until it is in a terminal state

    const pollRunner =
      await this.gptAssistantsClient.beta.threads.runs.createAndPoll(
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
    // const stream = await this.gptAssistantsClient.beta.threads.runs.stream(
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
      await this.gptAssistantsClient.beta.threads.messages.list(currentThreadId);
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
      const assistantThread = await this.gptAssistantsClient.beta.threads.create(
        {},
      );
      currentThreadId = assistantThread.id;
    }

    // Send message in thread
    await this.gptAssistantsClient.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: prompt,
    });

    // Create Stream for the run in thread
    const stream = await this.gptAssistantsClient.beta.threads.runs.stream(
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
   * Handles interaction with the GPT model.
   * @param client - The WebSocket client connection.
   * @param emailId - The email ID of the user.
   * @param text - The input text for the model.
   * @param apiData - Additional API data for the model.
   * @param tabId - The ID of the tab where the interaction is taking place.
   * @param threadId - Optional thread ID for the interaction.
   */
  private async handleGptModelInteraction(
    client: WebSocket,
    emailId: string,
    text: string,
    apiData: string,
    tabId: string,
    threadId?: string,
    model?: string,
    activity?: string
  ): Promise<void> {
    // Fetch user details
    const user = await this.userService.getUserByEmail(emailId);
    const stat = await this.chatbotStatsService.getIndividualStat(
      user?._id?.toString(),
    );
    const currentYearMonth = this.chatbotStatsService.getCurrentYearMonth();
    const whitelistEmails = await this.configService.get(
      "whitelist.userEmails",
    );
    let parsedWhiteListEmails: string[] = [];
    if (whitelistEmails) {
      parsedWhiteListEmails =
        parseWhitelistedEmailList(whitelistEmails) || [];
    }

    // Check if user exceeded token limit
    if (
      (stat?.aiModel &&
        stat.aiModel?.yearMonth === currentYearMonth &&
        (stat.aiModel.gpt + stat.aiModel.deepseek) > (this.monthlyTokenLimit || 0) &&
        !parsedWhiteListEmails.includes(emailId)) ||
      (stat?.aiModel &&
        stat.aiModel?.yearMonth === currentYearMonth &&
        parsedWhiteListEmails.includes(emailId) &&
        (stat.aiModel.gpt + stat.aiModel.deepseek) > this.whiteListUserTokenLimit)
    ) {
      client.send(
        JSON.stringify({
          messages: "Limit Reached. Please try again later.",
          thread_Id: threadId,
          tab_id: tabId,
        }),
      );
      return;
    }
  
    // Validate input
    if (!text) {
      throw new BadRequestException("Invalid input: 'text' field is required.");
    }
  
    if (!this.gptAssistantsClient) {
      throw new InternalServerErrorException("AI assistant client is not initialized.");
    }
  
    if (!threadId) {
      const assistantThread = await this.gptAssistantsClient.beta.threads.create({});
      threadId = assistantThread.id;
    }
  
    await this.gptAssistantsClient.beta.threads.messages.create(threadId, {
      role: "user",
      content: `{Text: ${text}, API data: ${apiData}}`,
    });
  
    client.send(JSON.stringify({
      messages: "",
      thread_Id: threadId,
      tab_id: tabId,
      stream_status: "start",
    }));
  
    this.gptAssistantsClient.beta.threads.runs.stream(threadId, {
      assistant_id: this.assistantId,
    })
      .on('textDelta', (textDelta) => {
        const chunk = textDelta.value;
        client.send(JSON.stringify({
          messages: chunk,
          thread_Id: threadId,
          tab_id: tabId,
          stream_status: "streaming",
        }));
      })
      .on('end', async () => {
        try {
          client.send(JSON.stringify({
            messages: "",
            thread_Id: threadId,
            tab_id: tabId,
            stream_status: "end",
          }));
  
          const runsList = await this.gptAssistantsClient.beta.threads.runs.list(threadId);
          const latestRun = runsList.data[0];
  
          if (latestRun?.usage) {
            const tokenUsage = latestRun.usage.total_tokens;
  
            const kafkaMessage = {
              userId: user._id.toString(),
              tokenCount: tokenUsage,
              model: model
            };
            
            await this.producerService.produce(
              TOPIC.AI_RESPONSE_GENERATED_TOPIC,
              {
                value: JSON.stringify(kafkaMessage),
              },
            );
            
            
            // Update the actvity log in the database
            const activityLog = {
              userId: user._id.toString(),
              activity: activity,
              model: model,
              tokenConsumed: tokenUsage,
              threadId: threadId,
            }
            
            // Send activity log to Kafka topic
            await this.producerService.produce(
              TOPIC.AI_ACTIVITY_LOG_TOPIC,
              {
                value: JSON.stringify(activityLog),
              },
            );
          
          } else {
            console.warn("Run usage not yet available.");
          }


        } catch (err) {
          console.error("Error handling usage after stream:", err);
        }
      })
      .on('error', () => {
        client.send(JSON.stringify({
          messages: "Some issue occurred while processing your request. Please try again.",
          thread_Id: threadId,
          tab_id: tabId,
        }));
      });
  }


  /**
   * Handles interaction with the Deepseek model.
   * @param client - The WebSocket client connection.
   * @param emailId - The email ID of the user.
   * @param text - The input text for the model.
   * @param apiData - Additional API data for the model.
   * @param tabId - The ID of the tab where the interaction is taking place.
   * @param threadId - Optional thread ID for the interaction.
   */
  private async handleDeepseekModelInteraction(
    client: WebSocket,
    emailId: string,
    text: string,
    apiData: string,
    tabId: string,
    conversation?: string,
    model?: string,
    activity?: string
  ): Promise<void> {

    type ChatMessage = {
      role: Roles.system | Roles.user | Roles.assistant;
      content: string;
    };

    // Fetch user details
    const user = await this.userService.getUserByEmail(emailId);
    const stat = await this.chatbotStatsService.getIndividualStat(
      user?._id?.toString(),
    );
    const currentYearMonth = this.chatbotStatsService.getCurrentYearMonth();
    const whitelistEmails = await this.configService.get(
      "whitelist.userEmails",
    );
    let parsedWhiteListEmails: string[] = [];
    if (whitelistEmails) {
      parsedWhiteListEmails =
        parseWhitelistedEmailList(whitelistEmails) || [];
    }

    // Check if user exceeded token limit
    if (
      (stat?.aiModel &&
        stat.aiModel?.yearMonth === currentYearMonth &&
        (stat.aiModel.gpt + stat.aiModel.deepseek) > (this.monthlyTokenLimit || 0) &&
        !parsedWhiteListEmails.includes(emailId)) ||
      (stat?.aiModel &&
        stat.aiModel?.yearMonth === currentYearMonth &&
        parsedWhiteListEmails.includes(emailId) &&
        (stat.aiModel.gpt + stat.aiModel.deepseek) > this.whiteListUserTokenLimit)
    ) {
      client.send(
        JSON.stringify({
          messages: "Limit Reached. Please try again later.",
          thread_Id: null,
          tab_id: tabId,
        }),
      );
      return;
    }
    
    // Validate user input
    if (!text) {
      throw new BadRequestException("Invalid input: 'text' field is required.");
    }

    if (!this.deepseekClient) {
      throw new InternalServerErrorException("DeepSeek AI client is not initialized.");
    }

    let conversationMessages: ChatMessage[] = [];

    if (conversation) {
      try {
        if (Array.isArray(conversation)) {
          conversationMessages = conversation as ChatMessage[];
        } else if (typeof conversation === "string") {
          conversationMessages = JSON.parse(conversation) as ChatMessage[];
        } else {
          console.warn("Invalid conversation format: Not a string or array");
        }
      } catch (e) {
        console.warn("Failed to parse conversation:", e);
      }
    }

    const userInput = `{Text: ${text}, API data: ${apiData}}`;
    
    const messageHistory: ChatMessage[] = [
      { role: Roles.system, content: instructions },
      ...conversationMessages,
      { role: Roles.user, content: userInput },
    ];
    
    try {
      client.send(JSON.stringify({
        messages: "",
        thread_Id: null,
        tab_id: tabId,
        stream_status: "start",
      })); 

      const response = await this.deepseekClient.path("/chat/completions").post({
        body: {
          messages: messageHistory,
          max_tokens: 2048,
          temperature: 0.8,
          top_p: 0.1,
          presence_penalty: 0,
          frequency_penalty: 0,
          model: "DeepSeek-V3-DEV",
          stream: true
        }
      }).asNodeStream();

      const stream = response.body;
    
      const sses = createSseStream(stream as IncomingMessage);
    
      for await (const event of sses) {
        if (event.data === "[DONE]") {
          // Send end-of-stream signal
          client.send(JSON.stringify({
            messages: "",
            thread_Id: null,
            tab_id: tabId,
            stream_status: "end",
          }));
          return;
        }
      
        try {
          const parsed = JSON.parse(event.data);
          for (const choice of parsed.choices) {
            client.send(JSON.stringify({
              messages: choice.delta?.content ?? "",
              thread_Id: null,
              tab_id: tabId,
              stream_status: "streaming",
            }));
          }

          if (parsed?.usage) {
            const tokenUsage = parsed.usage.total_tokens;
  
            const kafkaMessage = {
              userId: user._id.toString(),
              tokenCount: tokenUsage,
              model: model
            };
  
            await this.producerService.produce(
              TOPIC.AI_RESPONSE_GENERATED_TOPIC,
              {
                value: JSON.stringify(kafkaMessage),
              },
            );

            const activityLog = {
              userId: user._id.toString(),
              activity: activity,
              model: model,
              tokenConsumed: tokenUsage,
              threadId: "null",
            }
            
            // Send activity log to Kafka topic
            await this.producerService.produce(
              TOPIC.AI_ACTIVITY_LOG_TOPIC,
              {
                value: JSON.stringify(activityLog),
              },
            );
          } else {
            console.warn("Run usage not yet available.");
          }

        } catch (e) {
          console.error("Invalid JSON in event data:", event.data, e);
        }
      }
      
      
    } catch (error) {
      console.error("DeepSeek error:", error);
      client.send(JSON.stringify({
        messages: "Some issue occurred while processing your request. Please try again.",
        thread_Id: null,
        tab_id: tabId,
      }));
    }
  }

  private async createOpenAIClient(
    client: WebSocket,
    authKey: string
  ): Promise<OpenAI | null> {
    try {
      const OpenAIclient = new OpenAI({
        apiKey: authKey,
      });
      return OpenAIclient;
    } catch (error: any) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            event: "error",
            message: "Invalid Authentication. Please add a valid OpenAI API key.",
          })
        );
      }
      return null;
    }
  }

  private async createAnthropicClient(
    client: WebSocket,
    authKey: string
  ): Promise<Anthropic | null> {
    try {
      const Anthropiclient = new Anthropic({
        apiKey: authKey,
      });
      return Anthropiclient;
    } catch (error: any) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            event: "error",
            message: "Invalid Authentication. Please add a valid Anthropic key.",
          })
        );
      }
      return null;
    }
  }

  private async createDeepSeekClient(
    client: WebSocket,
    authKey: string
  ): Promise<OpenAI | null> {
    try {
      const DeepSeekClient = new OpenAI({
        baseURL: this.deepseekurl,
        apiKey: authKey,
      });
      return DeepSeekClient;
    } catch (error: any) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            event: "error",
            message: "Invalid Authentication. Please add a valid DeepSeek key.",
          })
        );
      }
      return null;
    }
  }

  /**
     * Formats response metrics with timing information
     * @param data Response content
     * @param inputTokens Number of input tokens used
     * @param outputTokens Number of output tokens generated
     * @param totalTokens Total tokens used in the request
     * @param startTime Performance start time for timing calculation
     * @returns Formatted response object
     */
    private formatResponse(
      inputTokens: number,
      outputTokens: number,
      totalTokens: number,
      startTime: number
    ) {
      const endTime = performance.now();
      const timeTaken = Math.round(endTime - startTime);
      
      return {
        statusCode: 200,
        messages: "",
        stream_status: "end",
        inputTokens,
        outputTokens,
        totalTokens,
        timeTaken: `${timeTaken}ms`,
      };
    }

  /**
     * Processes LLM requests through Google API
     */
    private async geminiLLMService(
      client: WebSocket,
      GoogleClient: any,
      modelVersion: string,
      systemPrompt: string,
      userInput: string,
      conversation: string,
      streamResponse: boolean,
      jsonResponseFormat: boolean,
      temperature: number,
      topP: number,
      maxTokens: number,
    ): Promise<void> {
      // Return early if Google client creation failed
      if (!GoogleClient) return;
  
      const startTime = performance.now();
      
      let parsedHistory: any[] = [];

      try {
        if (typeof conversation === "string" && conversation.trim()) {
          parsedHistory = JSON.parse(conversation);
          if (!Array.isArray(parsedHistory)) throw new Error("Invalid format");
        }
      } catch (err) {
        console.error("Invalid conversation format", err);
        parsedHistory = []; // fall back to empty history
      }

      try {        

        // Handle streaming response
        if (streamResponse === true) {
          const requestPayload: any = {
            model: modelVersion,
            config: {
              systemInstruction: systemPrompt,
              maxOutputTokens: maxTokens,
              temperature: temperature,
              topP: topP,
              ...(jsonResponseFormat && { responseMimeType: 'application/json' })
            }
          };

          if (conversation) {
            try {
              const parsed = JSON.parse(conversation);
              if (Array.isArray(parsed)) {
                requestPayload.history = parsed;
              } else {
                console.warn("Conversation provided but not in expected format.");
              }
            } catch (err) {
              console.warn("Failed to parse conversation:", err);
            }
          }

          const response = await GoogleClient.chats.create(requestPayload);
          const response1 = await response.sendMessageStream({ message: userInput });
          
          // Signal stream start
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: "",
                stream_status: "start"
              })
            );
          }

          // Process stream chunks
          for await (const event of response1) {
            if (client.readyState !== WebSocket.OPEN) break;
            
            const choice = event.text;
            
            // Send content chunk if it exists
              client.send(
                JSON.stringify({
                  messages: choice,
                  stream_status: "streaming"
                })
              );
          }
            
          const TokensResponse = await GoogleClient.models.generateContent({
            config: {
              systemInstruction: systemPrompt,
              maxOutputTokens: maxTokens,
              temperature: temperature,
              topP: topP,
              ...(jsonResponseFormat && { responseMimeType: 'application/json' })
            },
            model: modelVersion,
            contents: conversation || userInput,
          });

        
          const endTime = performance.now();
          const timeTaken = Math.round(endTime - startTime);

          client.send(
            JSON.stringify({
              statusCode: 200,
              messages: "",
              stream_status: "end",
              inputTokens: TokensResponse.usageMetadata.promptTokenCount,
              outputTokens: TokensResponse.usageMetadata.candidatesTokenCount,
              totalTokens: TokensResponse.usageMetadata.totalTokenCount,
              timeTaken: `${timeTaken}ms`,
            })
          );
        }

        // Handle non-streaming response
        else {
          const requestPayload: any = {
            model: modelVersion,
            config: {
              systemInstruction: systemPrompt,
              maxOutputTokens: maxTokens > 0 ? maxTokens : 1024,
              temperature: temperature,
              topP: topP,
              ...(jsonResponseFormat && { responseMimeType: 'application/json' })
            }
          };

          if (conversation) {
            try {
              const parsed = JSON.parse(conversation);
              if (Array.isArray(parsed)) {
                requestPayload.history = parsed;
              } else {
                console.warn("Conversation provided but not in expected format.");
              }
            } catch (err) {
              console.warn("Failed to parse conversation:", err);
            }
          }

          const response = await GoogleClient.chats.create(requestPayload);
          const response1 = await response.sendMessage({ message: userInput });

          const TokensResponse = await GoogleClient.models.generateContent({
            config: {
              systemInstruction: systemPrompt,
              maxOutputTokens: maxTokens,
              temperature: temperature,
              topP: topP,
              ...(jsonResponseFormat && { responseMimeType: 'application/json' })
            },
            model: modelVersion,
            contents: conversation || userInput,
          });


          // Signal stream start
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: "",
                stream_status: "start"
              })
            );
          }
          
          const data = response1.text;

          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: data,
                stream_status: "streaming"
              })
            );
          }
          
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify(this.formatResponse(
                TokensResponse.usageMetadata.promptTokenCount || 0,
                TokensResponse.usageMetadata.candidatesTokenCount || 0,
                TokensResponse.usageMetadata.totalTokenCount || 0,
                startTime
              ))
            );
          }
        }
      } catch (error: any) {
        if (client.readyState === WebSocket.OPEN) {
            const endTime = performance.now();
            const timeTaken = Math.round(endTime - startTime);
            const message = (error.message.match(/"message":"([^"]+)"/) || [])[1] || "Some Issue Occurred in Processing your Request. Please try again";
          client.send(
            JSON.stringify({
              timeTaken: `${timeTaken}ms`,
              statusCode: error?.status || error?.error?.code || 500,
              event: "error",
              message: message
            })
          );
        }
      }
    }


    /**
     * Processes LLM requests through Anthropic API
     */
    private async anthropicLLMService(
      client: WebSocket,
      Anthropicclient: Anthropic | null,
      modelVersion: string,
      systemPrompt: string,
      userInput: string,
      streamResponse: boolean,
      temperature: number,
      topP: number,
      maxTokens: number,
    ): Promise<void> {

      // Return early if Anthropic client creation failed
      if (!Anthropicclient) return;
  
      const startTime = performance.now();
      
      // Message format for Anthropic API
      // const messages: { role: "assistant" | "user"; content: string }[] = [
      //   { role: "user", content: userInput },
      //   { role: "assistant", content: systemPrompt }
      // ];

      type ChatMessage = {
        role: Roles.user | Roles.assistant;
        content: string;
      };

      let messages: ChatMessage[];

      if (typeof userInput === 'string') {
        try {
          messages = JSON.parse(userInput) as ChatMessage[];
        } catch (err) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              statusCode: 400,
              event: "error",
              message: "Invalid JSON format for userInput."
            }));
          }
          return;
        }
      } else {
        messages = userInput as ChatMessage[];
      }
  
      try {
        // Handle streaming response
        if (streamResponse === true) {
          
          const stream = await Anthropicclient.messages.create({
            messages: messages,
            model: modelVersion,
            temperature: temperature,
            top_p: topP,
            max_tokens: maxTokens > 0 ? maxTokens : 1024,
            stream: true
          });
          
          // Signal stream start
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: "",
                stream_status: "start"
              })
            );
          }
          for await (const event of stream) {
            if (client.readyState !== WebSocket.OPEN) break;

            // Handle text deltas
            if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                client.send(
                  JSON.stringify({
                    messages: event.delta.text,
                    stream_status: 'streaming',
                  })
                );
              }
            }

            const inputTokens = await Anthropicclient.messages.countTokens({
              model: modelVersion,
              messages: messages
            });

            const input_tokens = inputTokens.input_tokens

            // Final usage and stream end
            if (event.type === 'message_delta' && event.usage) {
              const endTime = performance.now();
              const timeTaken = Math.round(endTime - startTime);

              client.send(
                JSON.stringify({
                  statusCode: 200,
                  messages: "",
                  stream_status: "end",
                  inputTokens: input_tokens,
                  outputTokens: event.usage.output_tokens,
                  totalTokens: input_tokens + event.usage.output_tokens,
                  timeTaken: `${timeTaken}ms`,
                })
              );
            }
          }
      }
        // Handle non-streaming response
        else {
          const response = await Anthropicclient.messages.create({
            model: modelVersion,
            messages: messages,
            temperature: temperature,
            top_p: topP,
            max_tokens: maxTokens > 0 ? maxTokens : 1024

          });

          const data = response.content
            .map((block) => ('text' in block ? block.text : ''))
            .join('');

          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: "",
                stream_status: "start"
              })
            );
          }

          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: data,
                stream_status: "streaming"
              })
            );
          }

          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify(this.formatResponse(
                response.usage?.input_tokens || 0,
                response.usage?.output_tokens || 0,
                response.usage?.input_tokens + response.usage?.output_tokens || 0,
                startTime
              ))
            );
          }
        }
      } catch (error: any) {
        if (client.readyState === WebSocket.OPEN) {
            const endTime = performance.now();
            const timeTaken = Math.round(endTime - startTime);
          client.send(
            JSON.stringify({
              timeTaken: `${timeTaken}ms`,
              statusCode: error?.status || 500,
              event: "error",
              message: error?.message || error?.error?.error?.message || "Some Issue Occurred in Processing your Request. Please try again",
            })
          );
        }
      }
    }

    /**
     * Processes LLM requests through DeepSeek API
     */
    private async deepseekLLMService(
      client: WebSocket,
      DeepSeekClinet: OpenAI | null,
      modelVersion: string,
      systemPrompt: string,
      userInput: string,
      streamResponse: boolean,
      jsonResponseFormat: boolean,
      temperature: number,
      presencePenalty: number,
      frequencePenalty: number,
      maxTokens: number,
    ): Promise<void> {
      // Return early if DeepSeek client creation failed
      if (!DeepSeekClinet) return;
  
      const startTime = performance.now();
      
      // Message format for DeepSeek API
      // const messages: { role: "system" | "user"; content: string }[] = [
      //   { role: "system", content: systemPrompt },
      //   { role: "user", content: userInput },
      // ];

      // Message for Contextual Chatbot 
      type ChatMessage = {
        role: Roles.system | Roles.user | Roles.assistant;
        content: string;
      };

      let messages: ChatMessage[];

      if (typeof userInput === 'string') {
        try {
          messages = JSON.parse(userInput) as ChatMessage[];
        } catch (err) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              statusCode: 400,
              event: "error",
              message: "Invalid JSON format for userInput."
            }));
          }
          return;
        }
      } else {
        messages = userInput as ChatMessage[];
      }
  
      try {        
        // Handle streaming response
        if (streamResponse === true) {
          const stream = await DeepSeekClinet.chat.completions.create({
            model: modelVersion,
            messages: messages,
            temperature: temperature,
            presence_penalty: presencePenalty,
            frequency_penalty: frequencePenalty,
            ...(maxTokens > 1 && { max_tokens: maxTokens }),
            ...(jsonResponseFormat && { response_format: { type: "json_object" } }),
            stream: true,
            stream_options: { include_usage: true }
          });
          
          // Signal stream start
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: "",
                stream_status: "start"
              })
            );
          }
          
          // Process stream chunks
          for await (const event of stream) {
            if (client.readyState !== WebSocket.OPEN) break;
            
            const choice = event.choices?.[0];
            
            // Send content chunk if it exists
            if (choice?.delta?.content) {
              client.send(
                JSON.stringify({
                  messages: choice.delta.content,
                  stream_status: "streaming"
                })
              );
            }
            
            // Send final usage information when available
            if (event?.usage) {
              const endTime = performance.now();
              const timeTaken = Math.round(endTime - startTime);
  
              client.send(
                JSON.stringify({
                  statusCode: 200,
                  messages: "",
                  stream_status: "end",
                  inputTokens: event.usage.prompt_tokens,
                  outputTokens: event.usage.completion_tokens,
                  totalTokens: event.usage.total_tokens,
                  timeTaken: `${timeTaken}ms`,
                })
              );
            }
          }
        }
        // Handle non-streaming response
        else {
          const response = await DeepSeekClinet.chat.completions.create({
            model: modelVersion,
            messages: messages,
            temperature: temperature,
            presence_penalty: presencePenalty,
            frequency_penalty: frequencePenalty,
            ...(maxTokens > 1 && { max_tokens: maxTokens }),
            ...(jsonResponseFormat && { response_format: { type: "json_object" } }),
          });

          // Signal stream start
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: "",
                stream_status: "start"
              })
            );
          }
          
          const data = response.choices[0]?.message?.content || "";

          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: data,
                stream_status: "streaming"
              })
            );
          }
          
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify(this.formatResponse(
                response.usage?.prompt_tokens || 0,
                response.usage?.completion_tokens || 0,
                response.usage?.total_tokens || 0,
                startTime
              ))
            );
          }
        }
      } catch (error: any) {
        if (client.readyState === WebSocket.OPEN) {
            const endTime = performance.now();
            const timeTaken = Math.round(endTime - startTime);
          client.send(
            JSON.stringify({
              timeTaken: `${timeTaken}ms`,
              statusCode: error?.status || 500,
              event: "error",
              message: error?.message || error?.error?.message || "Some Issue Occurred in Processing your Request. Please try again",
            })
          );
        }
      }
    }
  
    /**
     * Processes LLM requests through OpenAI API
     */
    private async openaiLLMService(
      client: WebSocket,
      OpenAIclient: OpenAI | null,
      modelVersion: string,
      systemPrompt: string,
      userInput: string,
      streamResponse: boolean,
      jsonResponseFormat: boolean,
      temperature: number,
      presencePenalty: number,
      frequencePenalty: number,
      maxTokens: number,
    ): Promise<void> {
      // Return early if OpenAI client creation failed
      if (!OpenAIclient) return;
  
      const startTime = performance.now();
      
      // Message format for OpenAI API
      // const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      //   { role: "system", content: systemPrompt },
      //   { role: "user", content: userInput },
      // ];
      
      // Message for Contextual Chatbot 
      type ChatMessage = {
        role: Roles.system | Roles.user | Roles.assistant;
        content: string;
      };

      let messages: ChatMessage[];

      if (modelVersion !== OpenAIModelVersion.GPT_o1_Mini) {


        if (typeof userInput === 'string') {
          try {
            messages = JSON.parse(userInput) as ChatMessage[];
          } catch (err) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                statusCode: 400,
                event: "error",
                message: "Invalid JSON format for userInput."
              }));
            }
            return;
          }
        } else {
          messages = userInput as ChatMessage[];
        }
    }

      const o1miniMessage: { role: "system" | "user"; content: string } [] = [{ role: "user", content: userInput }]
      
      try {
        // For GPT-o1 and GPT-o1 Mini models, the response is generated without streaming and with limited parameters
        if (modelVersion === OpenAIModelVersion.GPT_o1 || modelVersion === OpenAIModelVersion.GPT_o1_Mini) {
          const response = await OpenAIclient.chat.completions.create({
            model: modelVersion,
            messages: modelVersion === OpenAIModelVersion.GPT_o1_Mini ? o1miniMessage : messages,
            ...(maxTokens > 1 && { max_completion_tokens: maxTokens })
          });

          // Signal stream start
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: "",
                stream_status: "start"
              })
            );
          }
          
          const data = response.choices[0]?.message?.content || "";

          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: data,
                stream_status: "streaming"
              })
            );
          }
          
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify(this.formatResponse(
                response.usage?.prompt_tokens || 0,
                response.usage?.completion_tokens || 0,
                response.usage?.total_tokens || 0,
                startTime
              ))
            );
          }
          return;
        }
        
        // Handle streaming response
        if (streamResponse === true) {
          const stream = await OpenAIclient.chat.completions.create({
            model: modelVersion,
            messages: messages,
            ...(modelVersion !== OpenAIModelVersion.GPT_o3_Mini && {
              temperature: temperature,
              presence_penalty: presencePenalty,
              frequency_penalty: frequencePenalty,
            }),
            ...(maxTokens > 1 && { max_tokens: maxTokens }),
            ...(jsonResponseFormat && { response_format: { type: "json_object" } }),
            stream: true,
            stream_options: { include_usage: true }
          });
          
          // Signal stream start
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: "",
                stream_status: "start"
              })
            );
          }
          
          // Process stream chunks
          for await (const event of stream) {
            if (client.readyState !== WebSocket.OPEN) break;
            
            const choice = event.choices?.[0];
            
            // Send content chunk if it exists
            if (choice?.delta?.content) {
              client.send(
                JSON.stringify({
                  messages: choice.delta.content,
                  stream_status: "streaming"
                })
              );
            }
            
            // Send final usage information when available
            if (event?.usage) {
              const endTime = performance.now();
              const timeTaken = Math.round(endTime - startTime);
  
              client.send(
                JSON.stringify({
                  statusCode: 200,
                  messages: "",
                  stream_status: "end",
                  inputTokens: event.usage.prompt_tokens,
                  outputTokens: event.usage.completion_tokens,
                  totalTokens: event.usage.total_tokens,
                  timeTaken: `${timeTaken}ms`,
                })
              );
            }
          }
        }
        // Handle non-streaming response
        else {
          const response = await OpenAIclient.chat.completions.create({
            model: modelVersion,
            messages: messages,
            temperature: temperature,
            presence_penalty: presencePenalty,
            frequency_penalty: frequencePenalty,
            ...(maxTokens > 1 && { max_tokens: maxTokens }),
            ...(jsonResponseFormat && { response_format: { type: "json_object" } }),
          });

          // Signal stream start
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: "",
                stream_status: "start"
              })
            );
          }
          
          const data = response.choices[0]?.message?.content || "";

          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                messages: data,
                stream_status: "streaming"
              })
            );
          }
          
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify(this.formatResponse(
                response.usage?.prompt_tokens || 0,
                response.usage?.completion_tokens || 0,
                response.usage?.total_tokens || 0,
                startTime
              ))
            );
          }
        }
      } catch (error: any) {
        if (client.readyState === WebSocket.OPEN) {
            const endTime = performance.now();
            const timeTaken = Math.round(endTime - startTime);
          client.send(
            JSON.stringify({
              timeTaken: `${timeTaken}ms`,
              statusCode: error?.status || 500,
              event: "error",
              message: error?.error?.message || "Some Issue Occurred in Processing your Request. Please try again",
            })
          );
        }
      }
    }
    
  /**
   * Generates stream wise response based on a given prompt using an assistant.
   * @param data - Prompt input data to generate a response.
   * @returns A promise that resolves with the generated text, thread ID, and message ID.
   * @throws BadRequestException if the assistant cannot be created.
   */

  public async generateTextChatBot(client: WebSocket): Promise<void> {
    try {
      while (client.readyState === WebSocket.OPEN) {
        // Receive message from the client
        const message: string = await new Promise((resolve) => {
          const onMessage = (event: MessageEvent) => {
            resolve(event.data.toString("utf-8"));
            client.removeEventListener("message", onMessage);
          };
          client.addEventListener("message", onMessage);
        });

        let parsedData: ChatBotPayload;
        try {
          parsedData = JSON.parse(message);
        } catch (err) {
          client.send(
            JSON.stringify({ event: "error", message: "Invalid JSON format." }),
          );
          continue;
        }

        const feature = parsedData.feature;

        if (feature === AiService.SparrowAI) 
          {
            const text = parsedData.userInput;
            let threadId = parsedData.threadId;
            const tabId = parsedData.tabId;
            const emailId = parsedData.emailId;
            const apiData = parsedData.apiData || "Data not available";
            const model = parsedData.model || "deepseek";
            const conversation = parsedData.conversation || "";
            const activity = parsedData.activity || "chat";
    
            if (model === Models.GPT) {
              await this.handleGptModelInteraction(client, emailId, text, apiData, tabId, threadId, model, activity);
              continue;
            }
            else if (model === Models.DeepSeek) {
              await this.handleDeepseekModelInteraction(client, emailId, text, apiData, tabId, conversation, model, activity);
              continue;
            }
          }
        else if (feature === AiService.LlmEvaluation)
          {
              const {
                model,
                modelVersion,
                authKey = "",
                systemPrompt,
                userInput,
                conversation,
                streamResponse,
                jsonResponseFormat,
                temperature,
                presencePenalty,
                frequencePenalty,
                maxTokens,
                topP
              } = parsedData;

            // Only support OpenAI model currently
            if (model === Models.OpenAI) {
              // Create OpenAI client
              const OpenAIclient = await this.createOpenAIClient(client, authKey);
              
              // Process the LLM request
              await this.openaiLLMService(
                client,
                OpenAIclient,
                modelVersion,
                systemPrompt,
                userInput,
                streamResponse,
                jsonResponseFormat,
                temperature,
                presencePenalty,
                frequencePenalty,
                maxTokens
              );
              continue;
            }
  
            if (model === Models.Anthropic) {
              // Create OpenAI client
              const Anthropicclient = await this.createAnthropicClient(client, authKey);
              
              // Process the LLM request
              await this.anthropicLLMService(
                client,
                Anthropicclient,
                modelVersion,
                systemPrompt,
                userInput,
                streamResponse,
                temperature,
                topP,
                maxTokens
              );
              continue;
            }

            if (model === Models.DeepSeek) {
              // Create DeepSeek client
              const DeepSeekClinet = await this.createDeepSeekClient(client, authKey);
              
              // Process the LLM request
              await this.deepseekLLMService(
                client,
                DeepSeekClinet,
                modelVersion,
                systemPrompt,
                userInput,
                streamResponse,
                jsonResponseFormat,
                temperature,
                presencePenalty,
                frequencePenalty,
                maxTokens
              );
              continue;
            }

            if (model === Models.Google) {
              // Create Google client
              const GoogleClient = await initializeGenAI(authKey, client);
              
              // Process the LLM request
              await this.geminiLLMService(
                client,
                GoogleClient,
                modelVersion,
                systemPrompt,
                userInput,
                conversation,
                streamResponse,
                jsonResponseFormat,
                temperature,
                topP,
                maxTokens
              );
              continue;
            }
            
            else {
              if (client.readyState === WebSocket.OPEN) {
                client.send(
                  JSON.stringify({
                    statusCode: 404,
                    event: "error",
                    message: "Unsupported model. Currently only 'openai' is supported."
                  })
                );
              }
            }
          }
      }
    } catch (error) {
      console.error("Error in WebSocket loop:", error);
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            event: "error",
            message:
              "Some Issue Occurred in Processing your Request. Please try again",
          }),
        );
      }
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

      const response = await this.gptAssistantsClient.chat.completions.create({
        model: "sparrow",
        messages: messages,
        temperature: 0.7,
        max_tokens: this.maxTokens,
      });

      const result =
        response.choices[response.choices.length - 1].message.content.trim();
      return result;
    } catch (error) {
      console.error("Error processing specificError:", error);
      throw new BadRequestException(
        "An error occurred while processing the request.",
      );
    }
  }


  public async promptGeneration(data: ChatBotPayload): Promise<string> {
    try {
      const { userInput, authKey, model, modelVersion } = data;

      const promptInstruction =
        "You're an assistant that helps create well-structured prompts from user text. You are provided with user input and must generate a clean, optimized prompt. Return only the generated prompt—no explanations or additional output.";

      const userInstructions = 
        `You're an assistant that helps create well-structured prompts from user text. You are provided with user input and must generate a clean, optimized prompt. Return only the generated prompt—no explanations or additional output. This is the user text ${userInput}`

      switch (model) {
        case Models.OpenAI: {
          const openai = new OpenAI({ apiKey: authKey });

          // Special handling for o1-mini
          if (modelVersion === OpenAIModelVersion.GPT_o1_Mini) {
            const completion = await openai.chat.completions.create({
              messages: [
                {
                  role: "user",
                  content: userInstructions
                }
              ],
              model: modelVersion
            });

            const result = completion.choices[0].message.content;
            return result;
          }

          const completion = await openai.chat.completions.create({
            messages: [
              { role: "system", content: promptInstruction },
              { role: "user", content: userInput }
            ],
            model: modelVersion
          });

          const result = completion.choices[0].message.content;
          return result;
        }

        case Models.Google: {
          const genAI = await initializeGenAI(authKey);
          const response = await genAI.models.generateContent({
            model: modelVersion,
            contents: userInstructions
          });

          const result = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          return result;
        }

        case Models.Anthropic: {
          const anthropic = new Anthropic({ apiKey: authKey });
          const msg = await anthropic.messages.create({
            model: modelVersion,
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: userInstructions
              }
            ]
          });

          const result = msg.content
            .map((block) => ('text' in block ? block.text : ''))
            .join('');
          
          return result;
        }

        case Models.DeepSeek: {
          const deepseek = new OpenAI({
            baseURL: this.deepseekurl,
            apiKey: authKey
          });

          const completion = await deepseek.chat.completions.create({
            messages: [
              { role: "system", content: promptInstruction },
              { role: "user", content: userInput }
            ],
            model: modelVersion
          });

          const result = completion.choices[0].message.content;
          return result;
        }

        default:
          throw new BadRequestException("Unsupported model type.");
      }
    } catch (error) {
      console.error("Error processing prompt generation:", error);
      throw new BadRequestException("An error occurred while processing the request.");
    }
  }
}
