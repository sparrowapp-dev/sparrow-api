import { Module } from "@nestjs/common";
import { WorkspaceService } from "./services/workspace.service";
import { WorkSpaceController } from "./controllers/workspace.controller";
import { WorkspaceRepository } from "./repositories/workspace.repository";
import { IdentityModule } from "../identity/identity.module";
import { PermissionService } from "./services/permission.service";
import { PermissionRepository } from "./repositories/permission.repository";
import { PermissionController } from "./controllers/permission.controller";
import { WorkspaceHandler } from "./handlers/workspace.handler";
import { PermissionHandler } from "./handlers/permission.handler";
import { OwnerPermissionHandler } from "./handlers/ownerPermisson.handler";
import { RemovePermissionHandler } from "./handlers/removePermission.handler";
import { CollectionService } from "./services/collection.service";
import { CollectionRepository } from "./repositories/collection.repository";
import { collectionController } from "./controllers/collection.controller";
import { CollectionRequestService } from "./services/collection-request.service";
import { EnvironmentService } from "./services/environment.service";
import { EnvironmentRepository } from "./repositories/environment.repository";
import { EnvironmentController } from "./controllers/environment.controller";
@Module({
  imports: [IdentityModule],
  providers: [
    WorkspaceService,
    WorkspaceRepository,
    PermissionService,
    PermissionRepository,
    WorkspaceHandler,
    PermissionHandler,
    OwnerPermissionHandler,
    RemovePermissionHandler,
    CollectionRepository,
    CollectionService,
    CollectionRequestService,
    EnvironmentService,
    EnvironmentRepository,
  ],
  exports: [
    CollectionService,
    CollectionRepository,
    WorkspaceRepository,
    EnvironmentService,
    EnvironmentRepository,
  ],
  controllers: [
    WorkSpaceController,
    PermissionController,
    collectionController,
    EnvironmentController,
  ],
})
export class WorkspaceModule {}
