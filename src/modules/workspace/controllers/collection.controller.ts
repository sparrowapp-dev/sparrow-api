import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  CreateCollectionDto,
  UpdateCollectionDto,
} from "../payloads/collection.payload";
import { FastifyReply } from "fastify";
import { CollectionService } from "../services/collection.service";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { WorkspaceService } from "../services/workspace.service";
import {
  BranchChangeDto,
  CollectionRequestDto,
  CollectionWebSocketDto,
  FolderPayload,
} from "../payloads/collectionRequest.payload";
import { CollectionRequestService } from "../services/collection-request.service";
import { ContextService } from "@src/modules/common/services/context.service";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";

@ApiBearerAuth()
@ApiTags("collection")
@Controller("api/collection")
@UseGuards(JwtAuthGuard)
export class collectionController {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly workSpaceService: WorkspaceService,
    private readonly collectionRequestService: CollectionRequestService,
    private readonly contextService: ContextService,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create A Collection",
    description:
      "This will create a collection and add this collection in user's workspace",
  })
  @ApiResponse({ status: 201, description: "Collection Created Successfully" })
  @ApiResponse({ status: 400, description: "Create Collection Failed" })
  async createCollection(
    @Body() createCollectionDto: Partial<CreateCollectionDto>,
    @Res() res: FastifyReply,
  ) {
    const workspaceId = createCollectionDto.workspaceId;
    const data = await this.collectionService.createCollection(
      createCollectionDto,
    );
    const collection = await this.collectionService.getCollection(
      data.insertedId.toString(),
    );
    await this.workSpaceService.addCollectionInWorkSpace(workspaceId, {
      id: collection._id,
      name: createCollectionDto.name,
    });
    const responseData = new ApiResponseService(
      "Collection Created",
      HttpStatusCode.CREATED,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get(":workspaceId")
  @ApiOperation({
    summary: "Get All Collections",
    description: "This will get all collection of a workspace",
  })
  @ApiResponse({
    status: 200,
    description: "Fetch Collection Request Received",
  })
  @ApiResponse({ status: 400, description: "Fetch Collection Request Failed" })
  async getCollection(
    @Param("workspaceId") workspaceId: string,
    @Res() res: FastifyReply,
  ) {
    const collection = await this.collectionService.getAllCollections(
      workspaceId,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Put(":collectionId/workspace/:workspaceId")
  @ApiOperation({
    summary: "Update A  Collections",
    description: "This will update a collection ",
  })
  @ApiResponse({ status: 200, description: "Collection Updated Successfully" })
  @ApiResponse({ status: 400, description: "Update Collection Failed" })
  async updateCollection(
    @Param("collectionId") collectionId: string,
    @Param("workspaceId") workspaceId: string,
    @Body() updateCollectionDto: Partial<UpdateCollectionDto>,
    @Res() res: FastifyReply,
  ) {
    await this.collectionService.updateCollection(
      collectionId,
      updateCollectionDto,
      workspaceId,
    );

    const collection = await this.collectionService.getCollection(collectionId);
    await this.workSpaceService.updateCollectionInWorkSpace(
      workspaceId,
      collectionId,
      updateCollectionDto.name,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
  @Delete(":collectionId/workspace/:workspaceId")
  @ApiOperation({
    summary: "Delete a Collections",
    description: "This will delete a collection",
  })
  @ApiResponse({ status: 201, description: "Removed Collection Successfully" })
  @ApiResponse({ status: 400, description: "Failed to remove Collection" })
  async deleteCollection(
    @Param("collectionId") collectionId: string,
    @Param("workspaceId") workspaceId: string,
    @Res() res: FastifyReply,
  ) {
    const collection = await this.collectionService.deleteCollection(
      collectionId,
      workspaceId,
    );

    await this.workSpaceService.deleteCollectionInWorkSpace(
      workspaceId.toString(),
      collectionId,
    );
    const responseData = new ApiResponseService(
      "Collection Removed",
      HttpStatusCode.OK,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post(":collectionId/workspace/:workspaceId/folder")
  @ApiOperation({
    summary: "Add a Folder",
    description: "This will add a folder inside collection",
  })
  @ApiResponse({ status: 200, description: "Request saved Successfully" })
  @ApiResponse({ status: 400, description: "Failed to save request" })
  async addFolder(
    @Param("collectionId") collectionId: string,
    @Param("workspaceId") workspaceId: string,
    @Body() body: Partial<FolderPayload>,
    @Res() res: FastifyReply,
  ) {
    const newFolder = await this.collectionRequestService.addFolder({
      collectionId,
      workspaceId,
      ...body,
    });
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.CREATED,
      newFolder,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Put(":collectionId/workspace/:workspaceId/folder/:folderId")
  @ApiOperation({
    summary: "Update a Folder",
    description: "This will update a Folder from a Collection",
  })
  @ApiResponse({ status: 200, description: "Request saved Successfully" })
  @ApiResponse({ status: 400, description: "Failed to save request" })
  async updateFolder(
    @Param("collectionId") collectionId: string,
    @Param("workspaceId") workspaceId: string,
    @Param("folderId") folderId: string,
    @Body() body: Partial<FolderPayload>,
    @Res() res: FastifyReply,
  ) {
    const updatedfolder = await this.collectionRequestService.updateFolder({
      collectionId,
      workspaceId,
      folderId,
      ...body,
    });
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      updatedfolder,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Delete(":collectionId/workspace/:workspaceId/folder/:folderId")
  @ApiOperation({
    summary: "Delete a Folder",
    description: "This will delete a folder from a collection",
  })
  @ApiResponse({ status: 200, description: "Request saved Successfully" })
  @ApiResponse({ status: 400, description: "Failed to save request" })
  async deleteFolder(
    @Param("collectionId") collectionId: string,
    @Param("workspaceId") workspaceId: string,
    @Param("folderId") folderId: string,
    @Body() branchNameDto: Partial<BranchChangeDto>,
    @Res() res: FastifyReply,
  ) {
    const payload = {
      collectionId: collectionId,
      workspaceId: workspaceId,
      folderId: folderId,
      currentBranch: branchNameDto.branchName,
    };
    const response = await this.collectionRequestService.deleteFolder(payload);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      response,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("request")
  @ApiOperation({
    summary: "Add A Request",
    description:
      "This will add a request which will be individual request or  folder based request in collection",
  })
  @ApiResponse({ status: 200, description: "Request Updated Successfully" })
  @ApiResponse({ status: 400, description: "Failed to Update a request" })
  async addRequest(
    @Body() requestDto: Partial<CollectionRequestDto>,
    @Res() res: FastifyReply,
  ) {
    const collectionId = requestDto.collectionId;
    const workspaceId = requestDto.workspaceId;
    const user = await this.contextService.get("user");
    await this.workSpaceService.IsWorkspaceAdminOrEditor(
      requestDto.workspaceId,
    );
    await this.collectionRequestService.checkPermission(workspaceId, user._id);
    const noOfRequests = await this.collectionRequestService.getNoOfRequest(
      collectionId,
    );
    const requestObj = await this.collectionRequestService.addRequest(
      collectionId,
      requestDto,
      noOfRequests,
      user.name,
      requestDto?.folderId,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      requestObj,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Put("request/:requestId")
  @ApiOperation({
    summary: "Update A Request",
    description:
      "This will update a request which will be individual request or  folder based request in collection",
  })
  @ApiResponse({ status: 200, description: "Request saved Successfully" })
  @ApiResponse({ status: 400, description: "Failed to save request" })
  async updateRequest(
    @Param("requestId") requestId: string,
    @Body() requestDto: Partial<CollectionRequestDto>,
    @Res() res: FastifyReply,
  ) {
    const collectionId = requestDto.collectionId;
    const workspaceId = requestDto.workspaceId;
    await this.workSpaceService.IsWorkspaceAdminOrEditor(
      requestDto.workspaceId,
    );
    const user = await this.contextService.get("user");
    await this.collectionRequestService.checkPermission(workspaceId, user._id);
    const request = await this.collectionRequestService.updateRequest(
      collectionId,
      requestId,
      requestDto,
    );

    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      request,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Delete("request/:requestId")
  @ApiOperation({
    summary: "Delete A Request",
    description:
      "This will delete a request which will be individual request or  folder based request in collection",
  })
  @ApiResponse({ status: 200, description: "Request Deleted Successfully" })
  @ApiResponse({ status: 400, description: "Failed to delete request" })
  async deleteRequest(
    @Param("requestId") requestId: string,
    @Body() requestDto: Partial<CollectionRequestDto>,
    @Res() res: FastifyReply,
  ) {
    const collectionId = requestDto.collectionId;
    const workspaceId = requestDto.workspaceId;
    await this.workSpaceService.IsWorkspaceAdminOrEditor(
      requestDto.workspaceId,
    );
    const user = await this.contextService.get("user");
    await this.collectionRequestService.checkPermission(workspaceId, user._id);
    const noOfRequests = await this.collectionRequestService.getNoOfRequest(
      collectionId,
    );
    await this.collectionRequestService.deleteRequest(
      collectionId,
      requestId,
      noOfRequests,
      requestDto,
    );
    const collection = await this.collectionService.getCollection(collectionId);

    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post(":collectionId/branch")
  @ApiOperation({
    summary: "Get collection items as per the branch selected",
    description: "Switch branch to get collection of that branch",
  })
  @ApiResponse({ status: 201, description: "Branch switched Successfully" })
  @ApiResponse({ status: 400, description: "Failed to switch branch" })
  async switchCollectionBranch(
    @Param("collectionId") collectionId: string,
    @Body() branchChangeDto: BranchChangeDto,
    @Res() res: FastifyReply,
  ) {
    const branch = await this.collectionService.getBranchData(
      collectionId,
      branchChangeDto.branchName,
    );
    const responseData = new ApiResponseService(
      "Branch switched Successfully",
      HttpStatusCode.OK,
      branch,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * @description This method adds a websocket to the collection, either as an individual websocket or as part of a folder.
   * @param websocketDto The DTO containing the details of the websocket to be added.
   * @param res The response object.
   * @returns The response containing the status and the added websocket object.
   */
  @Post("websocket")
  @ApiOperation({
    summary: "Add a Websocket",
    description:
      "This will add a websocket which will be individual websocket or folder based websocket in collection",
  })
  @ApiResponse({ status: 200, description: "Websocket Updated Successfully" })
  @ApiResponse({ status: 400, description: "Failed to Update a websocket" })
  async addWebSocket(
    @Body() websocketDto: Partial<CollectionWebSocketDto>,
    @Res() res: FastifyReply,
  ) {
    const websocketObj = await this.collectionRequestService.addWebSocket(
      websocketDto,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      websocketObj,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * @description This method updates an existing websocket in the collection, either as an individual websocket or as part of a folder.
   * @param websocketId The ID of the websocket to be updated.
   * @param websocketDto The DTO containing the updated details of the websocket.
   * @param res The response object.
   * @returns The response containing the status and the updated websocket object.
   */
  @Put("websocket/:websocketId")
  @ApiOperation({
    summary: "Update a websocket",
    description:
      "This will update a websocket which will be individual websocket or folder based websocket in collection",
  })
  @ApiResponse({ status: 200, description: "Websocket saved Successfully" })
  @ApiResponse({ status: 400, description: "Failed to save websocket" })
  async updateWebSocket(
    @Param("websocketId") websocketId: string,
    @Body() websocketDto: Partial<CollectionWebSocketDto>,
    @Res() res: FastifyReply,
  ) {
    const websocket = await this.collectionRequestService.updateWebSocket(
      websocketId,
      websocketDto,
    );

    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      websocket,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * @description This method deletes a websocket from the collection, either as an individual websocket or as part of a folder.
   * @param websocketId The ID of the websocket to be deleted.
   * @param websocketDto The DTO containing the details of the websocket to be deleted.
   * @param res The response object.
   * @returns The response containing the status and the updated collection.
   */
  @Delete("websocket/:websocketId")
  @ApiOperation({
    summary: "Delete a Request",
    description:
      "This will delete a websocket which will be individual websocket or folder based websocket in collection",
  })
  @ApiResponse({ status: 200, description: "Websocket Deleted Successfully" })
  @ApiResponse({ status: 400, description: "Failed to delete websocket" })
  async deleteWebSocket(
    @Param("websocketId") websocketId: string,
    @Body() websocketDto: Partial<CollectionWebSocketDto>,
    @Res() res: FastifyReply,
  ) {
    await this.collectionRequestService.deleteWebSocket(
      websocketId,
      websocketDto,
    );
    const collection = await this.collectionService.getCollection(
      websocketDto.collectionId,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
