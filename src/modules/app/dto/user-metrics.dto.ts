import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString, IsDate, IsOptional, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class UserMetricsSummaryDto {
  @ApiProperty({
    description: "Total number of unique users that have accessed the system",
    example: 150,
  })
  @IsNumber()
  totalUniqueUsers: number;

  @ApiProperty({
    description: "Number of currently active users (within last 30 minutes)",
    example: 25,
  })
  @IsNumber()
  activeUsers: number;

  @ApiProperty({
    description: "Current environment",
    example: "production",
  })
  @IsString()
  environment: string;

  @ApiProperty({
    description: "Timestamp when metrics were last updated",
    example: "2024-01-15T10:30:00Z",
  })
  @IsDate()
  @Type(() => Date)
  lastUpdated: Date;
}

export class UserRequestStatsDto {
  @ApiProperty({
    description: "User ID",
    example: "507f1f77bcf86cd799439011",
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: "Total number of requests made by this user",
    example: 45,
  })
  @IsNumber()
  totalRequests: number;

  @ApiProperty({
    description: "Timestamp of user's last activity",
    example: "2024-01-15T10:25:00Z",
  })
  @IsDate()
  @Type(() => Date)
  lastActivity: Date;
}

export class TopUsersQueryDto {
  @ApiProperty({
    description: "Number of top users to return",
    example: 10,
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;
}
