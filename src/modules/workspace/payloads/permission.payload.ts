import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@src/modules/common/enum/roles.enum";
import { IsEnum, IsMongoId, IsNotEmpty, IsString } from "class-validator";

export class CreatePermissionDto {
  @ApiProperty()
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @ApiProperty()
  @IsEnum(Role)
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty()
  @IsMongoId()
  @IsNotEmpty()
  workspaceId: string;
}

export class PermissionDto {
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;

  @IsMongoId()
  @IsNotEmpty()
  userId: string;
}

export class PermissionForUserDto {
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;

  @IsMongoId()
  @IsNotEmpty()
  id: string;
}

export class UpdatePermissionDto {
  @ApiProperty({ enum: ["admin", "writer", "reader"] })
  @IsEnum(Role)
  @IsString()
  @IsNotEmpty()
  role: string;
}
