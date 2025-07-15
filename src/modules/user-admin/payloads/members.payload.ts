import { ApiProperty } from "@nestjs/swagger";

export class HubMembersQuerySwaggerDto {
  @ApiProperty({
    description: "Hub ID",
    required: true,
  })
  hubId: string;

  @ApiProperty({
    description: "Page number (starts at 1)",
    required: false,
    default: "1",
  })
  page: string;

  @ApiProperty({
    description: "Number of items per page",
    required: false,
    default: "10",
  })
  limit: string;

  @ApiProperty({
    description: "Search term to filter members by name or email",
    required: false,
  })
  search: string;
}

export class HubInvitesQuerySwaggerDto {
  @ApiProperty({
    description: "Hub ID",
    required: true,
  })
  hubId: string;

  @ApiProperty({
    description: "Page number (starts at 1)",
    required: false,
    default: "1",
  })
  page: string;

  @ApiProperty({
    description: "Number of items per page",
    required: false,
    default: "10",
  })
  limit: string;

  @ApiProperty({
    description: "Search term to filter invites by email",
    required: false,
  })
  search: string;
}
