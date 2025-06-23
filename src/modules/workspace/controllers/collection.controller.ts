import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
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
  CollectionAiRequestDto,
  CollectionGraphQLDto,
  CollectionMockRequestResponseDto,
  CollectionRequestDto,
  CollectionRequestResponseDto,
  CollectionSocketIODto,
  CollectionWebSocketDto,
  FolderPayload,
  UpdateCollectionMockRequestResponseDto,
  UpdateCollectionRequestResponseDto,
} from "../payloads/collectionRequest.payload";
import { CollectionRequestService } from "../services/collection-request.service";
import { JwtAuthGuard } from "@src/modules/common/guards/jwt-auth.guard";
import {
  FileInterceptor,
  MemoryStorageFile,
  UploadedFile,
} from "@blazity/nest-file-fastify";
import { CollectionTypeEnum } from "@src/modules/common/models/collection.model";
import { UserService } from "@src/modules/identity/services/user.service";
import { ExtendedFastifyRequest } from "@src/types/fastify";

@ApiBearerAuth()
@ApiTags("collection")
@Controller("api/collection")
export class collectionController {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly workSpaceService: WorkspaceService,
    private readonly collectionRequestService: CollectionRequestService,
    private readonly userService: UserService,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const workspaceId = createCollectionDto.workspaceId;
    const data = await this.collectionService.createCollection(
      createCollectionDto,
      user,
    );
    if (createCollectionDto?.collectionType === CollectionTypeEnum.MOCK) {
      await this.collectionService.updateMockCollectionUrl(
        data.insertedId.toString(),
      );
    }
    const collection = await this.collectionService.getCollection(
      data.insertedId.toString(),
    );
    await this.workSpaceService.addCollectionInWorkSpace(
      workspaceId,
      {
        id: collection._id,
        name: createCollectionDto.name,
      },
      user._id,
    );

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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const collection = await this.collectionService.getAllCollections(
      workspaceId,
      user,
    );
    await this.userService.updateLastActive(
      request.user._id ? request.user._id.toString() : "",
    );
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    await this.collectionService.updateCollection(
      collectionId,
      updateCollectionDto,
      workspaceId,
      user,
    );

