import { TeamDto } from "@src/modules/common/models/team.model";
import { UserWorkspaceDto } from "@src/modules/common/models/user.model";
import { ObjectId } from "mongodb";

export type DecodedUserObject = {
  _id: ObjectId;
  email: string;
  name: string;
  role: string;
  teams?: TeamDto[];
  workspaces?: UserWorkspaceDto[];
  emailVerificationCodeTimeStamp?: Date;
  lastActive?: Date;
  isSuperAdmin?: boolean;
};

export interface ExtendedFastifyRequest extends FastifyRequest {
  user: DecodedUserObject;
}
