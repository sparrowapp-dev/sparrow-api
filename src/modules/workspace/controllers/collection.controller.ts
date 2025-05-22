import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UseGuards,
  UseInterceptors,
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
  UpdateMockCollectionStatusDto,
} from "../payloads/collection.payload";
import { FastifyReply } from "fastify";
import { CollectionService } from "../services/collection.service";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { HttpStatusCode } from "@src/modules/common/enum/httpStatusCode.enum";
import { WorkspaceService } from "../services/workspace.service";
import {
  BranchChangeDto,
  CollectionGraphQLDto,
  CollectionRequestDto,
  CollectionRequestResponseDto,
  CollectionSocketIODto,
  CollectionWebSocketDto,
  FolderPayload,
  UpdateCollectionRequestResponseDto,
} from "../payloads/collectionRequest.payload";
import { CollectionRequestService } from "../services/collection-request.service";
import { ContextService } from "@src/modules/common/services/context.service";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import {
  FileInterceptor,
  MemoryStorageFile,
  UploadedFile,
} from "@blazity/nest-file-fastify";
import { CollectionTypeEnum } from "@src/modules/common/models/collection.model";

@ApiBearerAuth()
@ApiTags("collection")
@Controller("api/collection")
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
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 201, description: "Collection Created Successfully" })
  @ApiResponse({ status: 400, description: "Create Collection Failed" })
  async createCollection(
    @Body() createCollectionDto: Partial<CreateCollectionDto>,
    @Res() res: FastifyReply,
  ) {
    const workspaceId = createCollectionDto.workspaceId;
    const data =
      await this.collectionService.createCollection(createCollectionDto);
    if (createCollectionDto?.collectionType === CollectionTypeEnum.MOCK) {
      await this.collectionService.updateMockCollectionUrl(
        data.insertedId.toString(),
      );
    }
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
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: "Fetch Collection Request Received",
  })
  @ApiResponse({ status: 400, description: "Fetch Collection Request Failed" })
  async getCollection(
    @Param("workspaceId") workspaceId: string,
    @Res() res: FastifyReply,
  ) {
    const collection =
      await this.collectionService.getAllCollections(workspaceId);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get("public/:workspaceId")
  @ApiOperation({
    summary: "Get All Public Collections",
    description: "This will get all collection of a public workspace",
  })
  @ApiResponse({
    status: 200,
    description: "Fetch Collection Request Received",
  })
  @ApiResponse({ status: 400, description: "Fetch Collection Request Failed" })
  async getPublicWorkspaceCollection(
    @Param("workspaceId") workspaceId: string,
    @Res() res: FastifyReply,
  ) {
    const collection =
      await this.collectionService.getAllPublicWorkspaceCollections(
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
  @UseGuards(JwtAuthGuard)
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

  @Patch(":collectionId/workspace/:workspaceId/mock-status")
  @ApiOperation({
    summary: "Update Mock Collections State",
    description: "This will update a mock collection running status",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: "Mock Collection Updated Successfully",
  })
  @ApiResponse({ status: 400, description: "Failed to Update Mock Collection" })
  async updateMockCollectionState(
    @Param("collectionId") collectionId: string,
    @Param("workspaceId") workspaceId: string,
    @Body() updateCollectionDto: Partial<UpdateMockCollectionStatusDto>,
    @Res() res: FastifyReply,
  ) {
    await this.collectionService.updateMockCollectionRunningStatus(
      workspaceId,
      collectionId,
      updateCollectionDto.isMockCollectionRunning,
    );

    const collection = await this.collectionService.getCollection(collectionId);
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
    const noOfRequests =
      await this.collectionRequestService.getNoOfRequest(collectionId);
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
    const noOfRequests =
      await this.collectionRequestService.getNoOfRequest(collectionId);
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "Websocket Updated Successfully" })
  @ApiResponse({ status: 400, description: "Failed to Update a websocket" })
  async addWebSocket(
    @Body() websocketDto: Partial<CollectionWebSocketDto>,
    @Res() res: FastifyReply,
  ) {
    const websocketObj =
      await this.collectionRequestService.addWebSocket(websocketDto);
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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

  /**
   * Imports a Postman collection from a v2.1 collection JSON file.
   *
   * @param workspaceId - The ID of the workspace where the collection will be imported.
   * @param res - The Fastify reply object used to send responses.
   * @param file - The uploaded file containing the Postman collection JSON.
   *
   * @returns - A promise that resolves to the Fastify reply object
   *                                    with the import result.
   *
   * @throws If the JSON parsing fails or the collection import fails, an error will be thrown.
   */
  @Post(":workspaceId/importPostmanCollection")
  @ApiOperation({
    summary: "Import a collection From A Postman v2.1 collection JSON",
    description: "You can import a collection that is exported from postman",
  })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  @ApiResponse({
    status: 201,
    description: "Postman collection imported successfully",
  })
  @ApiResponse({ status: 400, description: "Failed to Import Collection" })
  async importPostmanCollection(
    @Param("workspaceId") workspaceId: string,
    @Res() res: FastifyReply,
    @UploadedFile()
    file: MemoryStorageFile,
  ) {
    const dataBuffer = file.buffer;
    const dataString = dataBuffer.toString("utf8");
    const dataObj = JSON.parse(dataString);
    const collection = await this.collectionService.importPostmanCollection(
      dataObj,
      workspaceId,
    );
    const responseData = new ApiResponseService(
      "Postman Collection Imported",
      HttpStatusCode.OK,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to add a new Socket.IO instance. This can be either an individual
   * Socket.IO instance or a folder-based Socket.IO, and it will be stored in the collection.
   *
   * @param socketioDto The DTO containing the details of the socketio to be added.
   * @param res The response object.
   * @returns The response containing the status and the added socketio object.
   */
  @Post("socketio")
  @ApiOperation({
    summary: "Add a Socket.IO",
    description:
      "This will add a socketio which will be individual socketio or folder based socketio in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "Socket.IO Updated Successfully" })
  @ApiResponse({ status: 400, description: "Failed to Update a socketio" })
  async addSocketIO(
    @Body() socketioDto: Partial<CollectionSocketIODto>,
    @Res() res: FastifyReply,
  ) {
    const socketioObj =
      await this.collectionRequestService.addSocketIO(socketioDto);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      socketioObj,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to update an existing Socket.IO instance in the collection.
   * This can be used for both individual and folder-based Socket.IO instances.
   *
   * @param socketioId The ID of the socketio to be updated.
   * @param socketioDto The DTO containing the updated details of the socketio.
   * @param res The response object.
   * @returns The response containing the status and the updated socketio object.
   */
  @Put("socketio/:socketioId")
  @ApiOperation({
    summary: "Update a Socket.IO",
    description:
      "This will update a socketio which will be individual socketio or folder based socketio in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "Socket.IO saved Successfully" })
  @ApiResponse({ status: 400, description: "Failed to save socketio" })
  async updateSocketIO(
    @Param("socketioId") socketioId: string,
    @Body() socketioDto: Partial<CollectionSocketIODto>,
    @Res() res: FastifyReply,
  ) {
    const socketio = await this.collectionRequestService.updateSocketIO(
      socketioId,
      socketioDto,
    );

    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      socketio,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to delete a specific Socket.IO instance from a collection.
   * Supports both individual and folder-based Socket.IO deletions.
   *
   * @param socketioId The ID of the socketio to be deleted.
   * @param socketioDto The DTO containing the details of the socketio to be deleted.
   * @param res The response object.
   * @returns The response containing the status and the updated collection.
   */
  @Delete("socketio/:socketioId")
  @ApiOperation({
    summary: "Delete a Socket.IO",
    description:
      "This will delete a socketio which will be individual socketio or folder based socketio in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "Socket.IO Deleted Successfully" })
  @ApiResponse({ status: 400, description: "Failed to delete socketio" })
  async deleteSocketIO(
    @Param("socketioId") socketioId: string,
    @Body() socketioDto: Partial<CollectionSocketIODto>,
    @Res() res: FastifyReply,
  ) {
    await this.collectionRequestService.deleteSocketIO(socketioId, socketioDto);
    const collection = await this.collectionService.getCollection(
      socketioDto.collectionId,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to add a new GraphQL instance. This can be either an individual
   * GraphQL instance or a folder-based GraphQL, and it will be stored in the collection.
   *
   * @param graphqlDto The DTO containing the details of the GraphQL to be added.
   * @param res The response object.
   * @returns The response containing the status and the added GraphQL object.
   */
  @Post("graphql")
  @ApiOperation({
    summary: "Add a GraphQL",
    description:
      "This will add a GraphQL which will be individual GraphQL or folder based GraphQL in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "GraphQL Updated Successfully" })
  @ApiResponse({ status: 400, description: "Failed to Update a GraphQL" })
  async addGraphQL(
    @Body() graphqlDto: Partial<CollectionGraphQLDto>,
    @Res() res: FastifyReply,
  ) {
    const graphqlObj =
      await this.collectionRequestService.addGraphQL(graphqlDto);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      graphqlObj,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to update an existing GraphQL instance in the collection.
   * This can be used for both individual and folder-based GraphQL instances.
   *
   * @param graphqlId The ID of the GraphQL to be updated.
   * @param graphqlDto The DTO containing the updated details of the GraphQL.
   * @param res The response object.
   * @returns The response containing the status and the updated GraphQL object.
   */
  @Put("graphql/:graphqlId")
  @ApiOperation({
    summary: "Update a GraphQL",
    description:
      "This will update a GraphQL which will be individual GraphQL or folder based GraphQL in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "GraphQL saved Successfully" })
  @ApiResponse({ status: 400, description: "Failed to save GraphQL" })
  async updateGraphQL(
    @Param("graphqlId") graphqlId: string,
    @Body() graphqlDto: Partial<CollectionGraphQLDto>,
    @Res() res: FastifyReply,
  ) {
    const graphql = await this.collectionRequestService.updateGraphQL(
      graphqlId,
      graphqlDto,
    );

    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      graphql,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to delete a specific GraphQL instance from a collection.
   * Supports both individual and folder-based GraphQL deletions.
   *
   * @param graphqlId The ID of the GraphQL to be deleted.
   * @param graphqlDto The DTO containing the details of the GraphQL to be deleted.
   * @param res The response object.
   * @returns The response containing the status and the updated collection.
   */
  @Delete("graphql/:graphqlId")
  @ApiOperation({
    summary: "Delete a GraphQL",
    description:
      "This will delete a GraphQL which will be individual GraphQL or folder based GraphQL in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "GraphQL Deleted Successfully" })
  @ApiResponse({ status: 400, description: "Failed to delete GraphQL" })
  async deleteGraphQL(
    @Param("graphqlId") graphqlId: string,
    @Body() graphqlDto: Partial<CollectionGraphQLDto>,
    @Res() res: FastifyReply,
  ) {
    await this.collectionRequestService.deleteGraphQL(graphqlId, graphqlDto);
    const collection = await this.collectionService.getCollection(
      graphqlDto.collectionId,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to add a response to a request in the collection.
   *
   * @param requestResponseDto The request response data.
   * @param res The Fastify response object.
   * @returns The response object with status and data.
   */
  @Post("response")
  @ApiOperation({
    summary: "Add A Response",
    description: "This will add a response inside request in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "Response Added Successfully" })
  @ApiResponse({ status: 400, description: "Failed to add a response" })
  async addRequestResponse(
    @Body() requestResponseDto: Partial<CollectionRequestResponseDto>,
    @Res() res: FastifyReply,
  ) {
    const requestResponseObj =
      await this.collectionRequestService.addRequestResponse(
        requestResponseDto,
      );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      requestResponseObj,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to update a response inside a request in the collection.
   *
   * @param responseId The ID of the response to update.
   * @param requestResponseDto The updated request response data.
   * @param res The Fastify response object.
   * @returns The response object with status and data.
   */
  @Patch("response/:responseId")
  @ApiOperation({
    summary: "Update a response",
    description: "This will update a response inside a request in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "Response saved Successfully" })
  @ApiResponse({ status: 400, description: "Failed to save response" })
  async updateRequestResponse(
    @Param("responseId") responseId: string,
    @Body() requestResponseDto: Partial<UpdateCollectionRequestResponseDto>,
    @Res() res: FastifyReply,
  ) {
    const requestResponse =
      await this.collectionRequestService.updateRequestResponse(
        responseId,
        requestResponseDto,
      );

    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      requestResponse,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to delete a response inside a request in the collection.
   *
   * @param responseId The ID of the response to delete.
   * @param requestResponseDto The request response data, including collection ID.
   * @param res The Fastify response object.
   * @returns The response object with status and updated collection data.
   */
  @Delete("response/:responseId")
  @ApiOperation({
    summary: "Delete a Response",
    description: "This will delete a Response inside a Request in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "Response Deleted Successfully" })
  @ApiResponse({ status: 400, description: "Failed to delete Response" })
  async deleteRequestResponse(
    @Param("responseId") responseId: string,
    @Body() requestResponseDto: Partial<CollectionRequestResponseDto>,
    @Res() res: FastifyReply,
  ) {
    await this.collectionRequestService.deleteRequestResponse(
      responseId,
      requestResponseDto,
    );
    const collection = await this.collectionService.getCollection(
      requestResponseDto.collectionId,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post("mock-request")
  @ApiOperation({
    summary: "Add A Mock Request",
    description:
      "This will add a mock request which will be individual request or folder based request in mock collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "Mock Request Added Successfully" })
  @ApiResponse({ status: 400, description: "Failed to add a mock request" })
  async addMockRequest(
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
    const noOfRequests =
      await this.collectionRequestService.getNoOfRequest(collectionId);
    const requestObj = await this.collectionRequestService.addMockRequest(
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

  @Put("mock-request/:requestId")
  @ApiOperation({
    summary: "Update A Mock Request",
    description:
      "This will update a mock request which will be individual request or folder based request in mock collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "Mock Request saved Successfully" })
  @ApiResponse({ status: 400, description: "Failed to save mock request" })
  async updateMockRequest(
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
    const request = await this.collectionRequestService.updateMockRequest(
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

  @Delete("mock-request/:requestId")
  @ApiOperation({
    summary: "Delete A Mock Request",
    description:
      "This will delete a mock request which will be individual request or folder based request in mock collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: "Mock Request Deleted Successfully",
  })
  @ApiResponse({ status: 400, description: "Failed to delete mock request" })
  async deleteMockRequest(
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
    const noOfRequests =
      await this.collectionRequestService.getNoOfRequest(collectionId);
    await this.collectionRequestService.deleteMockRequest(
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
}
