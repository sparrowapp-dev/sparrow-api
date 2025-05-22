import { ApiPropertyOptional } from "@nestjs/swagger";

export class HubWorkspaceQuerySwaggerDto {
  @ApiPropertyOptional({ required: true })
  hubId: string;

  @ApiPropertyOptional({ example: "1" })
  page?: string;

  @ApiPropertyOptional({ example: "10" })
  limit?: string;

  @ApiPropertyOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: ["name", "workspaceType", "createdAt", "updatedAt"],
  })
  sortBy?: "name" | "workspaceType" | "createdAt" | "updatedAt";

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  sortOrder?: "asc" | "desc";

  @ApiPropertyOptional({
    enum: ["PRIVATE", "PUBLIC"],
    description:
      "Filter workspaces by visibility type. Leave empty to include all.",
  })
  workspaceType?: "PRIVATE" | "PUBLIC";
}
