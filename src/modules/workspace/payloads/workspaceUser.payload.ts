import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@src/modules/common/enum/roles.enum";
import { IsString } from "class-validator";

export class AddWorkspaceUserDto {
  @ApiProperty({
    example: Role.ADMIN,
  })
  @IsString()
  role: string;
}
