import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class UserConversationModel {

  @IsString()
  @IsOptional()
  message?: string;


  @IsString()
  @IsOptional()
  messageId?: string;


  @IsString()
  @IsOptional()
  type?: string;


  @IsBoolean()
  @IsOptional()
  @ApiProperty({ example: true })
  status?: boolean;


  @IsString()
  @IsOptional()
  modelProvider?: string;


  @IsString()
  @IsOptional()
  modelVariant?: string;


  @IsNumber()
  @IsOptional()
  statusCode?: number;


  @IsNumber()
  @IsOptional()
  inputTokens?: number;


  @IsNumber()
  @IsOptional()
  outputTokens?: number;


  @IsNumber()
  @IsOptional()
  totalTokens?: number;


  @IsNumber()
  @IsOptional()
  time?: number;
}

export class ConfigurationModel {
  @IsBoolean()
  @IsOptional()  streamResponse?: boolean;

  @IsBoolean()
  @IsOptional()  jsonResponse?: boolean;

  @IsNumber()
  @IsOptional()  temperature?: number;

  @IsNumber()
  @IsOptional()  presencePenalty?: number;

  @IsNumber()
  @IsOptional()  frequencyPenalty?: number;

  @IsNumber()
  @IsOptional()  maxTokens?: number;
}

export class VariableItem {

  @IsString()
  @ApiProperty({ example: "api_name" })
  key: string;

  @ApiProperty({ example: "getuserdata" })
  value: any;
}

export class ConversationModel {

  @IsString()
  @IsOptional()
  id?: string;


  @IsString()
  @IsOptional()
  systemPrompt?: string;


  @IsString()
  @IsOptional()
  title?: string;


  @IsNumber()
  @IsOptional()
  inputTokens?: number;


  @IsNumber()
  @IsOptional()
  outputTokens?: number;


  @IsDateString()
  @IsOptional()
  date?: string;


  @IsString()
  @IsOptional()
  time?: string;


  @IsString()
  @IsOptional()
  authoredBy?: string;


  @IsString()
  @IsOptional()
  fileId?: [];


  @IsString()
  @IsOptional()
  fileURL?: [];


  @IsOptional()
  @Type(() => VariableItem)
  @ApiProperty({
    isArray: true,
    type: VariableItem,
    example: [
      { key: "api_name", value: "getuserdata" },
      { key: "user_id", value: "user_123" },
      { key: "language", value: "en" }
    ]
  })
  variables?: VariableItem[];


  @IsOptional()
  @ApiProperty({ type: ConfigurationModel })
  @Type(() => ConfigurationModel)
  configurations?: ConfigurationModel;
  


  @IsOptional()
  @ApiProperty({ type: [UserConversationModel] })
  @Type(() => UserConversationModel)
  conversation?: UserConversationModel[];

}

export class LlmConversation {


  @IsString()
  @ApiProperty({ example: "openai or gemini" })
  provider?: string;


  @IsOptional()
  @IsString()
  @ApiProperty({ example: "openai-conve-123" })
  id?: string;

  
  @IsString()
  @ApiProperty({ example: "sk-openai-abc-123" })
  apiKey?: string;

  @IsOptional()
  @ApiProperty({ type: () => ConversationModel })
  @Type(() => ConversationModel)
  data?: ConversationModel;

}