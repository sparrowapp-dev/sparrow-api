export enum AiService {
  SparrowAI = "sparrow-ai",
  LlmEvaluation = "llm-evaluation"
}

export enum Models {
  Anthropic = "anthropic",
  Google = "google",
  OpenAI = "openai",
  DeepSeek = "deepseek",
  GPT = "gpt"           // For AzureOpenai
}

export enum ClaudeModelVersion {
    Claude_3_Opus = "claude-3-opus-20240229",
    Claude_3_Sonnet = "claude-3-5-sonnet-20240620", // Claude Sonnet 3 is Claude 3.5 Sonnet (Old)
    Claude_3_Haiku = "claude-3-haiku-20240307",
    Claude_3_5_Sonnet = "claude-3-5-sonnet-20241022",
    Claude_3_5_Haiku = "claude-3-5-haiku-20241022"
}

export enum GoogleModelVersion {
    Gemini_1_5_Flash =  "gemini-1.5-flash",
    Gemini_1_5_Flash_8b= "gemini-1.5-flash-8b",
    Gemini_1_5_Pro = "gemini-1.5-pro",
    Gemini_2_0_Flash = "gemini-2.0-flash"
}

export enum OpenAIModelVersion {
    GPT_4o = "gpt-4o",
    GPT_4o_Mini = "gpt-4o-mini",
    GPT_4_5_Preview = "gpt-4.5-preview",
    GPT_4_Turbo = "gpt-4-turbo",
    GPT_4 = "gpt-4",
    GPT_4_1 = "gpt-4.1",
    GPT_o1 = "o1",
    GPT_o1_Mini = "o1-mini",
    GPT_o3_Mini = "o3-mini",
    GPT_3_5_Turbo = "gpt-3.5-turbo"
}

export enum DeepSeepModelVersion {
    DeepSeek_R1 = "deepseek-reasoner",
    DeepSeek_V3 = "deepseek-chat"
}

export enum Roles {
  system = "system",
  user = "user",
  assistant = "assistant",
  model = "model"
}