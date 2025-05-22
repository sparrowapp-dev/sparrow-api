import { Module } from "@nestjs/common";

// ---- Module
import { IdentityModule } from "../identity/identity.module";

import { AdminHubsController } from "./controllers/user-admin.hubs.controller";
import { AdminHubsRepository } from "./repositories/user-admin.hubs.repository";
import { AdminHubsService } from "./services/user-admin.hubs.service";
import { AdminWorkspaceRepository } from "./repositories/user-admin.workspace.repository";
import { AdminWorkspaceService } from "./services/user-admin.workspace.service";
import { AdminWorkspaceController } from "./controllers/user-admin.workspace.controller";
import { WorkspaceService } from "../workspace/services/workspace.service";
import { WorkspaceModule } from "../workspace/workspace.module";
import { AdminAuthController } from "./controllers/user-admin.auth.controller";
import { AdminAuthRepository } from "./repositories/user-admin.auth.repository";
import { AdminAuthService } from "./services/user-admin.auth.service";
import { JwtService } from "@nestjs/jwt";
import { TeamService } from "../identity/services/team.service";
import { AdminMembersService } from "./services/user-admin.members.service";
import { AdminMembersController } from "./controllers/user-admin.members.controller";
import { AdminMembersRepository } from "./repositories/user.admin.members.repository";

/**
 * Admin Module provides all necessary services, handlers, repositories,
 * and controllers related to the admin dashboard functionality.
 */
@Module({
  imports: [IdentityModule, WorkspaceModule],
  providers: [
    WorkspaceService,
    JwtService,
    AdminHubsService,
    AdminHubsRepository,
    AdminWorkspaceService,
    AdminWorkspaceRepository,
    AdminAuthRepository,
    AdminAuthService,
    TeamService,
    AdminMembersRepository,
    AdminMembersService,
  ],
  exports: [],
  controllers: [
    AdminHubsController,
    AdminWorkspaceController,
    AdminAuthController,
    AdminMembersController,
  ],
})
export class UserAdminModule {}