    const collection = await this.collectionService.getCollection(collectionId);
    await this.workSpaceService.updateCollectionInWorkSpace(
      workspaceId,
      collectionId,
      updateCollectionDto.name,
      user._id,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    await this.collectionService.updateMockCollectionRunningStatus(
      workspaceId,
      collectionId,
      updateCollectionDto.isMockCollectionRunning,
      user,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const collection = await this.collectionService.deleteCollection(
      collectionId,
      workspaceId,
      user,
    );

    await this.workSpaceService.deleteCollectionInWorkSpace(
      workspaceId.toString(),
      collectionId,
      user._id,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const newFolder = await this.collectionRequestService.addFolder(
      {
        collectionId,
        workspaceId,
        ...body,
      },
      user,
    );
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const updatedfolder = await this.collectionRequestService.updateFolder(
      {
        collectionId,
        workspaceId,
        folderId,
        ...body,
      },
      user,
    );
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const payload = {
      collectionId: collectionId,
      workspaceId: workspaceId,
      folderId: folderId,
      currentBranch: branchNameDto.branchName,
    };
    const response = await this.collectionRequestService.deleteFolder(
      payload,
      user,
    );
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const collectionId = requestDto.collectionId;
    const workspaceId = requestDto.workspaceId;
    await this.workSpaceService.IsWorkspaceAdminOrEditor(
      requestDto.workspaceId,
      user._id,
    );
    await this.collectionRequestService.checkPermission(workspaceId, user._id);
    const noOfRequests =
      await this.collectionRequestService.getNoOfRequest(collectionId);
    const requestObj = await this.collectionRequestService.addRequest(
      collectionId,
      requestDto,
      noOfRequests,
      user,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const collectionId = requestDto.collectionId;
    const workspaceId = requestDto.workspaceId;
    await this.workSpaceService.IsWorkspaceAdminOrEditor(
      requestDto.workspaceId,
      user._id,
    );
    await this.collectionRequestService.checkPermission(workspaceId, user._id);
    const result = await this.collectionRequestService.updateRequest(
      collectionId,
      requestId,
      requestDto,
      user,
    );

    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      result,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const collectionId = requestDto.collectionId;
    const workspaceId = requestDto.workspaceId;
    await this.workSpaceService.IsWorkspaceAdminOrEditor(
      requestDto.workspaceId,
      user._id,
    );
    await this.collectionRequestService.checkPermission(workspaceId, user._id);
    const noOfRequests =
      await this.collectionRequestService.getNoOfRequest(collectionId);
    await this.collectionRequestService.deleteRequest(
      collectionId,
      requestId,
      noOfRequests,
      requestDto,
      user,
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
    @Req() req: ExtendedFastifyRequest,
  ) {
    const user = req.user;
    const branch = await this.collectionService.getBranchData(
      collectionId,
      branchChangeDto.branchName,
      user._id,
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
    @Req() req: ExtendedFastifyRequest,
  ) {
    const user = req.user;
    const websocketObj = await this.collectionRequestService.addWebSocket(
      websocketDto,
      user,
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
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "Websocket saved Successfully" })
  @ApiResponse({ status: 400, description: "Failed to save websocket" })
  async updateWebSocket(
    @Param("websocketId") websocketId: string,
    @Body() websocketDto: Partial<CollectionWebSocketDto>,
    @Res() res: FastifyReply,
    @Req() req: ExtendedFastifyRequest,
  ) {
    const user = req.user;
    const websocket = await this.collectionRequestService.updateWebSocket(
      websocketId,
      websocketDto,
      user,
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
    @Req() req: ExtendedFastifyRequest,
  ) {
    const user = req.user;
    await this.collectionRequestService.deleteWebSocket(
      websocketId,
      websocketDto,
      user,
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
    @Req() req: ExtendedFastifyRequest,
  ) {
    const dataBuffer = file.buffer;
    const dataString = dataBuffer.toString("utf8");
    const dataObj = JSON.parse(dataString);
    const user = req.user;
    const collection = await this.collectionService.importPostmanCollection(
      dataObj,
      workspaceId,
      user,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const socketioObj = await this.collectionRequestService.addSocketIO(
      socketioDto,
      user,
    );
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const socketio = await this.collectionRequestService.updateSocketIO(
      socketioId,
      socketioDto,
      user,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    await this.collectionRequestService.deleteSocketIO(
      socketioId,
      socketioDto,
      user,
    );
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const graphqlObj = await this.collectionRequestService.addGraphQL(
      graphqlDto,
      user,
    );
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const graphql = await this.collectionRequestService.updateGraphQL(
      graphqlId,
      graphqlDto,
      user,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    await this.collectionRequestService.deleteGraphQL(
      graphqlId,
      graphqlDto,
      user,
    );
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const requestResponseObj =
      await this.collectionRequestService.addRequestResponse(
        requestResponseDto,
        user,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const requestResponse =
      await this.collectionRequestService.updateRequestResponse(
        responseId,
        requestResponseDto,
        user,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    await this.collectionRequestService.deleteRequestResponse(
      responseId,
      requestResponseDto,
      user,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const collectionId = requestDto.collectionId;
    const workspaceId = requestDto.workspaceId;
    await this.workSpaceService.IsWorkspaceAdminOrEditor(
      requestDto.workspaceId,
      user._id,
    );
    await this.collectionRequestService.checkPermission(workspaceId, user._id);
    const noOfRequests =
      await this.collectionRequestService.getNoOfRequest(collectionId);
    const requestObj = await this.collectionRequestService.addMockRequest(
      collectionId,
      requestDto,
      noOfRequests,
      user,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const collectionId = requestDto.collectionId;
    const workspaceId = requestDto.workspaceId;
    await this.workSpaceService.IsWorkspaceAdminOrEditor(
      requestDto.workspaceId,
      user._id,
    );
    await this.collectionRequestService.checkPermission(workspaceId, user._id);
    const result = await this.collectionRequestService.updateMockRequest(
      collectionId,
      requestId,
      requestDto,
      user,
    );

    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      result,
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
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const collectionId = requestDto.collectionId;
    const workspaceId = requestDto.workspaceId;
    await this.workSpaceService.IsWorkspaceAdminOrEditor(
      requestDto.workspaceId,
      user._id,
    );
    await this.collectionRequestService.checkPermission(workspaceId, user._id);
    const noOfRequests =
      await this.collectionRequestService.getNoOfRequest(collectionId);
    await this.collectionRequestService.deleteMockRequest(
      collectionId,
      requestId,
      noOfRequests,
      requestDto,
      user,
    );
    const collection = await this.collectionService.getCollection(collectionId);

    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to add a new AI request instance. This can be either an individual
   * AI request instance or a folder-based AI request, and it will be stored in the collection.
   *
   * @param aiRequestDto The DTO containing the details of the AI request to be added.
   * @param res The response object.
   * @returns The response containing the status and the added aiRequest object.
   */
  @Post("ai-request")
  @ApiOperation({
    summary: "Add a AI request",
    description:
      "This will add a AI request which will be individual AI request or folder based AI request in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "AI Request Updated Successfully" })
  @ApiResponse({ status: 400, description: "Failed to Update a AI request" })
  async addAiRequest(
    @Body() aiRequestDto: Partial<CollectionAiRequestDto>,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const aiRequestObj =
      await this.collectionRequestService.addAiRequest(aiRequestDto, user);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      aiRequestObj,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to update an existing AI request instance in the collection.
   * This can be used for both individual and folder-based AI request instances.
   *
   * @param aiRequestId The ID of the AI request to be updated.
   * @param aiRequestDto The DTO containing the updated details of the AI request.
   * @param res The response object.
   * @returns The response containing the status and the updated AI request object.
   */
  @Put("ai-request/:aiRequestId")
  @ApiOperation({
    summary: "Update a AI request",
    description:
      "This will update a AI request which will be individual AI request or folder based AI request in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "AI request saved Successfully" })
  @ApiResponse({ status: 400, description: "Failed to save AI request" })
  async updateAiRequest(
    @Param("aiRequestId") aiRequestId: string,
    @Body() aiRequestDto: Partial<CollectionAiRequestDto>,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const aiRequest = await this.collectionRequestService.updateAiRequest(
      aiRequestId,
      aiRequestDto,
      user
    );

    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      aiRequest,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to delete a specific AI request instance from a collection.
   * Supports both individual and folder-based AI request deletions.
   *
   * @param aiRequestId The ID of the AI request to be deleted.
   * @param aiRequestDto The DTO containing the details of the AI request to be deleted.
   * @param res The response object.
   * @returns The response containing the status and the updated collection.
   */
  @Delete("ai-request/:aiRequestId")
  @ApiOperation({
    summary: "Delete a AI request",
    description:
      "This will delete a AI request which will be individual AI request or folder based AI request in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "AI request Deleted Successfully" })
  @ApiResponse({ status: 400, description: "Failed to delete AI request" })
  async deleteAiRequest(
    @Param("aiRequestId") aiRequestId: string,
    @Body() aiRequestDto: Partial<CollectionAiRequestDto>,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    await this.collectionRequestService.deleteAiRequest(
      aiRequestId,
      aiRequestDto,
      user
    );
    const collection = await this.collectionService.getCollection(
      aiRequestDto.collectionId,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Get(":collectionId/workspace/:workspaceId")
  @ApiOperation({
    summary: "Get Collection By ID",
    description:
      "This will fetch a specific collection using collection ID and workspace ID",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "Collection fetched successfully" })
  @ApiResponse({ status: 404, description: "Collection not found" })
  async getCollectionByIdAndWorkspace(
    @Param("collectionId") collectionId: string,
    @Param("workspaceId") workspaceId: string,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    await this.workSpaceService.IsWorkspaceAdminOrEditor(workspaceId, user._id);

    const collection = await this.collectionService.getCollection(collectionId);
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      collection,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  @Post(":collectionId/workspace/:workspaceId/create-mock")
  @ApiOperation({
    summary: "Create Mock Collection from Existing Collection",
    description:
      "This will create a mock collection based on an existing collection, converting all requests to mock requests with their most recent responses",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 201,
    description: "Mock Collection Created Successfully",
  })
  @ApiResponse({ status: 400, description: "Failed to create mock collection" })
  @ApiResponse({ status: 404, description: "Original collection not found" })
  async createMockCollectionFromExisting(
    @Param("collectionId") collectionId: string,
    @Param("workspaceId") workspaceId: string,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const mockCollection =
      await this.collectionService.createMockCollectionFromExisting(
        collectionId,
        workspaceId,
        user,
      );

    const createdCollection = await this.collectionService.getCollection(
      mockCollection.insertedId.toString(),
    );

    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.CREATED,
      createdCollection,
    );

    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to add a mock response to a mock request in the collection.
   *
   * @param mockRequestResponseDto The mock request response data.
   * @param res The Fastify response object.
   * @returns The response object with status and data.
   */
  @Post("mock-response")
  @ApiOperation({
    summary: "Add A Mock Response",
    description:
      "This will add a mock response inside mock request in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "Mock Response Added Successfully" })
  @ApiResponse({ status: 400, description: "Failed to add a mock response" })
  async addMockRequestResponse(
    @Body() mockRequestResponseDto: Partial<CollectionMockRequestResponseDto>,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const mockRequestResponseObj =
      await this.collectionRequestService.addMockRequestResponse(
        mockRequestResponseDto,
        user,
      );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      mockRequestResponseObj,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to update a mock response inside a mock request in the collection.
   *
   * @param responseId The ID of the mock response to update.
   * @param mockRequestResponseDto The updated mock request response data.
   * @param res The Fastify response object.
   * @returns The response object with status and data.
   */
  @Patch("mock-response/:responseId")
  @ApiOperation({
    summary: "Update a mock response",
    description:
      "This will update a mock response inside a mock request in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: "Mock Response saved Successfully" })
  @ApiResponse({ status: 400, description: "Failed to save mock response" })
  async updateMockRequestResponse(
    @Param("responseId") responseId: string,
    @Body()
    mockRequestResponseDto: Partial<UpdateCollectionMockRequestResponseDto>,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    const mockRequestResponse =
      await this.collectionRequestService.updateMockRequestResponse(
        responseId,
        mockRequestResponseDto,
        user,
      );

    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      mockRequestResponse,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }

  /**
   * Endpoint to delete a mock response inside a mock request in the collection.
   *
   * @param responseId The ID of the mock response to delete.
   * @param mockRequestResponseDto The mock request response data, including collection ID.
   * @param res The Fastify response object.
   * @returns The response object with status and updated collection data.
   */
  @Delete("mock-response/:responseId")
  @ApiOperation({
    summary: "Delete a Mock Response",
    description:
      "This will delete a Mock Response inside a Mock Request in collection",
  })
  @UseGuards(JwtAuthGuard)
  @ApiResponse({
    status: 200,
    description: "Mock Response Deleted Successfully",
  })
  @ApiResponse({ status: 400, description: "Failed to delete Mock Response" })
  async deleteMockRequestResponse(
    @Param("responseId") responseId: string,
    @Body() mockRequestResponseDto: Partial<CollectionMockRequestResponseDto>,
    @Res() res: FastifyReply,
    @Req() request: ExtendedFastifyRequest,
  ) {
    const user = request.user;
    await this.collectionRequestService.deleteMockRequestResponse(
      responseId,
      mockRequestResponseDto,
      user,
    );
    const collection = await this.collectionService.getCollection(
      mockRequestResponseDto.collectionId,
    );
    const responseData = new ApiResponseService(
      "Success",
      HttpStatusCode.OK,
      collection,
    );
    return res.status(responseData.httpStatusCode).send(responseData);
  }
}
