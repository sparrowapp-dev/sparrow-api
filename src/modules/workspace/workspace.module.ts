import { Module } from "@nestjs/common";

// ---- Contollers
import { WorkSpaceController } from "./controllers/workspace.controller";
import { collectionController } from "./controllers/collection.controller";
import { EnvironmentController } from "./controllers/environment.controller";
import { FeatureController } from "./controllers/feature.controller";
import { FeedbackController } from "./controllers/feedback.controller";
import { UpdatesController } from "./controllers/updates.controller";

// ---- Repository
import { WorkspaceRepository } from "./repositories/workspace.repository";
import { CollectionRepository } from "./repositories/collection.repository";
import { EnvironmentRepository } from "./repositories/environment.repository";
import { FeatureRepository } from "./repositories/feature.repository";
import { FeedbackRepository } from "./repositories/feedback.repository";
import { BranchRepository } from "./repositories/branch.repository";
import { UpdatesRepository } from "./repositories/updates.repository";

// ---- Module
import { IdentityModule } from "../identity/identity.module";

// ---- Handler
import { WorkspaceHandler } from "./handlers/workspace.handler";
import { AddUserHandler } from "./handlers/addUser.handler";
import { RemoveUserHandler } from "./handlers/removeUser.handler";
import { PromoteAdminHandler } from "./handlers/promoteAdmin.handlers";
import { DemoteAdminHandler } from "./handlers/demoteAdmin.handlers";
import { UpdatesHandler } from "./handlers/updates.handler";

// ---- Services
import { CollectionService } from "./services/collection.service";
import { CollectionRequestService } from "./services/collection-request.service";
import { EnvironmentService } from "./services/environment.service";
import { WorkspaceService } from "./services/workspace.service";
import { WorkspaceUserService } from "./services/workspace-user.service";
import { FeatureService } from "./services/feature.service";
import { BranchService } from "./services/branch.service";
import { FeedbackService } from "./services/feedback.service";
import { UpdatesService } from "./services/updates.service";

/**
 * Workspace Module provides all necessary services, handlers, repositories,
 * and controllers related to the workspace functionality.
 */
@Module({
  imports: [IdentityModule],
  providers: [
    WorkspaceService,
    WorkspaceRepository,
    WorkspaceUserService,
    WorkspaceHandler,
    AddUserHandler,
    RemoveUserHandler,
    PromoteAdminHandler,
    DemoteAdminHandler,
    CollectionRepository,
    CollectionService,
    CollectionRequestService,
    EnvironmentService,
    EnvironmentRepository,
    FeatureService,
    FeatureRepository,
    BranchService,
    BranchRepository,
    FeedbackService,
    FeedbackRepository,
    UpdatesService,
    UpdatesRepository,
    UpdatesHandler,
  ],
  exports: [
    CollectionService,
    CollectionRepository,
    WorkspaceRepository,
    EnvironmentService,
    EnvironmentRepository,
    FeatureService,
    FeatureRepository,
    BranchService,
    BranchRepository,
    FeedbackService,
    FeedbackRepository,
    UpdatesService,
    UpdatesRepository,
  ],
  controllers: [
    WorkSpaceController,
    collectionController,
    EnvironmentController,
    FeatureController,
    FeedbackController,
    UpdatesController,
  ],
})
export class WorkspaceModule {}
