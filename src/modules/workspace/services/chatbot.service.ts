import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ChatbotService implements OnModuleInit {
  private client: any;
  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const { AzureOpenAI } = await import("openai");
    const endpoint = this.configService.get("chatbot.endpoint");
    const apiKey = this.configService.get("chatbot.apiKey");
    const deployment = this.configService.get("chatbot.deploymentId");
    const apiVersion = "2024-05-13";
    console.log(endpoint, apiKey, deployment, apiVersion);

    this.client = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion,
      deployment,
    });
  }

  async generateText(prompt: string): Promise<string> {
    let result;
    try {
      result = await this.client.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "",
      });
    } catch (e) {
      return e;
    }
    return result;
  }
}
