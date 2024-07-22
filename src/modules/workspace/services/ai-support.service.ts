import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AzureOpenAI } from "openai";

@Injectable()
export class AiSupportService {
  private client: any;
  private maxTokens: number;
  private apiModel: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get("ai.endpoint");
    const apiKey = this.configService.get("ai.apiKey");
    const deployment = this.configService.get("ai.deployment");
    const apiVersion = this.configService.get("ai.apiVersion");

    this.apiModel = this.configService.get("ai.apiModel");
    this.maxTokens = this.configService.get("ai.maxTokens");

    this.client = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion,
      deployment,
    });
  }

  /**
   * Generates text based on a given prompt.
   *
   * @param prompt - The prompt to generate ai response.
   * @returns A promise that resolves to an object containing an array of choices.
   */

  async generateText(prompt: string): Promise<{ choices: string[] }> {
    try {
      const result = await this.client.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: this.apiModel,
        max_tokens: this.maxTokens, // Added max_tokens parameter
      });
      return {
        choices: result.choices.map(
          (choice: { message: { content: string } }) => {
            return choice.message.content;
          },
        ),
      };
    } catch (e) {
      return e;
    }
  }
}
