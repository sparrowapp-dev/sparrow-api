import { Test, TestingModule } from "@nestjs/testing";
import { HttpStatusCode } from "axios";
import { FastifyReply } from "fastify";
import { ApiResponseService } from "@src/modules/common/services/api-response.service";
import { CollectionRequestService } from "../services/collection-request.service";
import { collectionController } from "./collection.controller";
import {
  ItemTypeEnum,
  SourceTypeEnum,
} from "@src/modules/common/models/collection.model";
import { CollectionService } from "../services/collection.service";
import { CollectionRepository } from "../repositories/collection.repository";
import { WorkspaceModule } from "../workspace.module";
import { IdentityModule } from "@src/modules/identity/identity.module";
import { AppModule } from "@src/modules/app/app.module";
import { WorkspaceService } from "../services/workspace.service";
import { PostmanParserService } from "@src/modules/common/services/postman.parser.service";
import { ExtendedFastifyRequest } from "@src/types/fastify";

/**
 * Test suite for the collectionController's addSocketIO method.
 */
describe("collectionController - addSocketIO", () => {
  let controller: collectionController;
  let collectionRequestService: CollectionRequestService;

  beforeEach(async () => {
    // Set up the testing module before each test
    const module: TestingModule = await Test.createTestingModule({
      imports: [WorkspaceModule, IdentityModule, AppModule],
      controllers: [collectionController],
      providers: [
        {
          provide: CollectionRequestService,
          useValue: { addSocketIO: jest.fn() },
        },
        ApiResponseService,
        CollectionService,
        CollectionRepository,
        WorkspaceService,
        PostmanParserService,
      ],
    }).compile();

    controller = module.get<collectionController>(collectionController);
    collectionRequestService = module.get<CollectionRequestService>(
      CollectionRequestService,
    );
  });

  /**
   * Test case for the addSocketIO method of the collectionController.
   * It checks if the method returns a 200 status and the added Socket.IO object on success.
   */
  it("should return 200 and the added socketio object on success", async () => {
    // Mock Socket.IO DTO
    const mockSocketioDto = {
      collectionId: "671f77cdca932e8e25df5443",
      workspaceId: "66cf07d9e12c197c1202a391",
      items: {
        name: "New SOCKETIO",
        type: ItemTypeEnum.SOCKETIO,
        description: "",
        socketio: {
          url: "once",
        },
      },
    };
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    // Mock the expected added Socket.IO object
    const mockAddedSocketIO = {
      name: "New SOCKETIO",
      type: ItemTypeEnum.SOCKETIO,
      description: "",
      source: SourceTypeEnum.USER,
      isDeleted: false,
      createdBy: "astitvaone",
      updatedBy: "astitvaone",
      createdAt: new Date(),
      updatedAt: new Date(),
      socketio: {
        url: "once",
      },
    };

    // Mock the implementation of addSocketIO to return the mock added object
    jest
      .spyOn(collectionRequestService, "addSocketIO")
      .mockResolvedValue(mockAddedSocketIO);

    // Call the addSocketIO method with the mock data and response
    await controller.addSocketIO(
      mockSocketioDto,
      mockResponse as unknown as FastifyReply,
      {} as ExtendedFastifyRequest,
    );

    // Assertions to check if the response status and send method are called with expected values
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.Ok);
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        httpStatusCode: HttpStatusCode.Ok,
        data: mockAddedSocketIO,
      }),
    );
  });

  /**
   * Test case for the addGraphQL method of the collectionController.
   * It checks if the method returns a 200 status and the added GraphQL object on success.
   */
  it("should return 200 and the added graphql object on success", async () => {
    const mockGraphqlDto = {
      collectionId: "67320ae0fccb654a7bac69c8",
      workspaceId: "67320ad4fccb654a7bac69c6",
      items: {
        name: "New GRAPHQL",
        type: ItemTypeEnum.GRAPHQL,
        description: "GraphQL integration",
        graphql: {
          url: "https://api.example.com/graphql",
        },
      },
    };
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const mockAddedGraphQL = {
      name: "New GRAPHQL",
      type: ItemTypeEnum.GRAPHQL,
      description: "GraphQL integration",
      source: SourceTypeEnum.USER,
      isDeleted: false,
      createdBy: "astitvaone",
      updatedBy: "astitvaone",
      createdAt: new Date(),
      updatedAt: new Date(),
      graphql: {
        url: "https://api.example.com/graphql",
      },
    };

    jest
      .spyOn(collectionRequestService, "addGraphQL")
      .mockResolvedValue(mockAddedGraphQL);

    await controller.addGraphQL(
      mockGraphqlDto,
      mockResponse as unknown as FastifyReply,
      {} as ExtendedFastifyRequest,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.Ok);
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        httpStatusCode: HttpStatusCode.Ok,
        data: mockAddedGraphQL,
      }),
    );
  });
});
