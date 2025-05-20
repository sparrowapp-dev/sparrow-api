import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { Db } from "mongodb";

@Injectable()
export class LLMmodelMigration implements OnModuleInit {
  constructor(
    @Inject("DATABASE_CONNECTION") private readonly db: Db
  ) {}

  async onModuleInit(): Promise<void> {
    const collection = this.db.collection("llmmodels");

    // Insert OpenAI if not exists
    const openAiExists = await collection.findOne({ model: "OpenAI" });
    if (!openAiExists) {
      await collection.insertOne({
        model: "OpenAI",
        modelVersions: [
          { name: "gpt-4o", configuration: getOpenAIConfig() },
          { name: "gpt-4.1", configuration: getOpenAIConfig() },
          { name: "gpt-4.5-preview", configuration: getOpenAIConfig() },
          { name: "gpt-4o-mini", configuration: getOpenAIConfig() },
          { name: "gpt-o3-mini", configuration: getPartialConfig(["temperature", "presencePenalty", "frequencyPenalty"]) },
          { name: "gpt-o1", configuration: getPartialConfig(["streamResponse", "jsonResponse", "temperature", "presencePenalty", "frequencyPenalty"]) },
          { name: "gpt-o1-mini", configuration: getPartialConfig(["streamResponse", "jsonResponse", "temperature", "presencePenalty", "frequencyPenalty"]) },
          { name: "gpt-4-turbo", configuration: getOpenAIConfig() },
          { name: "gpt-4", configuration: getOpenAIConfig() },
          { name: "gpt-3.5-turbo", configuration: getOpenAIConfig() }
        ]
      });
      console.log("✅ OpenAI model with versions inserted.");
    } else {
      console.log("ℹ️ OpenAI model already exists. Skipping...");
    }

    // Insert Anthropic if not exists
    const anthropicExists = await collection.findOne({ model: "Anthropic" });
    if (!anthropicExists) {
      await collection.insertOne({
        model: "Anthropic",
        modelVersions: [
          { name: "claude-3-opus", configuration: getAnthropicConfig() },
          { name: "claude-3-sonnet", configuration: getAnthropicConfig() },
          { name: "claude-3-haiku", configuration: getAnthropicConfig() },
          { name: "claude-3.5-haiku", configuration: getAnthropicConfig() },
          { name: "claude-3.5-sonnet", configuration: getAnthropicConfig() }
        ]
      });
      console.log("✅ Anthropic model with versions inserted.");
    } else {
      console.log("ℹ️ Anthropic model already exists. Skipping...");
    }

    // Insert Google if not exists
    const googleExists = await collection.findOne({ model: "Google" });
    if (!googleExists) {
      await collection.insertOne({
        model: "Google",
        modelVersions: [
          { name: "gemini-1.5-flash", configuration: getGoogleConfig() },
          { name: "gemini-1.5-flash-8B", configuration: getGoogleConfig() },
          { name: "gemini-1.5-pro", configuration: getGoogleConfig() },
          { name: "gemini-2.0-flash", configuration: getGoogleConfig() },
        ]
      });
      console.log("✅ Google model with versions inserted.");
    } else {
      console.log("ℹ️ Google model already exists. Skipping...");
    }

    // Insert DeepSeek if not exists
    const deeSeekExist = await collection.findOne({ model: "DeepSeek" });
    if (!deeSeekExist) {
      await collection.insertOne({
        model: "DeepSeek",
        modelVersions: [
          { name: "deepseek-R1", configuration: getPartialConfig(["jsonResponse", "temperature", "presencePenalty", "frequencyPenalty"]) },
          { name: "deepseek-v3", configuration: getOpenAIConfig() },
        ]
      });
      console.log("✅ DeepSeek model with versions inserted.");
    } else {
      console.log("ℹ️ DeepSeek model already exists. Skipping...");
    }
  }
}

// Reusable config builders
function getOpenAIConfig() {
  return {
    streamResponse: false,
    jsonResponse: false,
    temperature: {
      minValue: 0,
      maxValue: 1,
      defaultValue: 0.5
    },
    presencePenalty: {
      minValue: 0,
      maxValue: 1,
      defaultValue: 0.5
    },
    frequencyPenalty: {
      minValue: 0,
      maxValue: 1,
      defaultValue: 0.5
    },
    maxTokens: {
      minValue: 1,
      maxValue: 4096,
      defaultValue: -1
    }
  };
}


function getGoogleConfig() {
  return {
    streamResponse: false,
    jsonResponse: false,
    temperature: {
      minValue: 0,
      maxValue: 1,
      defaultValue: 0.5
    },
    topP: {
      minValue: 0,
      maxValue: 1,
      defaultValue: 0.5
    },
    maxTokens: {
      minValue: 1,
      maxValue: 4096,
      defaultValue: -1
    }
  };
}


function getAnthropicConfig() {
  return {
    streamResponse: false,
    temperature: {
      minValue: 0,
      maxValue: 1,
      defaultValue: 0.5
    },
    topP: {
      minValue: 0,
      maxValue: 1,
      defaultValue: 0.5
    },
    maxTokens: {
      minValue: 1,
      maxValue: 4096,
      defaultValue: -1
    }
  };
}

function getPartialConfig(omitFields: (keyof ReturnType<typeof getOpenAIConfig>)[] = []) {
  const full = getOpenAIConfig();
  omitFields.forEach(field => {
    delete full[field];
  });
  return full;
}
